from urllib.parse import unquote, urlparse

import pymysql
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings


def ensure_database_exists() -> None:
    """Create the configured MySQL database when the account has permission."""
    parsed = urlparse(settings.DATABASE_URL)
    if parsed.scheme not in {"mysql", "mysql+pymysql"}:
        raise RuntimeError(
            "DATABASE_URL must use mysql+pymysql, for example: "
            "mysql+pymysql://<user>:<password>@127.0.0.1:3306/offline_payments"
        )

    database_name = parsed.path.lstrip("/")
    if not database_name:
        raise RuntimeError("DATABASE_URL must include a database name.")

    connection = pymysql.connect(
        host=parsed.hostname or "127.0.0.1",
        port=parsed.port or 3306,
        user=unquote(parsed.username or ""),
        password=unquote(parsed.password or ""),
        connect_timeout=5,
    )
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                f"CREATE DATABASE IF NOT EXISTS `{database_name}` "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
        connection.commit()
    finally:
        connection.close()


ensure_database_exists()

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=3600,
    pool_size=10,
    max_overflow=20,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()