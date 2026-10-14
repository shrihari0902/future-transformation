```python
from urllib.parse import unquote, urlparse

import pymysql
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings


def get_database_url() -> str:
    """Ensure SQLAlchemy uses the PyMySQL driver."""
    database_url = settings.DATABASE_URL.strip()

    if database_url.startswith("mysql://"):
        database_url = database_url.replace(
            "mysql://", "mysql+pymysql://", 1
        )
    elif database_url.startswith("mysql+mysqldb://"):
        database_url = database_url.replace(
            "mysql+mysqldb://", "mysql+pymysql://", 1
        )

    if not database_url.startswith("mysql+pymysql://"):
        raise RuntimeError(
            "DATABASE_URL must use mysql+pymysql:// or mysql://."
        )

    return database_url


DATABASE_URL = get_database_url()


def ensure_database_exists() -> None:
    """Create the configured MySQL database if permitted."""
    parsed = urlparse(DATABASE_URL)

    database_name = unquote(parsed.path.lstrip("/"))

    if not database_name:
        raise RuntimeError(
            "DATABASE_URL must include a database name."
        )

    connection = pymysql.connect(
        host=parsed.hostname or "127.0.0.1",
        port=parsed.port or 3306,
        user=unquote(parsed.username or ""),
        password=unquote(parsed.password or ""),
        connect_timeout=10,
        charset="utf8mb4",
    )

    try:
        # Database names cannot be passed as SQL parameters.
        # Escape backticks before using the name in this statement.
        safe_database_name = database_name.replace("`", "``")

        with connection.cursor() as cursor:
            cursor.execute(
                f"CREATE DATABASE IF NOT EXISTS "
                f"`{safe_database_name}` "
                "CHARACTER SET utf8mb4 "
                "COLLATE utf8mb4_unicode_ci"
            )

        connection.commit()
    finally:
        connection.close()


ensure_database_exists()


engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=3600,
    pool_size=10,
    max_overflow=20,
)


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


Base = declarative_base()


def get_db():
    """Provide a database session to API routes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```