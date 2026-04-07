"""
Database connection & table management for Turso (libSQL).
Uses libsql_client with raw SQL — no SQLAlchemy.
"""

import logging
import libsql_client
import sqlite3

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# ── Module-level connection (lazy init) ─────────────────────────
_connection = None

class SqliteWrapper:
    """A wrapper mimicking the basic execute().rows signature of libsql_client."""
    def __init__(self, path):
        self.conn = sqlite3.connect(path, check_same_thread=False)
    def execute(self, sql, args=None):
        if args is None: args = []
        cur = self.conn.execute(sql, args)
        self.conn.commit()
        class Result:
            def __init__(self, rows):
                self.rows = rows
        return Result(cur.fetchall())
    def close(self):
        self.conn.close()

def get_db():
    """
    Return a libsql_client to Turso, or sqlite3 wrapper locally.
    Re-uses a module-level connection for efficiency.
    """
    global _connection
    if _connection is None:
        url = settings.TURSO_DATABASE_URL
        token = settings.TURSO_AUTH_TOKEN

        if url and token:
            if url.startswith("libsql://"):
                url = url.replace("libsql://", "https://")
            
            # Remote Turso database
            _connection = libsql_client.create_client_sync(
                url=url,
                auth_token=token,
            )
            logger.info("Connected to Turso: %s", url.split("@")[-1] if "@" in url else url[:40])
        else:
            # Local SQLite fallback for development without Turso
            _connection = SqliteWrapper("lucida_local.db")
            logger.warning("No Turso credentials — using local SQLite fallback")

    return _connection

def close_db():
    global _connection
    if _connection is not None:
        _connection.close()
        _connection = None


def init_db():
    """
    Create all tables on startup. Uses raw SQL (SQLite-compatible).
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
    ]
    for sql in alter_statements:
        try:
            conn.execute(sql)
        except Exception:
            pass

    logger.info("Database tables initialized")


def check_db_connectivity() -> bool:
    """Test DB connectivity with SELECT 1. Returns True if healthy."""
    try:
        conn = get_db()
        result = conn.execute("SELECT 1")
        return len(result.rows) > 0
    except Exception as e:
        logger.error("Database connectivity check failed: %s", e)
        return False
