"""
Background job queue for long-running ML training tasks.
Simple in-memory implementation (production: upgrade to Redis + Celery).
"""

import uuid
import logging
import threading
import time
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, Any, Optional, Callable
from dataclasses import dataclass, asdict

logger = logging.getLogger(__name__)


class JobStatus(str, Enum):
    """Job lifecycle states."""
    QUEUED = "queued"           # Waiting to start
    PROCESSING = "processing"   # Currently training
    COMPLETED = "completed"     # Successfully finished
    FAILED = "failed"           # Error occurred
    CANCELLED = "cancelled"     # User cancelled


@dataclass
class Job:
    """Represents a single background job."""
    job_id: str
    status: JobStatus
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    # Input parameters
    model_name: str = ""
    tenant_id: str = ""
    
    # Progress tracking
    progress: int = 0  # 0-100
    current_step: str = "Initializing..."
    
    # Results
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to JSON-serializable dict."""
        return {
            "job_id": self.job_id,
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "model_name": self.model_name,
            "tenant_id": self.tenant_id,
            "progress": self.progress,
            "current_step": self.current_step,
            "result": self.result,
            "error": self.error,
            "elapsed_seconds": (
                (self.completed_at or datetime.now()) - self.started_at
            ).total_seconds() if self.started_at else None,
        }


class JobQueue:
    """Simple in-memory job queue."""
    
    def __init__(self, max_workers: int = 3, job_retention_hours: int = 24):
        self.jobs: Dict[str, Job] = {}
        self.max_workers = max_workers
        self.job_retention_hours = job_retention_hours
        self.lock = threading.Lock()
        self._worker_threads = []
        self._shutdown = False
        
        # Start cleanup thread
        self._cleanup_thread = threading.Thread(
            target=self._cleanup_old_jobs, daemon=True
        )
        self._cleanup_thread.start()
        
        logger.info(f"JobQueue initialized with {max_workers} workers")
    
    def create_job(
        self,
        model_name: str,
        tenant_id: str,
    ) -> str:
        """Create and enqueue a new job. Returns job_id."""
        job_id = str(uuid.uuid4())[:8]
        
        with self.lock:
            self.jobs[job_id] = Job(
                job_id=job_id,
                status=JobStatus.QUEUED,
                created_at=datetime.now(),
                model_name=model_name,
                tenant_id=tenant_id,
            )
        
        logger.info(f"Created job {job_id} for model {model_name}")
        return job_id
    
    def get_job(self, job_id: str) -> Optional[Job]:
        """Get job by ID."""
        with self.lock:
            return self.jobs.get(job_id)
    
    def get_job_status(self, job_id: str) -> Dict[str, Any]:
        """Get job status as dict (for API response)."""
        job = self.get_job(job_id)
        if not job:
            return {"error": f"Job {job_id} not found", "job_id": job_id}
        return job.to_dict()
    
    def update_job_progress(
        self,
        job_id: str,
        progress: int,
        step: str,
    ) -> None:
        """Update job progress during execution."""
        with self.lock:
            if job_id in self.jobs:
                self.jobs[job_id].progress = min(100, max(0, progress))
                self.jobs[job_id].current_step = step
    
    def mark_processing(self, job_id: str) -> None:
        """Mark job as started."""
        with self.lock:
            if job_id in self.jobs:
                self.jobs[job_id].status = JobStatus.PROCESSING
                self.jobs[job_id].started_at = datetime.now()
                self.jobs[job_id].progress = 5
    
    def mark_completed(
        self,
        job_id: str,
        result: Dict[str, Any],
    ) -> None:
        """Mark job as successfully completed."""
        with self.lock:
            if job_id in self.jobs:
                self.jobs[job_id].status = JobStatus.COMPLETED
                self.jobs[job_id].completed_at = datetime.now()
                self.jobs[job_id].result = result
                self.jobs[job_id].progress = 100
                self.jobs[job_id].current_step = "Completed"
                logger.info(f"Job {job_id} completed successfully")
    
    def mark_failed(self, job_id: str, error: str) -> None:
        """Mark job as failed."""
        with self.lock:
            if job_id in self.jobs:
                self.jobs[job_id].status = JobStatus.FAILED
                self.jobs[job_id].completed_at = datetime.now()
                self.jobs[job_id].error = error
                logger.error(f"Job {job_id} failed: {error}")
    
    def execute_job(
        self,
        job_id: str,
        task_func: Callable,
        *args,
        **kwargs,
    ) -> None:
        """Execute task in background thread."""
        def worker():
            try:
                self.mark_processing(job_id)
                logger.info(f"Starting job {job_id}")
                
                # Run the actual task
                result = task_func(
                    job_id=job_id,
                    *args,
                    **kwargs,
                )
                
                self.mark_completed(job_id, result)
            except Exception as e:
                error_msg = f"{type(e).__name__}: {str(e)}"
                logger.exception(f"Job {job_id} exception: {error_msg}")
                self.mark_failed(job_id, error_msg)
        
        thread = threading.Thread(target=worker, daemon=True)
        thread.start()
        self._worker_threads.append((job_id, thread))
    
    def _cleanup_old_jobs(self) -> None:
        """Periodically remove old completed jobs."""
        while not self._shutdown:
            time.sleep(3600)  # Every hour
            
            cutoff = datetime.now() - timedelta(hours=self.job_retention_hours)
            
            with self.lock:
                to_delete = [
                    job_id for job_id, job in self.jobs.items()
                    if job.completed_at and job.completed_at < cutoff
                ]
                for job_id in to_delete:
                    del self.jobs[job_id]
                    logger.info(f"Cleaned up old job {job_id}")
    
    def list_jobs(
        self,
        tenant_id: str,
        limit: int = 50,
    ) -> list:
        """List jobs for a tenant (most recent first)."""
        with self.lock:
            tenant_jobs = [
                job for job in self.jobs.values()
                if job.tenant_id == tenant_id
            ]
            # Sort by creation time, most recent first
            tenant_jobs.sort(key=lambda j: j.created_at, reverse=True)
            return [j.to_dict() for j in tenant_jobs[:limit]]


# Global job queue instance
_job_queue: Optional[JobQueue] = None


def get_job_queue() -> JobQueue:
    """Get or create the global job queue."""
    global _job_queue
    if _job_queue is None:
        _job_queue = JobQueue(max_workers=3, job_retention_hours=24)
    return _job_queue


def shutdown_job_queue() -> None:
    """Shutdown job queue (call on app shutdown)."""
    global _job_queue
    if _job_queue:
        _job_queue._shutdown = True
