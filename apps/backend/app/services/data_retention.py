"""
Background service to enforce the 30-day data retention policy.
Finds users marked as deleted (via `deleted_at`) older than 30 days and hard deletes them.
"""

import logging
import threading
import time
from datetime import datetime, timedelta

from app.database import get_db

logger = logging.getLogger(__name__)

class DataRetentionService:
    def __init__(self, check_interval_seconds=86400, retention_days=30):
        self.check_interval_seconds = check_interval_seconds
        self.retention_days = retention_days
        self._shutdown = False
        self._thread = None

    def start(self):
        self._shutdown = False
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        logger.info(f"DataRetentionService started (retention: {self.retention_days} days, interval: {self.check_interval_seconds}s)")

    def stop(self):
        self._shutdown = True
        if self._thread:
            self._thread.join(timeout=2)
            logger.info("DataRetentionService stopped")
            
    def _run(self):
        # Initial sleep so we don't block server startup
        time.sleep(5)
        
        while not self._shutdown:
            try:
                self.purge_expired_data()
            except Exception as e:
                logger.error("Error in data retention purge: %s", e, exc_info=True)
            
            # Sleep in increments to allow fast shutdown
            for _ in range(self.check_interval_seconds):
                if self._shutdown:
                    break
                time.sleep(1)

    def purge_expired_data(self):
        """Find users marked deleted past the retention window and hard delete them."""
        conn = get_db()
        cutoff_date = (datetime.now() - timedelta(days=self.retention_days)).strftime("%Y-%m-%d %H:%M:%S")
        
        # Find users pending deletion past cutoff
        result = conn.execute(
            "SELECT id, clerk_user_id, tenant_id FROM users WHERE deleted_at IS NOT NULL AND deleted_at < ?",
            [cutoff_date]
        )
        
        if not result.rows:
            return
            
        logger.info("DataRetention: Found %d expired accounts to purge", len(result.rows))
        
        # Import firebase_admin auth here to avoid breaking if not initialized
        try:
            from firebase_admin import auth as firebase_auth
        except ImportError:
            firebase_auth = None
            
        for row in result.rows:
            user_id = row[0]
            firebase_uid = row[1]
            tenant_id = row[2]
            
            logger.info("DataRetention: Purging user %s and tenant %s", user_id, tenant_id)
            
            # 1. Delete from Firebase Auth
            if firebase_auth and firebase_uid and firebase_uid != "local_firebase_uid":
                try:
                    firebase_auth.delete_user(firebase_uid)
                    logger.info("DataRetention: Deleted Firebase Auth user %s", firebase_uid)
                except Exception as e:
                    logger.warning("DataRetention: Failed to delete Firebase Auth user %s: %s", firebase_uid, e)
                    
            # 2. Hard delete data linked to tenant
            # Order matters due to foreign keys
            conn.execute("DELETE FROM feedback_events WHERE tenant_id = ?", [tenant_id])
            conn.execute("DELETE FROM scored_leads WHERE tenant_id = ?", [tenant_id])
            conn.execute("DELETE FROM training_runs WHERE tenant_id = ?", [tenant_id])
            
            # 3. Hard delete user and tenant
            conn.execute("DELETE FROM users WHERE id = ?", [user_id])
            conn.execute("DELETE FROM tenants WHERE id = ?", [tenant_id])
            
        logger.info("DataRetention: Purge complete.")

# Global instance
_data_retention_service = None

def get_data_retention_service() -> DataRetentionService:
    global _data_retention_service
    if _data_retention_service is None:
        _data_retention_service = DataRetentionService()
    return _data_retention_service

def start_data_retention_service():
    service = get_data_retention_service()
    service.start()

def stop_data_retention_service():
    service = get_data_retention_service()
    service.stop()
