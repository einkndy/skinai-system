import math
import numpy as np

try:
    import cv2
except ImportError:
    cv2 = None

OUTPUT_SIZE = 640
CROP_RATIO = 2.35
MIN_FACE_RATIO = 0.08
MIN_BLUR_SCORE = 80.0
MIN_BRIGHTNESS = 45.0
MAX_BRIGHTNESS = 210.0


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


def _quality_metrics(image, face=None):
    gray = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2GRAY,
    )

    blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    brightness = float(np.mean(gray))
    image_h, image_w = image.shape[:2]
    face_ratio = None

    if face is not None:
        _, _, w, h = face
        face_ratio = float((w * h) / max(image_w * image_h, 1))

    issues = []

    if blur_score < MIN_BLUR_SCORE:
        issues.append("blur")

    if brightness < MIN_BRIGHTNESS:
        issues.append("too_dark")
    elif brightness > MAX_BRIGHTNESS:
        issues.append("too_bright")

    if face is None:
        issues.append("face_not_detected")
    elif face_ratio is not None and face_ratio < MIN_FACE_RATIO:
        issues.append("face_too_small")

    return {
        "blur_score": blur_score,
        "brightness": brightness,
        "face_ratio": face_ratio,
        "quality_ok": len(issues) == 0,
        "quality_issues": issues,
    }


def detect_crop_face_for_prediction(
    image_bytes,
    output_size=OUTPUT_SIZE,
):
    metadata = {
        "face_detected": False,
        "face_box": None,
        "original_width": None,
        "original_height": None,
        "processed_width": None,
        "processed_height": None,
        "crop_applied": False,
        "quality_ok": False,
        "quality_issues": ["face_not_detected"],
        "blur_score": None,
        "brightness": None,
        "face_ratio": None,
        "fallback_reason": "face_not_detected",
    }

    try:
        if cv2 is None:
            metadata["quality_issues"] = ["opencv_unavailable"]
            metadata["fallback_reason"] = "opencv_unavailable"
            return image_bytes, metadata

        image = _decode_image(image_bytes)

        if image is None:
            metadata["quality_issues"] = ["image_decode_failed"]
            metadata["fallback_reason"] = "image_decode_failed"
            return image_bytes, metadata

        image = _ensure_portrait(image)
        image_h, image_w = image.shape[:2]
        metadata["original_width"] = int(image_w)
        metadata["original_height"] = int(image_h)

        face = _detect_largest_face(image)
        metrics = _quality_metrics(image, face)
        metadata.update(metrics)

        if face is None:
            print("PREDICT FACE NOT DETECTED")
            metadata["fallback_reason"] = "face_not_detected"
            return image_bytes, metadata

        x, y, w, h = face
        metadata["face_detected"] = True
        metadata["face_box"] = {
            "x": int(x),
            "y": int(y),
            "width": int(w),
            "height": int(h),
        }

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
            metadata["quality_ok"] = False
            metadata["quality_issues"] = ["crop_encode_failed"]
            metadata["fallback_reason"] = "crop_encode_failed"
            return image_bytes, metadata

        metadata["processed_width"] = int(output_size)
        metadata["processed_height"] = int(output_size)
        metadata["crop_applied"] = True
        metadata["fallback_reason"] = None

        print("PREDICT FACE DETECTED")
        print("PREDICT FACE CROP APPLIED")

        return encoded, metadata

    except Exception as error:
        print("PREDICT FACE CROP ERROR:", error)
        metadata["quality_ok"] = False
        metadata["quality_issues"] = ["face_crop_error"]
        metadata["fallback_reason"] = "face_crop_error"
        return image_bytes, metadata


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
