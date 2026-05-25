from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Response, Header
from database import get_db_connection, is_db_error
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from typing import Dict, List
from datetime import datetime
from urllib.request import Request as UrlRequest, urlopen
from urllib.error import URLError, HTTPError
import asyncio
import tensorflow as tf
import numpy as np
from PIL import Image
import io
import os
import uuid
from fastapi.staticfiles import StaticFiles
from utils.image_preprocess import align_face_image_bytes
import hashlib
import hmac
import base64
import json
import random
import re
import gdown



app = FastAPI(title="Skin AI Backend")
if not os.path.exists("uploads"):
    os.makedirs("uploads")

DEVICE_CAPTURE_DIR = "device_capture"
os.makedirs(DEVICE_CAPTURE_DIR, exist_ok=True)
    
app.mount(
    "/uploads",
    StaticFiles(directory="uploads"),
    name="uploads"
)

# ===== CORS (WAJIB untuk React) =====
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # nanti bisa dibatasi
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CLASSES = ["berminyak", "kombinasi", "normal", "kering", "sensitif"]
MODEL_PATH = "model/model.h5"

if not os.path.exists(MODEL_PATH):
    print("DOWNLOADING AI MODEL...")

    os.makedirs("model", exist_ok=True)

    file_id = "15SRs6jLBFk8i8XBnv6AbR6cMjjvqwpOV"

    url = f"https://drive.google.com/uc?id={file_id}"

    gdown.download(
        url,
        MODEL_PATH,
        quiet=False,
    )

    print("MODEL DOWNLOAD COMPLETE")

model = None
MODEL_READY = False
MODEL_ERROR = None
MODEL_LOADED_AT = None
DEVICE_TIMEOUT_SECONDS = 30
WATCHDOG_INTERVAL_SECONDS = 5
DEVICE_HTTP_TIMEOUT_SECONDS = 6
DEFAULT_USER_PASSWORD = "skinai123"
AUTH_SECRET = os.environ.get("SKINAI_AUTH_SECRET", "skinai-local-session-secret")


def load_ai_model():
    global model, MODEL_READY, MODEL_ERROR, MODEL_LOADED_AT

    try:
        model = tf.keras.models.load_model(
            MODEL_PATH,
            compile=False
        )

        MODEL_READY = True
        MODEL_ERROR = None
        MODEL_LOADED_AT = datetime.now().isoformat(timespec="seconds")

        print("MODEL LOADED")
        print("AI READY")

    except Exception as error:
        model = None
        MODEL_READY = False
        MODEL_ERROR = str(error)
        MODEL_LOADED_AT = None

        print("MODEL LOAD ERROR:", MODEL_ERROR)
        print("AI NOT READY")


load_ai_model()


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def verify_password(input_password: str, stored_password: str) -> bool:
    hashed_input = hash_password(input_password)

    return hmac.compare_digest(hashed_input, stored_password) or hmac.compare_digest(
        input_password,
        stored_password,
    )


def _base64_url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("utf-8").rstrip("=")


def _base64_url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def create_session_token(user: dict) -> str:
    payload = {
        "user_id": user["id"],
        "role": user["role"],
        "username": user["username"],
        "email": user["email"],
    }
    encoded_payload = _base64_url_encode(
        json.dumps(payload, separators=(",", ":")).encode("utf-8")
    )
    signature = hmac.new(
        AUTH_SECRET.encode("utf-8"),
        encoded_payload.encode("utf-8"),
        hashlib.sha256,
    ).digest()

    return f"{encoded_payload}.{_base64_url_encode(signature)}"


def decode_session_token(token: str) -> dict | None:
    try:
        encoded_payload, encoded_signature = token.split(".", 1)
        expected_signature = _base64_url_encode(
            hmac.new(
                AUTH_SECRET.encode("utf-8"),
                encoded_payload.encode("utf-8"),
                hashlib.sha256,
            ).digest()
        )

        if not hmac.compare_digest(encoded_signature, expected_signature):
            return None

        return json.loads(_base64_url_decode(encoded_payload).decode("utf-8"))
    except Exception:
        return None


def get_current_user(authorization: str | None = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="session tidak valid")

    payload = decode_session_token(authorization.replace("Bearer ", "", 1).strip())

    if not payload:
        raise HTTPException(status_code=401, detail="session tidak valid")

    conn = open_db_or_error()

    if is_db_error(conn):
        raise HTTPException(status_code=503, detail=conn.get("message"))

    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        """
        SELECT id, username, full_name, email, phone, role, admin_id, patient_id
        FROM users
        WHERE id=%s
        """,
        (payload.get("user_id"),),
    )
    user = cursor.fetchone()
    cursor.close()
    conn.close()

    if not user:
        raise HTTPException(status_code=401, detail="session tidak valid")

    return user


def require_role(role: str, authorization: str | None = Header(None)) -> dict:
    user = get_current_user(authorization)

    if user["role"] != role:
        raise HTTPException(status_code=403, detail="akses tidak diizinkan")

    print("ROLE VALIDATED", {"user_id": user["id"], "role": user["role"]})

    return user


def require_admin(authorization: str | None = Header(None)) -> dict:
    return require_role("admin", authorization)


def require_patient_user(authorization: str | None = Header(None)) -> dict:
    return require_role("user", authorization)


def slugify_username(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "_", (value or "").strip().lower())
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")

    return cleaned or "pasien"


def generate_unique_username(cursor, nama_pasien: str) -> str:
    base = slugify_username(nama_pasien)

    for _ in range(30):
        username = f"{base}_{random.randint(100, 999)}"
        cursor.execute("SELECT id FROM users WHERE username=%s", (username,))

        if not cursor.fetchone():
            return username

    return f"{base}_{uuid.uuid4().hex[:8]}"


def find_or_create_patient_user(cursor, nama_pasien: str, email_pasien: str, patient_id: int):
    email_pasien = (email_pasien or "").strip().lower()

    if not email_pasien:
        return None, None

    cursor.execute(
        """
        SELECT id, username, email, role
        FROM users
        WHERE email=%s
        FOR UPDATE
        """,
        (email_pasien,),
    )
    existing_user = cursor.fetchone()

    if existing_user:
        cursor.execute(
            """
            UPDATE users
            SET patient_id=COALESCE(patient_id, %s)
            WHERE id=%s
            """,
            (patient_id, existing_user["id"]),
        )

        return existing_user["id"], None

    username = generate_unique_username(cursor, nama_pasien)
    hashed_password = hash_password(DEFAULT_USER_PASSWORD)

    cursor.execute(
        """
        INSERT INTO users (username, full_name, email, password, role, patient_id)
        VALUES (%s,%s,%s,%s,'user',%s)
        """,
        (username, nama_pasien, email_pasien, hashed_password, patient_id),
    )
    user_id = cursor.lastrowid
    print("AUTO USER CREATED", {"user_id": user_id, "username": username, "email": email_pasien})

    return user_id, {
        "username": username,
        "email": email_pasien,
        "password": DEFAULT_USER_PASSWORD,
    }


def open_db_or_error():
    conn = get_db_connection()

    if is_db_error(conn):
        return conn

    return conn


def write_activity_log(
    event_type: str,
    title: str,
    detail: str = "",
    entity_type: str | None = None,
    entity_id: int | None = None,
):
    conn = open_db_or_error()

    if is_db_error(conn):
        print("activity-log skipped:", conn.get("message"))
        return

    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            INSERT INTO activity_logs
            (event_type, title, detail, entity_type, entity_id)
            VALUES (%s,%s,%s,%s,%s)
            """,
            (event_type, title, detail, entity_type, entity_id),
        )
        conn.commit()
    except Exception as error:
        conn.rollback()
        print("activity-log warning:", str(error))
    finally:
        cursor.close()
        conn.close()


def mark_timed_out_devices_offline():
    conn = open_db_or_error()

    if is_db_error(conn):
        print("device-watchdog skipped:", conn.get("message"))
        return

    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT device_id
            FROM devices
            WHERE status <> 'offline'
            AND last_seen IS NOT NULL
            AND last_seen < (NOW() - INTERVAL %s SECOND)
            """,
            (DEVICE_TIMEOUT_SECONDS,),
        )

        timed_out_devices = cursor.fetchall()

        if not timed_out_devices:
            return

        cursor.execute(
            """
            UPDATE devices
            SET status='offline'
            WHERE status <> 'offline'
            AND last_seen IS NOT NULL
            AND last_seen < (NOW() - INTERVAL %s SECOND)
            """,
            (DEVICE_TIMEOUT_SECONDS,),
        )

        conn.commit()

        for device in timed_out_devices:
            print(f"DEVICE OFFLINE: {device['device_id']}")

    except Exception as error:
        conn.rollback()
        print("device-watchdog warning:", str(error))
    finally:
        cursor.close()
        conn.close()


async def device_watchdog_loop():
    print("WATCHDOG ACTIVE")

    while True:
        mark_timed_out_devices_offline()
        await asyncio.sleep(WATCHDOG_INTERVAL_SECONDS)


# @app.on_event("startup")
# async def start_device_watchdog():
#     if getattr(app.state, "device_watchdog_started", False):
#         return

#     app.state.device_watchdog_started = True
#     asyncio.create_task(device_watchdog_loop())


@app.get("/model-status")
def get_model_status():
    model_exists = os.path.exists(MODEL_PATH)
    model_size_mb = None

    if model_exists:
        model_size_mb = round(os.path.getsize(MODEL_PATH) / (1024 * 1024), 2)

    return {
        "ready": MODEL_READY,
        "status": "ready" if MODEL_READY else "offline",
        "model_path": MODEL_PATH,
        "model_exists": model_exists,
        "model_size_mb": model_size_mb,
        "classes": CLASSES,
        "input_size": [224, 224],
        "loaded_at": MODEL_LOADED_AT,
        "error": MODEL_ERROR,
    }


@app.get("/activity-logs")
def get_activity_logs(limit: int = 20):
    conn = open_db_or_error()

    if is_db_error(conn):
        return conn

    safe_limit = max(1, min(int(limit or 20), 100))
    cursor = conn.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT *
        FROM activity_logs
        ORDER BY created_at DESC
        LIMIT %s
        """,
        (safe_limit,),
    )

    rows = cursor.fetchall()

    for row in rows:
        ip_address = (row.get("ip_address") or "").strip()

        if ip_address:
            if not row.get("stream_url"):
                row["stream_url"] = f"http://{ip_address}/stream"

            if not row.get("capture_url"):
                row["capture_url"] = f"http://{ip_address}/capture"

    cursor.close()
    conn.close()

    return rows


@app.get("/devices")
def get_devices():
    conn = open_db_or_error()

    if is_db_error(conn):
        return conn

    cursor = conn.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT *
        FROM devices
        ORDER BY updated_at DESC
        """
    )

    rows = cursor.fetchall()

    cursor.close()
    conn.close()

    return rows


@app.get("/devices/architecture")
def get_device_architecture():
    return {
        "capture_flow": [
            "ESP32-CAM",
            "/devices/heartbeat",
            "/predict",
            "/save-history",
            "/result/{history_id}",
        ],
        "prepared_endpoints": [
            "GET /devices",
            "POST /devices/heartbeat",
            "GET /devices/{device_id}/status",
        ],
        "device_contract": {
            "device_id": "string",
            "device_name": "string",
            "device_type": "esp32-main | esp32-cam | button-trigger",
            "ip_address": "string",
            "stream_url": "http://device/stream",
            "capture_url": "http://device/capture",
            "status": "online | offline | maintenance",
            "firmware_version": "string",
            "location": "string",
        },
    }


@app.post("/devices/heartbeat")
def device_heartbeat(data: dict):
    print("DEVICE HEARTBEAT PAYLOAD:", data)

    device_id = (data.get("device_id") or "").strip()

    if not device_id:
        raise HTTPException(
            status_code=400,
            detail="device_id wajib diisi",
        )

    device_name = (data.get("device_name") or device_id).strip()
    device_type = (data.get("device_type") or "esp32-cam").strip()
    ip_address = (data.get("ip_address") or "").strip()
    stream_url = (data.get("stream_url") or "").strip()
    capture_url = (data.get("capture_url") or "").strip()

    if ip_address:
        if not stream_url:
            stream_url = f"http://{ip_address}/stream"

        if not capture_url:
            capture_url = f"http://{ip_address}/capture"
    status = "online"
    firmware_version = (data.get("firmware_version") or "").strip()
    location = (data.get("location") or "").strip()

    conn = open_db_or_error()

    if is_db_error(conn):
        return conn

    cursor = conn.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT id, status
        FROM devices
        WHERE device_id=%s
        """,
        (device_id,),
    )

    existing_device = cursor.fetchone()

    cursor.execute(
        """
        INSERT INTO devices (
            device_id,
            device_name,
            device_type,
            ip_address,
            stream_url,
            capture_url,
            status,
            firmware_version,
            last_seen,
            location
        )
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,NOW(),%s)
        ON DUPLICATE KEY UPDATE
            device_name=VALUES(device_name),
            device_type=VALUES(device_type),
            ip_address=COALESCE(NULLIF(VALUES(ip_address), ''), ip_address),
            stream_url=COALESCE(NULLIF(VALUES(stream_url), ''), stream_url),
            capture_url=COALESCE(NULLIF(VALUES(capture_url), ''), capture_url),
            status=VALUES(status),
            firmware_version=VALUES(firmware_version),
            last_seen=NOW(),
            location=VALUES(location)
        """,
        (
            device_id,
            device_name,
            device_type,
            ip_address,
            stream_url,
            capture_url,
            status,
            firmware_version,
            location,
        ),
    )

    conn.commit()

    cursor.execute(
        """
        SELECT *
        FROM devices
        WHERE device_id=%s
        """,
        (device_id,),
    )

    device = cursor.fetchone()

    cursor.close()
    conn.close()

    if existing_device:
        if existing_device.get("status") != "online":
            print(f"DEVICE ONLINE: {device_id}")

        print(
            "DEVICE HEARTBEAT OK",
            {
                "device_id": device_id,
                "status": status,
            },
        )
    else:
        print(f"DEVICE ONLINE: {device_id}")
        print(
            "DEVICE REGISTERED",
            {
                "device_id": device_id,
                "device_type": device_type,
                "status": status,
            },
        )
        print(
            "DEVICE HEARTBEAT OK",
            {
                "device_id": device_id,
                "status": status,
            },
        )

    write_activity_log(
        "device_heartbeat" if existing_device else "device_registered",
        "DEVICE HEARTBEAT OK" if existing_device else "DEVICE REGISTERED",
        f"{device_id} ({device_type}) status {status}",
        "device",
        device.get("id") if device else None,
    )

    return {
        "success": True,
        "device": device,
    }


@app.get("/devices/{device_id}/status")
def get_device_status(device_id: str):
    conn = open_db_or_error()

    if is_db_error(conn):
        return conn

    cursor = conn.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT *
        FROM devices
        WHERE device_id=%s
        """,
        (device_id,),
    )

    device = cursor.fetchone()

    cursor.close()
    conn.close()

    if not device:
        raise HTTPException(
            status_code=404,
            detail="device tidak ditemukan",
        )

    return device


def normalize_device_url(value: str, fallback_path: str = "") -> str:
    raw_value = (value or "").strip().rstrip("/")

    if not raw_value:
        return ""

    if not raw_value.startswith(("http://", "https://")):
        raw_value = f"http://{raw_value}"

    if raw_value.endswith(("/stream", "/capture", "/jpg", "/capture.jpg")):
        return raw_value

    return f"{raw_value}{fallback_path}"


def get_device_or_404(device_id: str):
    conn = open_db_or_error()

    if is_db_error(conn):
        raise HTTPException(
            status_code=500,
            detail="database tidak tersedia",
        )

    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        """
        SELECT *
        FROM devices
        WHERE device_id=%s
        """,
        (device_id,),
    )

    device = cursor.fetchone()
    cursor.close()
    conn.close()

    if not device:
        raise HTTPException(
            status_code=404,
            detail="device tidak ditemukan",
        )

    return device


def open_device_url(url: str):
    request = UrlRequest(
        url,
        headers={
            "User-Agent": "SkinAI-Backend/1.0",
            "Connection": "close",
        },
    )

    try:
        return urlopen(
            request,
            timeout=DEVICE_HTTP_TIMEOUT_SECONDS,
        )
    except HTTPError as error:
        raise HTTPException(
            status_code=502,
            detail=f"device merespons error {error.code}",
        ) from error
    except URLError as error:
        raise HTTPException(
            status_code=504,
            detail=f"device tidak dapat dijangkau: {error.reason}",
        ) from error
    except TimeoutError as error:
        raise HTTPException(
            status_code=504,
            detail="device timeout",
        ) from error


@app.get("/devices/{device_id}/capture-proxy")
def proxy_device_capture(device_id: str):
    device = get_device_or_404(device_id)
    capture_url = normalize_device_url(
        device.get("capture_url") or device.get("ip_address"),
        "/capture",
    )

    if not capture_url:
        raise HTTPException(
            status_code=404,
            detail="capture url tidak tersedia",
        )

    print("DEVICE CAPTURE PROXY:", capture_url)

    with open_device_url(capture_url) as response:
        content = response.read()
        media_type = response.headers.get_content_type() or "image/jpeg"

    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Cache-Control": "no-store",
        },
    )


@app.get("/devices/{device_id}/stream-proxy")
def proxy_device_stream(device_id: str):
    device = get_device_or_404(device_id)
    stream_url = normalize_device_url(
        device.get("stream_url") or device.get("ip_address"),
        "/stream",
    )

    if not stream_url:
        raise HTTPException(
            status_code=404,
            detail="stream url tidak tersedia",
        )

    print("DEVICE STREAM PROXY:", stream_url)

    def stream_generator():
        with open_device_url(stream_url) as response:
            while True:
                chunk = response.read(4096)

                if not chunk:
                    break

                yield chunk

    return StreamingResponse(
        stream_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-store",
        },
    )


def get_latest_device_capture_path():
    if not os.path.exists(DEVICE_CAPTURE_DIR):
        return None

    image_files = [
        os.path.join(DEVICE_CAPTURE_DIR, filename)
        for filename in os.listdir(DEVICE_CAPTURE_DIR)
        if filename.lower().endswith((".jpg", ".jpeg", ".png"))
    ]

    if not image_files:
        return None

    return max(image_files, key=os.path.getmtime)


@app.get("/device-capture/latest-image")
def latest_device_capture_image(after: float | None = None):
    latest_path = get_latest_device_capture_path()

    if not latest_path:
        raise HTTPException(
            status_code=404,
            detail="belum ada capture dari device",
        )

    latest_mtime = os.path.getmtime(latest_path)

    if after is not None and latest_mtime < after:
        raise HTTPException(
            status_code=404,
            detail="belum ada capture baru dari device",
        )

    with open(latest_path, "rb") as image_file:
        content = image_file.read()

    return Response(
        content=content,
        media_type="image/jpeg",
        headers={
            "Cache-Control": "no-store",
            "X-Device-Capture-Filename": os.path.basename(latest_path),
            "X-Device-Capture-Time": str(latest_mtime),
        },
    )


@app.post("/device-upload")
async def device_upload(file: UploadFile = File(...)):
    os.makedirs(DEVICE_CAPTURE_DIR, exist_ok=True)

    filename = datetime.now().strftime(
        "%Y%m%d_%H%M%S.jpg"
    )

    filepath = os.path.join(
        DEVICE_CAPTURE_DIR,
        filename
    )

    content = await file.read()

    with open(filepath, "wb") as f:
        f.write(content)

    print("IMAGE RECEIVED:", filename)

    return {
        "status": "success",
        "filename": filename
    }


@app.post("/device-process")
async def device_process(
    file: UploadFile = File(...)
):

    import os
    import uuid

    os.makedirs(
        DEVICE_CAPTURE_DIR,
        exist_ok=True
    )

    filename = f"{uuid.uuid4()}.jpg"

    filepath = os.path.join(
        DEVICE_CAPTURE_DIR,
        filename
    )

    content = await file.read()
    content = align_face_image_bytes(content)

    with open(
        filepath,
        "wb"
    ) as f:

        f.write(content)

    print(
        "IMAGE RECEIVED:",
        filename
    )
    print("NORMALIZED IMAGE SAVED")

    return {
        "status": "success",
        "filename": filename
    }


@app.post("/register")
def register(data: dict):
    clinic_name = (data.get("clinic_name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not clinic_name or not email or not password:
        raise HTTPException(
            status_code=400,
            detail="nama klinik, email, dan password wajib diisi"
        )

    if len(password) < 6:
        raise HTTPException(
            status_code=400,
            detail="password minimal 6 karakter"
        )

    conn = open_db_or_error()

    if is_db_error(conn):
        return conn

    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(
            "SELECT id FROM users WHERE email=%s",
            (email,),
        )

        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="email sudah terdaftar")

        admin_username = generate_unique_username(cursor, clinic_name)

        cursor.execute(
            """
            INSERT INTO admins
            (clinic_name,email,password)
            VALUES (%s,%s,%s)
            """,
            (
                clinic_name,
                email,
                hash_password(password)
            )
        )

        admin_id = cursor.lastrowid
        cursor.execute(
            """
            INSERT INTO users (username,email,password,role,admin_id)
            VALUES (%s,%s,%s,'admin',%s)
            """,
            (
                admin_username,
                email,
                hash_password(password),
                admin_id,
            )
        )

        conn.commit()

        return {
            "message": "akun dibuat"
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    finally:
        cursor.close()
        conn.close()


@app.post("/login")
def login(data: dict):
    identifier = (data.get("email") or data.get("username") or "").strip().lower()
    password = data.get("password") or ""

    if not identifier or not password:
        raise HTTPException(
            status_code=400,
            detail="username/email dan password wajib diisi"
        )

    conn = open_db_or_error()

    if is_db_error(conn):
        return conn

    cursor = conn.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT
            users.*,
            admins.clinic_name,
            admins.phone,
            admins.address,
            admins.profile_image
        FROM users
        LEFT JOIN admins
        ON users.admin_id = admins.id
        WHERE users.email=%s OR users.username=%s
        """,
        (identifier, identifier)
    )

    user = cursor.fetchone()

    if not user or not verify_password(password, user["password"]):
        cursor.close()
        conn.close()

        raise HTTPException(
            status_code=401,
            detail="username/email atau password tidak sesuai"
        )

    if user["password"] == password:
        cursor.execute(
            """
            UPDATE users
            SET password=%s
            WHERE id=%s
            """,
            (hash_password(password), user["id"])
        )
        conn.commit()

    token = create_session_token(user)
    print("USER LOGIN SUCCESS", {"user_id": user["id"], "role": user["role"]})
    print("ROLE VALIDATED", {"user_id": user["id"], "role": user["role"]})

    cursor.close()
    conn.close()

    response = {
        "id": user.get("admin_id") if user["role"] == "admin" else user["id"],
        "user_id": user["id"],
        "username": user["username"],
        "email": user["email"],
        "role": user["role"],
        "token": token,
        "patient_id": user.get("patient_id"),
    }

    if user["role"] == "admin":
        response.update({
            "admin_id": user.get("admin_id"),
            "clinic": user.get("clinic_name"),
            "phone": user.get("phone"),
            "address": user.get("address"),
            "profile_image": user.get("profile_image")
        })

    return response

@app.get("/admin/{admin_id}")
def get_admin(admin_id: int, authorization: str | None = Header(None)):
    require_admin(authorization)
    conn = open_db_or_error()

    if is_db_error(conn):
        return conn

    cursor = conn.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT id, clinic_name, email, phone, address, profile_image
        FROM admins
        WHERE id=%s
        """,
        (admin_id,)
    )

    user = cursor.fetchone()

    cursor.close()
    conn.close()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="admin tidak ditemukan"
        )

    return {
        "id": user["id"],
        "clinic": user["clinic_name"],
        "email": user["email"],
        "phone": user.get("phone"),
        "address": user.get("address"),
        "profile_image": user.get("profile_image")
    }

@app.put("/admin/{admin_id}")
async def update_admin(
    admin_id: int,
    clinic_name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(""),
    address: str = Form(""),
    profile_image: UploadFile | None = File(None),
    authorization: str | None = Header(None),
):
    require_admin(authorization)
    clinic_name = clinic_name.strip()
    email = email.strip().lower()
    phone = phone.strip()
    address = address.strip()

    if not clinic_name or not email:
        raise HTTPException(
            status_code=400,
            detail="nama klinik dan email wajib diisi"
        )

    conn = open_db_or_error()

    if is_db_error(conn):
        return conn

    cursor = conn.cursor(dictionary=True)

    cursor.execute(
        "SELECT profile_image FROM admins WHERE id=%s",
        (admin_id,)
    )

    existing = cursor.fetchone()

    if not existing:
        cursor.close()
        conn.close()

        raise HTTPException(
            status_code=404,
            detail="admin tidak ditemukan"
        )

    image_filename = existing.get("profile_image")

    if profile_image and profile_image.filename:
        extension = os.path.splitext(profile_image.filename)[1] or ".jpg"
        image_filename = f"admin_{admin_id}_{uuid.uuid4()}{extension}"
        image_path = os.path.join("uploads", image_filename)

        with open(image_path, "wb") as file:
            file.write(await profile_image.read())

    try:
        cursor.execute(
            """
            UPDATE admins
            SET clinic_name=%s,
                email=%s,
                phone=%s,
                address=%s,
                profile_image=%s
            WHERE id=%s
            """,
            (
                clinic_name,
                email,
                phone,
                address,
                image_filename,
                admin_id
            )
        )

        cursor.execute(
            """
            UPDATE users
            SET email=%s
            WHERE admin_id=%s
            AND role='admin'
            """,
            (email, admin_id),
        )

        conn.commit()

    except Exception as e:
        cursor.close()
        conn.close()

        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    cursor.close()
    conn.close()

    return {
        "id": admin_id,
        "clinic": clinic_name,
        "email": email,
        "phone": phone,
        "address": address,
        "profile_image": image_filename
    }

# ===== REKOMENDASI (SIMPLE RULE) =====
INGREDIENTS = {
    "berminyak": ["Niacinamide", "Salicylic Acid"],
    "kombinasi": ["Niacinamide", "Hyaluronic Acid"],
    "normal": ["Vitamin C", "Ceramide"],
    "kering": ["Ceramide", "Hyaluronic Acid"],
    "sensitif": ["Centella", "Panthenol"],
}

PRODUCTS = {
    "berminyak": ["Gel Cleanser", "Oil-free Moisturizer"],
    "kombinasi": ["Gentle Cleanser", "Light Moisturizer"],
    "normal": ["Balanced Cleanser", "Daily Moisturizer"],
    "kering": ["Cream Cleanser", "Rich Moisturizer"],
    "sensitif": ["Soothing Cleanser", "Barrier Cream"],
}

TIPS = {
    "berminyak": ["Hindari produk terlalu berat", "Gunakan sunscreen"],
    "kombinasi": ["Gunakan produk ringan", "Eksfoliasi ringan"],
    "normal": ["Maintain routine", "Jaga hidrasi"],
    "kering": ["Hindari sabun keras", "Gunakan pelembap tebal"],
    "sensitif": ["Hindari fragrance", "Patch test dulu"],
}

# ===== PREPROCESS =====
def preprocess_bytes(img_bytes: bytes, size=(224, 224)) -> np.ndarray:
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    img = img.resize(size)
    arr = np.array(img).astype("float32") / 255.0
    arr = np.expand_dims(arr, axis=0)  # (1, H, W, 3)
    return arr

# ===== ENDPOINT =====
@app.post("/predict")
async def predict(file: UploadFile = File(...)) -> Dict:
    if not MODEL_READY or model is None:
        return {
            "status": "error",
            "message": "Model AI belum tersedia"
        }

    print("ANALYSIS START")

    # =========================
    # READ FILE
    # =========================
    img_bytes = await file.read()

    # =========================
    # GENERATE UNIQUE FILENAME
    # =========================
    filename = f"{uuid.uuid4()}.jpg"

    # =========================
    # SAVE TO uploads/
    # =========================
    filepath = os.path.join("uploads", filename)

    with open(filepath, "wb") as f:
        f.write(img_bytes)

    # =========================
    # AI PROCESS
    # =========================
    x = preprocess_bytes(img_bytes)

    preds = model.predict(x, verbose=0)[0]

    probs = {
        CLASSES[i]: float(preds[i])
        for i in range(len(CLASSES))
    }

    idx = int(np.argmax(preds))

    dominant = CLASSES[idx]

    confidence = float(np.max(preds))

    low_confidence = confidence < 0.6

    warning = None

    if low_confidence:
        warning = (
            "Analisis kurang akurat, "
            "disarankan scan ulang atau konsultasi."
        )

    print("PREDICT SUCCESS")
    write_activity_log(
        "predict",
        "Prediksi AI berhasil",
        f"Dominan {dominant}, confidence {round(confidence * 100)}%",
        "analysis",
        None,
    )

    return {
        "predictions": probs,
        "dominant": dominant,
        "confidence": confidence,
        "low_confidence": low_confidence,
        "warning": warning,

        "ingredients": INGREDIENTS[dominant],
        "products": PRODUCTS[dominant],
        "tips": TIPS[dominant],

        # =========================
        # RETURN IMAGE PATH
        # =========================
        "image_path": filename
    }

@app.post("/save-history")
async def save_history(data: dict, authorization: str | None = Header(None)):
    require_admin(authorization)
    conn = None
    cursor = None
    lock_name = None
    lock_acquired = False

    try:

        conn = open_db_or_error()

        if is_db_error(conn):
            return conn

        cursor = conn.cursor(dictionary=True)

        nama_pasien = data.get("nama_pasien")
        kode_pasien = data.get("kode_pasien")
        email_pasien = (data.get("email_pasien") or data.get("email") or "").strip().lower()

        if not nama_pasien or not kode_pasien:
            raise HTTPException(
                status_code=400,
                detail="nama_pasien dan kode_pasien wajib diisi"
            )

        conn.start_transaction()

        lock_name = f"skinai_patient_session_{kode_pasien}"

        cursor.execute(
            "SELECT GET_LOCK(%s, 10) AS locked",
            (lock_name,)
        )

        lock_result = cursor.fetchone()

        if not lock_result or lock_result["locked"] != 1:
            raise HTTPException(
                status_code=409,
                detail="data pasien sedang diproses, coba lagi"
            )

        lock_acquired = True

        # =========================
        # CEK PASIEN SUDAH ADA?
        # =========================
        cursor.execute(
            """
            SELECT *
            FROM patients
            WHERE kode_pasien = %s
            FOR UPDATE
            """,
            (kode_pasien,)
        )

        patient = cursor.fetchone()

        # =========================
        # JIKA BELUM ADA → INSERT
        # =========================
        if not patient:

            insert_patient = """
            INSERT INTO patients (
                kode_pasien,
                nama_pasien,
                email,
                paket_type
            )
            VALUES (%s,%s,%s,%s)
            """

            cursor.execute(
                insert_patient,
                (
                    kode_pasien,
                    nama_pasien,
                    email_pasien,
                    data.get("paket_type", "basic")
                )
            )

            patient_id = cursor.lastrowid
            session_number = 1

        else:

            patient_id = patient["id"]
            if email_pasien and not patient.get("email"):
                cursor.execute(
                    """
                    UPDATE patients
                    SET email=%s
                    WHERE id=%s
                    """,
                    (email_pasien, patient_id),
                )
            elif not email_pasien:
                email_pasien = patient.get("email") or ""

            # =========================
            # HITUNG SESSION BERIKUTNYA
            # =========================
            cursor.execute(
                """
                SELECT MAX(session_number)
                AS last_session
                FROM analysis_history
                WHERE patient_id = %s
                """,
                (patient_id,)
            )

            last_session = cursor.fetchone()

            if last_session["last_session"]:
                session_number = last_session["last_session"] + 1
            else:
                session_number = 1

        user_id, account_info = find_or_create_patient_user(
            cursor,
            nama_pasien,
            email_pasien,
            patient_id,
        )

        # =========================
        # INSERT ANALYSIS HISTORY
        # =========================
        sql = """
        INSERT INTO analysis_history (

            patient_id,
            session_number,
            user_id,

            nama_pasien,
            kode_pasien,

            image_path,
            dominant_skin_type,
            confidence,

            oily,
            dry_skin,
            combination_skin,
            normal_skin,
            sensitive_skin,

            ingredients,
            products,
            tips,
            exam_date

        )
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """

        values = (

            patient_id,
            session_number,
            user_id,

            nama_pasien,
            kode_pasien,

            data.get("image_path"),

            data.get("dominant_skin_type"),
            data.get("confidence"),

            data.get("oily"),
            data.get("dry_skin"),
            data.get("combination_skin"),
            data.get("normal_skin"),
            data.get("sensitive_skin"),

            ",".join(data.get("ingredients", [])),
            ",".join(data.get("products", [])),
            ",".join(data.get("tips", [])),
            data.get("tanggal") or data.get("exam_date")
        )

        cursor.execute(sql, values)
        history_id = cursor.lastrowid

        conn.commit()

        print(
            "SAVE HISTORY SUCCESS",
            {
                "history_id": history_id,
                "patient_id": patient_id,
                "user_id": user_id,
                "session_number": session_number,
                "kode_pasien": kode_pasien,
            }
        )

        write_activity_log(
            "save_history",
            "Hasil analisis tersimpan",
            f"{nama_pasien} session {session_number}",
            "history",
            history_id,
        )

        return {
            "success": True,
            "message": "History berhasil disimpan",
            "history_id": history_id,
            "patient_id": patient_id,
            "user_id": user_id,
            "session_number": session_number,
            "account_created": account_info is not None,
            "account_info": account_info
        }

    except HTTPException:
        if conn and not is_db_error(conn):
            conn.rollback()

        raise

    except Exception as e:

        if conn and not is_db_error(conn):
            conn.rollback()

        print("save-history error:", str(e))

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        if lock_acquired and cursor:
            try:
                cursor.execute(
                    "SELECT RELEASE_LOCK(%s) AS released",
                    (lock_name,)
                )
                cursor.fetchone()
            except Exception as error:
                print("release-lock warning:", str(error))

        if cursor:
            cursor.close()

        if conn and not is_db_error(conn):
            conn.close()
    
@app.get("/history")
def get_history(authorization: str | None = Header(None)):
    require_admin(authorization)

    conn = open_db_or_error()

    if is_db_error(conn):
        return conn

    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT
            analysis_history.*,
            patients.paket_type

        FROM analysis_history

        LEFT JOIN patients
        ON analysis_history.patient_id = patients.id

        ORDER BY analysis_history.created_at DESC
    """)

    rows = cursor.fetchall()

    print("history rows:", len(rows))

    cursor.close()
    conn.close()

    return rows

@app.get("/patients")
def get_patients(authorization: str | None = Header(None)):
    require_admin(authorization)

    conn = open_db_or_error()

    if is_db_error(conn):
        return conn

    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT
            patients.*,
            history_counts.history_count
        FROM patients
        INNER JOIN (
            SELECT patient_id, COUNT(*) AS history_count
            FROM analysis_history
            GROUP BY patient_id
        ) AS history_counts
        ON history_counts.patient_id = patients.id
        WHERE UPPER(COALESCE(patients.nama_pasien, '')) NOT LIKE '%FLOW DEBUG%'
        AND UPPER(COALESCE(patients.nama_pasien, '')) NOT LIKE '%FLOW AUDIT%'
        AND UPPER(COALESCE(patients.nama_pasien, '')) NOT LIKE '%TEST%'
        ORDER BY patients.created_at DESC
    """)

    patients = cursor.fetchall()

    print("patients rows:", len(patients))

    cursor.close()
    conn.close()

    return patients

@app.delete("/maintenance/patients/orphan-debug-test")
def cleanup_orphan_debug_test_patients(confirm: bool = False):

    conn = open_db_or_error()

    if is_db_error(conn):
        return conn

    cursor = conn.cursor(dictionary=True)

    candidate_sql = """
        SELECT
            patients.id,
            patients.kode_pasien,
            patients.nama_pasien,
            patients.created_at,
            COALESCE(history_counts.history_count, 0) AS history_count
        FROM patients
        LEFT JOIN (
            SELECT patient_id, COUNT(*) AS history_count
            FROM analysis_history
            GROUP BY patient_id
        ) AS history_counts
        ON history_counts.patient_id = patients.id
        WHERE history_counts.patient_id IS NULL
        OR UPPER(COALESCE(patients.nama_pasien, '')) LIKE '%FLOW DEBUG%'
        OR UPPER(COALESCE(patients.nama_pasien, '')) LIKE '%FLOW AUDIT%'
        OR UPPER(COALESCE(patients.nama_pasien, '')) LIKE '%TEST%'
        ORDER BY patients.created_at DESC
    """

    cursor.execute(candidate_sql)
    candidates = cursor.fetchall()

    if not confirm:
        cursor.close()
        conn.close()

        return {
            "success": True,
            "message": "Preview cleanup pasien. Tambahkan ?confirm=true untuk menghapus.",
            "deleted": False,
            "count": len(candidates),
            "patients": candidates,
        }

    candidate_ids = [patient["id"] for patient in candidates]

    if candidate_ids:
        placeholders = ",".join(["%s"] * len(candidate_ids))
        cursor.execute(
            f"DELETE FROM patients WHERE id IN ({placeholders})",
            tuple(candidate_ids),
        )
        conn.commit()

    write_activity_log(
        "cleanup_patients",
        "Cleanup pasien orphan/debug/test",
        f"{len(candidate_ids)} pasien dihapus",
        "patients",
        None,
    )

    cursor.close()
    conn.close()

    return {
        "success": True,
        "message": "Cleanup pasien selesai",
        "deleted": True,
        "count": len(candidate_ids),
        "patients": candidates,
    }

@app.delete("/delete-history/{history_id}")
def delete_history(history_id: int, authorization: str | None = Header(None)):
    require_admin(authorization)

    conn = open_db_or_error()

    if is_db_error(conn):
        return conn

    cursor = conn.cursor()

    sql = "DELETE FROM analysis_history WHERE id = %s"

    cursor.execute(sql, (history_id,))

    conn.commit()

    write_activity_log(
        "delete_history",
        "History dihapus",
        f"History ID {history_id}",
        "history",
        history_id,
    )

    cursor.close()
    conn.close()

    return {
        "success": True,
        "message": "History berhasil dihapus"
    }

@app.get("/history/{history_id}")
def get_history_detail(history_id: int, authorization: str | None = Header(None)):
    current_user = get_current_user(authorization)

    conn = open_db_or_error()

    if is_db_error(conn):
        return conn

    cursor = conn.cursor(dictionary=True)

    sql = """
        SELECT
            analysis_history.*,
            patients.paket_type
        FROM analysis_history
        LEFT JOIN patients
        ON analysis_history.patient_id = patients.id
        WHERE analysis_history.id = %s
    """

    if current_user["role"] == "user":
        sql += " AND analysis_history.user_id = %s"
        params = (history_id, current_user["id"])
    else:
        print("ROLE VALIDATED", {"user_id": current_user["id"], "role": current_user["role"]})
        params = (history_id,)

    cursor.execute(sql, params)

    data = cursor.fetchone()

    cursor.close()
    conn.close()

    if current_user["role"] == "user":
        print("PDF ACCESS VALID", {"user_id": current_user["id"], "history_id": history_id})
        if not data:
            raise HTTPException(status_code=403, detail="data pemeriksaan bukan milik user")

    return data

@app.get("/patient/{patient_id}")
def get_patient_detail(patient_id: int, authorization: str | None = Header(None)):
    require_admin(authorization)

    conn = open_db_or_error()

    if is_db_error(conn):
        return conn

    cursor = conn.cursor(dictionary=True)

    # GET DATA PASIEN
    cursor.execute("""
        SELECT *
        FROM patients
        WHERE id = %s
    """, (patient_id,))

    patient = cursor.fetchone()

    if not patient:
        cursor.close()
        conn.close()

        raise HTTPException(
            status_code=404,
            detail="Pasien tidak ditemukan"
        )

    # GET SESSION HISTORY
    cursor.execute("""
        SELECT *
        FROM analysis_history
        WHERE patient_id = %s
        ORDER BY session_number ASC
    """, (patient_id,))

    sessions = cursor.fetchall()

    cursor.close()
    conn.close()

    return {
        "patient": patient,
        "sessions": sessions
    }


@app.get("/user/dashboard")
def get_user_dashboard(authorization: str | None = Header(None)):
    current_user = require_patient_user(authorization)
    print("USER DASHBOARD ACCESS", {"user_id": current_user["id"]})

    conn = open_db_or_error()

    if is_db_error(conn):
        return conn

    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        """
        SELECT
            analysis_history.*,
            patients.paket_type,
            patients.email AS patient_email
        FROM analysis_history
        LEFT JOIN patients
        ON analysis_history.patient_id = patients.id
        WHERE analysis_history.user_id = %s
        ORDER BY analysis_history.created_at DESC
        """,
        (current_user["id"],),
    )
    history = cursor.fetchall()
    cursor.close()
    conn.close()

    return {
        "profile": {
            "user_id": current_user["id"],
            "username": current_user["username"],
            "full_name": current_user.get("full_name") or current_user["username"],
            "email": current_user["email"],
            "phone": current_user.get("phone"),
            "patient_id": current_user.get("patient_id"),
        },
        "latest": history[0] if history else None,
        "total": len(history),
    }


@app.get("/user/history")
def get_user_history(authorization: str | None = Header(None)):
    current_user = require_patient_user(authorization)

    conn = open_db_or_error()

    if is_db_error(conn):
        return conn

    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        """
        SELECT
            analysis_history.*,
            patients.paket_type,
            patients.email AS patient_email
        FROM analysis_history
        LEFT JOIN patients
        ON analysis_history.patient_id = patients.id
        WHERE analysis_history.user_id = %s
        ORDER BY analysis_history.created_at DESC
        """,
        (current_user["id"],),
    )
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    return rows


@app.get("/user/history/{history_id}")
def get_user_history_detail(history_id: int, authorization: str | None = Header(None)):
    current_user = require_patient_user(authorization)

    conn = open_db_or_error()

    if is_db_error(conn):
        return conn

    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        """
        SELECT
            analysis_history.*,
            patients.paket_type,
            patients.email AS patient_email
        FROM analysis_history
        LEFT JOIN patients
        ON analysis_history.patient_id = patients.id
        WHERE analysis_history.id = %s
        AND analysis_history.user_id = %s
        """,
        (history_id, current_user["id"]),
    )
    data = cursor.fetchone()
    cursor.close()
    conn.close()

    if not data:
        raise HTTPException(status_code=403, detail="data pemeriksaan bukan milik user")

    print("PDF ACCESS VALID", {"user_id": current_user["id"], "history_id": history_id})

    return data


@app.get("/user/profile")
def get_user_profile(authorization: str | None = Header(None)):
    current_user = require_patient_user(authorization)

    conn = open_db_or_error()

    if is_db_error(conn):
        return conn

    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        """
        SELECT
            users.id,
            users.username,
            users.full_name,
            users.email,
            users.phone,
            users.patient_id,
            patients.nama_pasien,
            patients.kode_pasien
        FROM users
        LEFT JOIN patients
        ON users.patient_id = patients.id
        WHERE users.id = %s
        """,
        (current_user["id"],),
    )
    profile = cursor.fetchone()
    cursor.close()
    conn.close()

    if not profile:
        raise HTTPException(status_code=404, detail="profile tidak ditemukan")

    return {
        "user_id": profile["id"],
        "username": profile["username"],
        "full_name": profile.get("full_name") or profile.get("nama_pasien") or profile["username"],
        "email": profile["email"],
        "phone": profile.get("phone") or "",
        "patient_id": profile.get("patient_id"),
        "kode_pasien": profile.get("kode_pasien"),
    }


@app.put("/user/profile")
def update_user_profile(data: dict, authorization: str | None = Header(None)):
    current_user = require_patient_user(authorization)
    full_name = (data.get("full_name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    phone = (data.get("phone") or "").strip()
    password = data.get("password") or ""

    if not full_name:
        raise HTTPException(status_code=400, detail="nama wajib diisi")

    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="email tidak valid")

    if password and len(password) < 6:
        raise HTTPException(status_code=400, detail="password minimal 6 karakter")

    conn = open_db_or_error()

    if is_db_error(conn):
        return conn

    cursor = conn.cursor(dictionary=True)

    try:
        conn.start_transaction()
        cursor.execute(
            """
            SELECT id
            FROM users
            WHERE email=%s
            AND id<>%s
            FOR UPDATE
            """,
            (email, current_user["id"]),
        )

        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="email sudah digunakan")

        update_fields = ["full_name=%s", "email=%s", "phone=%s"]
        values = [full_name, email, phone]

        if password:
            update_fields.append("password=%s")
            values.append(hash_password(password))

        values.append(current_user["id"])
        cursor.execute(
            f"""
            UPDATE users
            SET {", ".join(update_fields)}
            WHERE id=%s
            """,
            tuple(values),
        )

        if current_user.get("patient_id"):
            cursor.execute(
                """
                UPDATE patients
                SET nama_pasien=%s,
                    email=%s
                WHERE id=%s
                """,
                (full_name, email, current_user["patient_id"]),
            )

            cursor.execute(
                """
                UPDATE analysis_history
                SET nama_pasien=%s
                WHERE user_id=%s
                """,
                (full_name, current_user["id"]),
            )

        conn.commit()

    except HTTPException:
        conn.rollback()
        raise
    except Exception as error:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(error))
    finally:
        cursor.close()
        conn.close()

    print("USER PROFILE UPDATED", {"user_id": current_user["id"]})

    return {
        "success": True,
        "user_id": current_user["id"],
        "username": current_user["username"],
        "full_name": full_name,
        "email": email,
        "phone": phone,
        "role": "user",
        "patient_id": current_user.get("patient_id"),
    }
