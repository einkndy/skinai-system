import math
import numpy as np

try:
    import cv2
    import mediapipe as mp
except ImportError:
    cv2 = None
    mp = None

OUTPUT_SIZE = 640
CROP_RATIO = 2.35

mp_face_mesh = None

if mp:
    mp_face_mesh = mp.solutions.face_mesh


def _decode_image(image_bytes):
    if cv2 is None:
        return None

    buffer = np.frombuffer(image_bytes, dtype=np.uint8)
    return cv2.imdecode(buffer, cv2.IMREAD_COLOR)


def _encode_jpeg(image):
    success, encoded = cv2.imencode(
        ".jpg",
        image,
        [int(cv2.IMWRITE_JPEG_QUALITY), 95],
    )

    if not success:
        return None

    return encoded.tobytes()


def _ensure_portrait(image):
    h, w = image.shape[:2]

    if w > h:
        image = cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE)

    return image


def _normalize_flip(image):
    """
    Optional mirror normalization.
    Bisa dimatikan jika hasil terasa terbalik.
    """

    return cv2.flip(image, 1)


def _get_face_landmarks(image):
    if mp_face_mesh is None:
        return None

    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    with mp_face_mesh.FaceMesh(
        static_image_mode=True,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
    ) as face_mesh:

        results = face_mesh.process(rgb)

        if not results.multi_face_landmarks:
            return None

        return results.multi_face_landmarks[0]


def _landmark_to_point(landmark, image_width, image_height):
    return (
        int(landmark.x * image_width),
        int(landmark.y * image_height),
    )


def _get_eye_centers(face_landmarks, image_shape):
    h, w = image_shape[:2]

    # Mediapipe landmark mata
    LEFT_EYE = [33, 133]
    RIGHT_EYE = [362, 263]

    left_points = []
    right_points = []

    for idx in LEFT_EYE:
        point = _landmark_to_point(
            face_landmarks.landmark[idx],
            w,
            h,
        )
        left_points.append(point)

    for idx in RIGHT_EYE:
        point = _landmark_to_point(
            face_landmarks.landmark[idx],
            w,
            h,
        )
        right_points.append(point)

    left_eye_center = np.mean(left_points, axis=0).astype(int)
    right_eye_center = np.mean(right_points, axis=0).astype(int)

    return left_eye_center, right_eye_center


def _calculate_rotation_angle(left_eye, right_eye):
    dy = right_eye[1] - left_eye[1]
    dx = right_eye[0] - left_eye[0]

    angle = math.degrees(math.atan2(dy, dx))

    return angle


def _rotate_image(image, angle):
    h, w = image.shape[:2]

    center = (w // 2, h // 2)

    rotation_matrix = cv2.getRotationMatrix2D(
        center,
        angle,
        1.0,
    )

    rotated = cv2.warpAffine(
        image,
        rotation_matrix,
        (w, h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )

    return rotated


def _extract_face_box(face_landmarks, image_shape):
    h, w = image_shape[:2]

    xs = []
    ys = []

    for landmark in face_landmarks.landmark:
        xs.append(int(landmark.x * w))
        ys.append(int(landmark.y * h))

    x_min = min(xs)
    x_max = max(xs)
    y_min = min(ys)
    y_max = max(ys)

    return x_min, y_min, x_max, y_max


def _crop_face(image, face_box):
    image_h, image_w = image.shape[:2]

    x_min, y_min, x_max, y_max = face_box

    face_w = x_max - x_min
    face_h = y_max - y_min

    center_x = x_min + face_w / 2
    center_y = y_min + face_h / 2

    side = max(face_w, face_h) * CROP_RATIO

    left = int(center_x - side / 2)
    right = int(center_x + side / 2)
    top = int(center_y - side / 2)
    bottom = int(center_y + side / 2)

    pad_left = max(0, -left)
    pad_top = max(0, -top)
    pad_right = max(0, right - image_w)
    pad_bottom = max(0, bottom - image_h)

    if any((pad_left, pad_top, pad_right, pad_bottom)):
        image = cv2.copyMakeBorder(
            image,
            pad_top,
            pad_bottom,
            pad_left,
            pad_right,
            cv2.BORDER_REPLICATE,
        )

        left += pad_left
        right += pad_left
        top += pad_top
        bottom += pad_top

    cropped = image[top:bottom, left:right]

    return cropped


def align_face_image_bytes(image_bytes, output_size=OUTPUT_SIZE):
    try:
        if cv2 is None or mp is None:
            print("FACE NOT DETECTED")
            return image_bytes

        image = _decode_image(image_bytes)

        if image is None:
            print("FACE NOT DETECTED")
            return image_bytes

        # portrait normalization
        image = _ensure_portrait(image)

        # optional mirror normalisasi
        # image = _normalize_flip(image)

        detection_image = _improve_detection_image(image)

        face_landmarks = _get_face_landmarks(
            detection_image
        )

        # detect face landmarks
        face_landmarks = _get_face_landmarks(image)

        if face_landmarks is None:
            print("FACE NOT DETECTED")
            return image_bytes

        print("FACE LANDMARK DETECTED")

        # eye center
        left_eye, right_eye = _get_eye_centers(
            face_landmarks,
            image.shape,
        )

        # angle
        angle = _calculate_rotation_angle(
            left_eye,
            right_eye,
        )

        print(f"FACE ANGLE: {angle}")

        # rotate image
        rotated = _rotate_image(image, angle)

        print("FACE ROTATED")

        # detect again after rotation
        rotated_landmarks = _get_face_landmarks(rotated)

        if rotated_landmarks is None:
            print("FACE NOT DETECTED")
            return image_bytes

        # face box
        face_box = _extract_face_box(
            rotated_landmarks,
            rotated.shape,
        )

        # crop
        cropped = _crop_face(
            rotated,
            face_box,
        )

        # resize
        resized = cv2.resize(
            cropped,
            (output_size, output_size),
            interpolation=cv2.INTER_AREA,
        )

        encoded = _encode_jpeg(resized)

        if encoded is None:
            print("FACE NOT DETECTED")
            return image_bytes

        print("FACE NORMALIZED")

        return encoded

    except Exception as error:
        print("FACE ALIGNMENT ERROR:", error)
        return image_bytes