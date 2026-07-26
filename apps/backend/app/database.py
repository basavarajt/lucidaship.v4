"""
Database connection & table management.
Uses the SQLAlchemy `engine` defined in `app.db.session` for persistent storage.
Falls back to local SQLite (via the same engine) for development when `DATABASE_URL` is not set.
"""

import logging
from sqlalchemy import text
from app.core.config import get_settings
from app.db.session import engine, init_sqlalchemy

logger = logging.getLogger(__name__)
settings = get_settings()


# Simple engine-backed wrapper to provide a compatible execute(...).rows API
class EngineWrapper:
    def __init__(self, eng):
        self.engine = eng

    def execute(self, sql, args=None):
        args = args or []
        # Use raw DBAPI cursor to preserve original parameter style (e.g., `?` for SQLite)
        raw = self.engine.raw_connection()
        try:
            cur = raw.cursor()
            cur.execute(sql, args)
            try:
                rows = cur.fetchall()
            except Exception:
                rows = []
            raw.commit()
        finally:
            try:
                cur.close()
            except Exception:
                pass
            try:
                raw.close()
            except Exception:
                pass
        class Result:
            def __init__(self, rows):
                self.rows = rows
        return Result(rows)

    def close(self):
        # engine is shared; nothing to close here
        pass


_connection = None


def get_db():
    """Return an engine-backed DB accessor. In production, `DATABASE_URL` must be set,
    unless `ALLOW_PRODUCTION_SQLITE_FALLBACK` is true.
    """
    global _connection
    if _connection is None:
        if settings.is_production and not settings.DATABASE_URL and not settings.ALLOW_PRODUCTION_SQLITE_FALLBACK:
            raise RuntimeError(
                "Production registry database is not configured. Set DATABASE_URL to a managed SQL instance "
                "or set ALLOW_PRODUCTION_SQLITE_FALLBACK=true for temporary testing."
            )

        _connection = EngineWrapper(engine)

    return _connection


def close_db():
    global _connection
    if _connection is not None:
        try:
            _connection.close()
        except Exception:
            pass
        _connection = None
    engine.dispose()


def init_db():
    """
    Create all tables on startup. Uses SQL-compatible DDL statements.
    Safe to call multiple times (CREATE TABLE IF NOT EXISTS).
    """
    conn = get_db()

    tables = [
        """
        CREATE TABLE IF NOT EXISTS tenants (
            id TEXT PRIMARY KEY,
            clerk_org_id TEXT UNIQUE,
            name TEXT NOT NULL,
            plan TEXT DEFAULT 'free',
            created_at TEXT DEFAULT (datetime('now'))
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            clerk_user_id TEXT UNIQUE NOT NULL,
            tenant_id TEXT NOT NULL,
            email TEXT NOT NULL,
            role TEXT DEFAULT 'admin',
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (tenant_id) REFERENCES tenants(id)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS training_runs (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            model_name TEXT NOT NULL,
            artifact_path TEXT NOT NULL,
            metrics TEXT,
            row_count INTEGER,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (tenant_id) REFERENCES tenants(id)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS scored_leads (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            training_run_id TEXT,
            lead_data TEXT NOT NULL,
            lead_signature TEXT,
            model_name TEXT,
            ranking_version TEXT,
            profile_score REAL,
            engagement_score REAL,
            final_score REAL,
            scored_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (tenant_id) REFERENCES tenants(id)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS feedback_events (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            training_run_id TEXT,
            model_name TEXT NOT NULL,
            lead_signature TEXT NOT NULL,
            actual_outcome INTEGER NOT NULL,
            predicted_score REAL,
            score_band TEXT,
            rank_at_score_time INTEGER,
            feedback_source TEXT DEFAULT 'csv_upload',
            feedback_at TEXT DEFAULT (datetime('now')),
            lead_data TEXT,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id)
        )
        """,
    ]

    for sql in tables:
        conn.execute(sql)

    alter_statements = [
        "ALTER TABLE scored_leads ADD COLUMN lead_signature TEXT",
        "ALTER TABLE scored_leads ADD COLUMN model_name TEXT",
        "ALTER TABLE scored_leads ADD COLUMN ranking_version TEXT",
        "ALTER TABLE tenants ADD COLUMN credits INTEGER DEFAULT 1000",
        "ALTER TABLE tenants ADD COLUMN dodo_customer_id TEXT",
        "ALTER TABLE tenants ADD COLUMN free_runs_used INTEGER DEFAULT 0",
        "ALTER TABLE tenants ADD COLUMN deleted_at TEXT",
        "ALTER TABLE users ADD COLUMN deleted_at TEXT",
    ]
    for sql in alter_statements:
        try:
            conn.execute(sql)
        except Exception:
            pass

    init_sqlalchemy()

    logger.info("Database tables initialized")


def check_db_connectivity() -> bool:
    """Test DB connectivity with SELECT 1. Returns True if healthy."""
    try:
        conn = get_db()
        result = conn.execute("SELECT 1")
        with engine.connect() as sqlalchemy_conn:
            sqlalchemy_conn.execute(text("SELECT 1"))
        return len(result.rows) > 0
    except Exception as e:
        logger.error("Database connectivity check failed: %s", e)
        return False
