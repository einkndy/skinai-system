import math
import numpy as np

try:
    import cv2
except ImportError:
    cv2 = None

OUTPUT_SIZE = 640
CROP_RATIO = 2.35


def _decode_image(image_bytes):
    if cv2 is None:
        return None

    buffer = np.frombuffer(image_bytes, dtype=np.uint8)

    return cv2.imdecode(
        buffer,
        cv2.IMREAD_COLOR,
    )


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
        image = cv2.rotate(
            image,
            cv2.ROTATE_90_CLOCKWISE,
        )

    return image


def _get_face_cascade():
    cascade_path = (
        cv2.data.haarcascades
        + "haarcascade_frontalface_default.xml"
    )

    cascade = cv2.CascadeClassifier(cascade_path)

    if cascade.empty():
        return None

    return cascade


def _detect_largest_face(image):
    cascade = _get_face_cascade()

    if cascade is None:
        return None

    gray = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2GRAY,
    )

    gray = cv2.equalizeHist(gray)

    faces = cascade.detectMultiScale(
        gray,
        scaleFactor=1.08,
        minNeighbors=5,
        minSize=(80, 80),
        flags=cv2.CASCADE_SCALE_IMAGE,
    )

    if len(faces) == 0:
        return None

    return max(
        faces,
        key=lambda face: face[2] * face[3],
    )


def _calculate_rotation_angle(face):
    x, y, w, h = face

    # estimasi kemiringan ringan
    # sementara dibuat 0 agar stabil di Render
    return 0


def _rotate_image(image, angle):
    if angle == 0:
        return image

    h, w = image.shape[:2]

    center = (w // 2, h // 2)

    matrix = cv2.getRotationMatrix2D(
        center,
        angle,
        1.0,
    )

    rotated = cv2.warpAffine(
        image,
        matrix,
        (w, h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )

    return rotated


def _crop_face_square(image, face):
    image_h, image_w = image.shape[:2]

    x, y, w, h = face

    center_x = x + w / 2
    center_y = y + h / 2

    side = max(w, h) * CROP_RATIO

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


def align_face_image_bytes(
    image_bytes,
    output_size=OUTPUT_SIZE,
):
    try:
        if cv2 is None:
            print("FACE NOT DETECTED")
            return image_bytes

        image = _decode_image(image_bytes)

        if image is None:
            print("FACE NOT DETECTED")
            return image_bytes

        image = _ensure_portrait(image)

        face = _detect_largest_face(image)

        if face is None:
            print("FACE NOT DETECTED")
            return image_bytes

        print("FACE DETECTED")

        angle = _calculate_rotation_angle(face)

        rotated = _rotate_image(
            image,
            angle,
        )

        rotated_face = _detect_largest_face(rotated)

        if rotated_face is None:
            rotated_face = face

        cropped = _crop_face_square(
            rotated,
            rotated_face,
        )

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