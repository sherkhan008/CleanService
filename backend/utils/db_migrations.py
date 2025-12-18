from __future__ import annotations

from sqlalchemy import Engine, text


def _sqlite_has_column(conn, table_name: str, column_name: str) -> bool:
    rows = conn.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
    # PRAGMA table_info returns: cid, name, type, notnull, dflt_value, pk
    return any(r[1] == column_name for r in rows)


def apply_sqlite_migrations(engine: Engine) -> None:
    """
    Lightweight SQLite migrations for dev/demo (no Alembic).
    Safe to call multiple times.
    """
    with engine.begin() as conn:
        # ---- users table ----
        # Add is_totp_enabled flag.
        if _sqlite_has_column(conn, "users", "id"):
            if not _sqlite_has_column(conn, "users", "phone"):
                conn.execute(text("ALTER TABLE users ADD COLUMN phone VARCHAR(50)"))
            if not _sqlite_has_column(conn, "users", "is_totp_enabled"):
                conn.execute(
                    text(
                        "ALTER TABLE users ADD COLUMN is_totp_enabled BOOLEAN NOT NULL DEFAULT 0"
                    )
                )
                # Preserve old behavior: if a user already has totp_secret set, treat as enabled.
                conn.execute(
                    text(
                        "UPDATE users SET is_totp_enabled = 1 WHERE totp_secret IS NOT NULL"
                    )
                )

        # ---- addresses table ----
        if _sqlite_has_column(conn, "addresses", "id"):
            if not _sqlite_has_column(conn, "addresses", "latitude"):
                conn.execute(text("ALTER TABLE addresses ADD COLUMN latitude FLOAT"))
            if not _sqlite_has_column(conn, "addresses", "longitude"):
                conn.execute(text("ALTER TABLE addresses ADD COLUMN longitude FLOAT"))

        # ---- orders table ----
        if _sqlite_has_column(conn, "orders", "id"):
            if not _sqlite_has_column(conn, "orders", "latitude"):
                conn.execute(text("ALTER TABLE orders ADD COLUMN latitude FLOAT"))
            if not _sqlite_has_column(conn, "orders", "longitude"):
                conn.execute(text("ALTER TABLE orders ADD COLUMN longitude FLOAT"))


