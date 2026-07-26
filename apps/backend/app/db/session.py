"""SQLAlchemy engine and session management."""

from __future__ import annotations

from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


settings = get_settings()


def _default_database_url() -> str:
    sqlite_path = settings.SQLITE_DB_PATH.replace("\\", "/")
    return f"sqlite:///{sqlite_path}"


DATABASE_URL = settings.DATABASE_URL or _default_database_url()

# Ensure the SQLite directory exists (critical for Cloud Run where /home/lucida/Lucida/ doesn't pre-exist)
if DATABASE_URL.startswith("sqlite"):
    import pathlib
    db_path = DATABASE_URL.replace("sqlite:///", "")
    pathlib.Path(db_path).parent.mkdir(parents=True, exist_ok=True)

CONNECT_ARGS = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    future=True,
    pool_pre_ping=True,
    connect_args=CONNECT_ARGS,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False, class_=Session)


class Base(DeclarativeBase):
    """Declarative base for ORM models."""


def get_session() -> Generator[Session, None, None]:
    """FastAPI dependency for database sessions."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    """Context manager for service-layer DB work."""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_sqlalchemy() -> None:
    """Create ORM-managed tables."""
    from app.models.entities import Feedback, Lead, LeadModel, LeadScore, LeadSignal  # noqa: F401

    Base.metadata.create_all(bind=engine)

