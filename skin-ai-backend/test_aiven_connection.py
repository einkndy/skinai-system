import os

import mysql.connector
from dotenv import load_dotenv


load_dotenv()


def env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)

    if value is None:
        return default

    return value.strip().lower() in {"1", "true", "yes", "on"}


def get_connection_options():
    ssl_mode = os.getenv("DB_SSL_MODE", "REQUIRED").strip().upper()
    ssl_ca = os.getenv("DB_SSL_CA", "").strip()

    options = {
        "host": os.getenv("DB_HOST", "localhost"),
        "port": env_int("DB_PORT", 3306),
        "user": os.getenv("DB_USER", "root"),
        "password": os.getenv("DB_PASSWORD", ""),
        "database": os.getenv("DB_NAME", "skinanalyzer_db"),
        "autocommit": False,
        "connection_timeout": env_int("DB_CONNECTION_TIMEOUT", 30),
    }

    if ssl_mode != "DISABLED":
        options["ssl_disabled"] = False
        options["ssl_verify_cert"] = env_bool("DB_SSL_VERIFY_CERT")

        if ssl_ca:
            options["ssl_ca"] = ssl_ca

    return options


def print_safe_config(options):
    print(
        "DB TEST CONFIG:",
        {
            "host": options["host"],
            "port": options["port"],
            "user": options["user"],
            "database": options["database"],
            "password_set": bool(options["password"]),
            "ssl_disabled": options.get("ssl_disabled"),
            "ssl_ca_set": bool(options.get("ssl_ca")),
            "ssl_verify_cert": options.get("ssl_verify_cert"),
            "connection_timeout": options["connection_timeout"],
        },
    )


def main():
    options = get_connection_options()
    print_safe_config(options)

    connection = mysql.connector.connect(**options)
    cursor = connection.cursor()

    try:
        cursor.execute("SELECT 1")
        result = cursor.fetchone()
        print("SELECT 1:", result[0])
        print("Database connected")
    finally:
        cursor.close()
        connection.close()


if __name__ == "__main__":
    main()
