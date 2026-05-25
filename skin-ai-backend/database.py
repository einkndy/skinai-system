import mysql.connector
from mysql.connector import Error

DB_HOST = "localhost"
DB_USER = "root"
DB_PASSWORD = ""
DB_NAME = "skinanalyzer_db"


def get_db_connection():
    try:
        connection = mysql.connector.connect(
            host=DB_HOST,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            autocommit=False,
            connection_timeout=5,
        )

        connection.ping(
            reconnect=True,
            attempts=3,
            delay=2,
        )

        return connection

    except Error as error:
        print("MYSQL ERROR:", error)

        return {
            "status": "error",
            "message": "Database belum aktif",
        }


def is_db_error(connection):
    return isinstance(connection, dict) and connection.get("status") == "error"


def ensure_columns(cursor, table_name, columns):
    cursor.execute(
        """
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = %s
        """,
        (table_name,),
    )

    existing_columns = {
        row["COLUMN_NAME"]
        for row in cursor.fetchall()
    }

    for column_name, column_type in columns.items():
        if column_name not in existing_columns:
            cursor.execute(
                f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"
            )


def ensure_unique_index(cursor, table_name, index_name, columns):
    cursor.execute(
        """
        SELECT COUNT(*) AS total
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = %s
        AND INDEX_NAME = %s
        """,
        (table_name, index_name),
    )

    existing = cursor.fetchone()

    if existing["total"]:
        return

    try:
        cursor.execute(
            f"CREATE UNIQUE INDEX {index_name} ON {table_name} ({columns})"
        )
    except Error as error:
        print(f"INDEX WARNING {index_name}:", error)


def init_database():
    db = get_db_connection()

    if is_db_error(db):
        print(db["message"])
        return

    cursor = db.cursor(dictionary=True)

    print("MYSQL CONNECTED")
    print(f"MYSQL HOST: {DB_HOST}")
    print(f"MYSQL USER: {DB_USER}")
    print(f"MYSQL DATABASE: {DB_NAME}")

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS admins(
            id INT AUTO_INCREMENT PRIMARY KEY,
            clinic_name TEXT,
            email VARCHAR(255) UNIQUE,
            password TEXT,
            phone VARCHAR(50),
            address TEXT,
            profile_image TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS users(
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(100) UNIQUE,
            full_name VARCHAR(255),
            email VARCHAR(255) UNIQUE,
            password TEXT,
            phone VARCHAR(50),
            role VARCHAR(20) DEFAULT 'admin',
            admin_id INT NULL,
            patient_id INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX(role),
            INDEX(patient_id)
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS patients(
            id INT AUTO_INCREMENT PRIMARY KEY,
            kode_pasien VARCHAR(100) UNIQUE,
            nama_pasien TEXT,
            email VARCHAR(255),
            paket_type VARCHAR(50) DEFAULT 'basic',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS analysis_history(
            id INT AUTO_INCREMENT PRIMARY KEY,
            patient_id INT,
            session_number INT DEFAULT 1,
            user_id INT NULL,
            nama_pasien TEXT,
            kode_pasien VARCHAR(100),
            image_path TEXT,
            dominant_skin_type VARCHAR(100),
            confidence FLOAT,
            oily FLOAT,
            dry_skin FLOAT,
            combination_skin FLOAT,
            normal_skin FLOAT,
            sensitive_skin FLOAT,
            ingredients TEXT,
            products TEXT,
            tips TEXT,
            exam_date DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX(patient_id)
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS activity_logs(
            id INT AUTO_INCREMENT PRIMARY KEY,
            event_type VARCHAR(100),
            title VARCHAR(255),
            detail TEXT,
            entity_type VARCHAR(100),
            entity_id INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS devices(
            id INT AUTO_INCREMENT PRIMARY KEY,
            device_id VARCHAR(100) UNIQUE,
            device_name VARCHAR(255),
            device_type VARCHAR(100),
            ip_address VARCHAR(100),
            stream_url TEXT,
            capture_url TEXT,
            status VARCHAR(50) DEFAULT 'unknown',
            firmware_version VARCHAR(100),
            last_seen TIMESTAMP NULL,
            location VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP
        )
        """
    )

    ensure_columns(
        cursor,
        "admins",
        {
            "phone": "VARCHAR(50)",
            "address": "TEXT",
            "profile_image": "TEXT",
        },
    )

    ensure_columns(
        cursor,
        "users",
        {
            "username": "VARCHAR(100)",
            "full_name": "VARCHAR(255)",
            "email": "VARCHAR(255)",
            "password": "TEXT",
            "phone": "VARCHAR(50)",
            "role": "VARCHAR(20) DEFAULT 'admin'",
            "admin_id": "INT NULL",
            "patient_id": "INT NULL",
            "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        },
    )

    ensure_columns(
        cursor,
        "patients",
        {
            "kode_pasien": "VARCHAR(100)",
            "nama_pasien": "TEXT",
            "email": "VARCHAR(255)",
            "paket_type": "VARCHAR(50) DEFAULT 'basic'",
            "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        },
    )

    ensure_columns(
        cursor,
        "analysis_history",
        {
            "patient_id": "INT",
            "session_number": "INT DEFAULT 1",
            "user_id": "INT NULL",
            "nama_pasien": "TEXT",
            "kode_pasien": "VARCHAR(100)",
            "image_path": "TEXT",
            "dominant_skin_type": "VARCHAR(100)",
            "confidence": "FLOAT",
            "oily": "FLOAT",
            "dry_skin": "FLOAT",
            "combination_skin": "FLOAT",
            "normal_skin": "FLOAT",
            "sensitive_skin": "FLOAT",
            "ingredients": "TEXT",
            "products": "TEXT",
            "tips": "TEXT",
            "exam_date": "DATE",
            "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        },
    )

    ensure_columns(
        cursor,
        "activity_logs",
        {
            "event_type": "VARCHAR(100)",
            "title": "VARCHAR(255)",
            "detail": "TEXT",
            "entity_type": "VARCHAR(100)",
            "entity_id": "INT",
            "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        },
    )

    ensure_columns(
        cursor,
        "devices",
        {
            "device_id": "VARCHAR(100)",
            "device_name": "VARCHAR(255)",
            "device_type": "VARCHAR(100)",
            "ip_address": "VARCHAR(100)",
            "stream_url": "TEXT",
            "capture_url": "TEXT",
            "status": "VARCHAR(50) DEFAULT 'unknown'",
            "firmware_version": "VARCHAR(100)",
            "last_seen": "TIMESTAMP NULL",
            "location": "VARCHAR(255)",
            "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            "updated_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
        },
    )

    ensure_unique_index(
        cursor,
        "users",
        "uniq_users_username",
        "username",
    )

    ensure_unique_index(
        cursor,
        "users",
        "uniq_users_email",
        "email",
    )

    ensure_unique_index(
        cursor,
        "analysis_history",
        "uniq_patient_session",
        "patient_id, session_number",
    )

    ensure_unique_index(
        cursor,
        "devices",
        "uniq_device_id",
        "device_id",
    )

    cursor.execute(
        """
        UPDATE users
        SET role = 'admin'
        WHERE role IS NULL OR role = ''
        """
    )

    cursor.execute(
        """
        INSERT IGNORE INTO users (username, email, password, role, admin_id)
        SELECT
            CONCAT(
                LOWER(REPLACE(COALESCE(NULLIF(clinic_name, ''), SUBSTRING_INDEX(email, '@', 1)), ' ', '_')),
                '_',
                id
            ),
            email,
            password,
            'admin',
            id
        FROM admins
        WHERE email IS NOT NULL AND email <> ''
        """
    )

    db.commit()
    cursor.close()
    db.close()

    print("TABLE LOADED")
    print("MYSQL READY")


init_database()
