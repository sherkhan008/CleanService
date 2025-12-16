from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base, Session

# Single, SQLite-only database configuration for TazaBolsyn.
# The database file will be created in the project root directory.
DATABASE_URL = "sqlite:///./tazabolsyn.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # required by SQLite when used with multiple threads
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that provides a SQLAlchemy session and ensures it is closed.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    """
    Context manager for manual session management (e.g. in scripts).
    """
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


