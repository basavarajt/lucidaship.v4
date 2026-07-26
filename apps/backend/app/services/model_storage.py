"""
Model storage service — save/load/list/delete trained .joblib model artifacts.
Scoped by tenant_id for isolation.
Uses Google Cloud Storage if GCS_BUCKET_NAME is set, else uses local filesystem.
"""

import os
import logging
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime, timezone
import shutil
import re

import joblib
from google.cloud import storage

from app.core.config import get_settings
from adaptive_scorer import UniversalAdaptiveScorer

logger = logging.getLogger(__name__)
settings = get_settings()

_gcs_client = None
_MODEL_NAME_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$")


def validate_model_name(model_name: str) -> str:
    """Keep user-supplied model names within a single safe storage path segment."""
    if not _MODEL_NAME_PATTERN.fullmatch(model_name or ""):
        raise ValueError("Model names must be 1-80 characters using letters, numbers, hyphens, or underscores.")
    return model_name

def get_gcs_client() -> Optional[storage.Client]:
    global _gcs_client
    if not settings.GCS_BUCKET_NAME:
        return None
    if _gcs_client is None:
        try:
            _gcs_client = storage.Client()
        except Exception as e:
            logger.warning("Could not initialize GCS Client: %s", e)
            return None
    return _gcs_client


def verify_gcs_access() -> bool:
    """Test if the GCS bucket is writable. Logs warnings if misconfigured."""
    client = get_gcs_client()
    if not client:
        logger.warning("GCS_BUCKET_NAME is not set. Models will be saved to ephemeral local storage.")
        return False
        
    try:
        bucket = client.bucket(settings.GCS_BUCKET_NAME)
        if not bucket.exists():
            logger.error("GCS Bucket '%s' DOES NOT EXIST or service account lacks access.", settings.GCS_BUCKET_NAME)
            return False
            
        # Test write permission
        test_blob = bucket.blob(".lucida_write_test")
        test_blob.upload_from_string("test")
        test_blob.delete()
        logger.info("GCS bucket '%s' is configured and writable.", settings.GCS_BUCKET_NAME)
        return True
    except Exception as e:
        logger.error("GCS Bucket '%s' is NOT WRITABLE. Models will be lost on container restart! Error: %s", settings.GCS_BUCKET_NAME, e)
        return False


def _tenant_dir(tenant_id: str) -> Path:
    """Get or create the local model directory for a tenant."""
    path = Path(settings.MODEL_ARTIFACTS_DIR) / tenant_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def _versioned_candidates(directory: Path, model_name: str) -> List[Path]:
    return sorted(
        directory.glob(f"{model_name}__*.joblib"),
        key=lambda candidate: candidate.stat().st_mtime,
        reverse=True,
    )


def _load_first_compatible(paths: List[Path]) -> UniversalAdaptiveScorer:
    errors = []
    for path in paths:
        try:
            return joblib.load(path)
        except Exception as exc:
            errors.append(f"{path.name}: {exc}")
    raise RuntimeError("; ".join(errors) if errors else "No compatible model artifacts found")


def save_model(model: UniversalAdaptiveScorer, tenant_id: str, model_name: str) -> str:
    """
    Save a trained model to disk (and GCS if configured).
    Returns the artifact path.
    """
    model_name = validate_model_name(model_name)
    directory = _tenant_dir(tenant_id)
    version_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    filename_versioned = f"{model_name}__{version_id}.joblib"
    filename_latest = f"{model_name}.joblib"
    
    versioned_filepath = directory / filename_versioned
    latest_filepath = directory / filename_latest

    joblib.dump(model, versioned_filepath)
    shutil.copy2(versioned_filepath, latest_filepath)

    logger.info("Model saved locally: tenant=%s model=%s version=%s path=%s", tenant_id, model_name, version_id, versioned_filepath)

    # Upload to GCS
    gcs_client = get_gcs_client()
    if gcs_client:
        try:
            bucket = gcs_client.bucket(settings.GCS_BUCKET_NAME)
            # Store at tenant_id/model_name/version.joblib
            blob_versioned = bucket.blob(f"{tenant_id}/{filename_versioned}")
            blob_latest = bucket.blob(f"{tenant_id}/{filename_latest}")
            
            blob_versioned.upload_from_filename(str(versioned_filepath))
            blob_latest.upload_from_filename(str(latest_filepath))
            logger.info("Model uploaded to GCS: gs://%s/%s/%s", settings.GCS_BUCKET_NAME, tenant_id, filename_versioned)
            
            # Use GCS path as the artifact path
            return f"gs://{settings.GCS_BUCKET_NAME}/{tenant_id}/{filename_versioned}"
        except Exception as e:
            logger.error("Failed to upload model to GCS: %s", e)

    return str(versioned_filepath)


def load_model(tenant_id: str, model_name: str) -> UniversalAdaptiveScorer:
    """
    Load a model from disk. If not found locally, tries to download from GCS.
    """
    model_name = validate_model_name(model_name)
    directory = _tenant_dir(tenant_id)
    filepath = directory / f"{model_name}.joblib"
    
    # Check GCS if not exists locally or just force sync from GCS?
    # To be safe and always get latest, if GCS is enabled, try downloading.
    gcs_client = get_gcs_client()
    if gcs_client:
        try:
            bucket = gcs_client.bucket(settings.GCS_BUCKET_NAME)
            blob_latest = bucket.blob(f"{tenant_id}/{model_name}.joblib")
            if blob_latest.exists():
                blob_latest.download_to_filename(str(filepath))
                logger.info("Downloaded latest model from GCS: tenant=%s model=%s", tenant_id, model_name)
        except Exception as e:
            logger.error("Failed to download model from GCS: %s", e)

    candidate_paths = [filepath] if filepath.exists() else []
    candidate_paths.extend(_versioned_candidates(directory, model_name))
    
    if not candidate_paths:
        raise FileNotFoundError(f"No model '{model_name}' found for tenant '{tenant_id}'")
        
    model = _load_first_compatible(candidate_paths)
    logger.info("Model loaded: tenant=%s model=%s", tenant_id, model_name)
    return model


def load_model_from_path(artifact_path: str) -> UniversalAdaptiveScorer:
    """Load a model from a specific artifact path (local or gs://)."""
    if artifact_path.startswith("gs://"):
        gcs_client = get_gcs_client()
        if not gcs_client:
            raise RuntimeError("GCS_BUCKET_NAME is not configured, cannot load gs:// path")
        
        path_parts = artifact_path[5:].split("/", 1)
        if len(path_parts) != 2:
            raise ValueError(f"Invalid GCS path: {artifact_path}")
        bucket_name, blob_name = path_parts
        
        # Determine local temp path
        local_path = Path(settings.MODEL_ARTIFACTS_DIR) / blob_name
        local_path.parent.mkdir(parents=True, exist_ok=True)
        
        bucket = gcs_client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        if not blob.exists():
             raise FileNotFoundError(f"Model artifact missing on GCS: {artifact_path}")
             
        blob.download_to_filename(str(local_path))
        logger.info("Model downloaded from artifact path=%s", artifact_path)
        return joblib.load(local_path)
        
    filepath = Path(artifact_path)
    if not filepath.exists():
        raise FileNotFoundError(f"Model artifact missing: {artifact_path}")
    model = joblib.load(filepath)
    logger.info("Model loaded from artifact path=%s", filepath)
    return model


def list_models(tenant_id: str) -> List[str]:
    """Return list of model names for a tenant (from GCS or Local)."""
    gcs_client = get_gcs_client()
    if gcs_client:
        try:
            bucket = gcs_client.bucket(settings.GCS_BUCKET_NAME)
            blobs = bucket.list_blobs(prefix=f"{tenant_id}/")
            model_names = set()
            for blob in blobs:
                name = blob.name.split("/")[-1]
                if name.endswith(".joblib") and "__" not in name:
                    model_names.add(name[:-7]) # Remove .joblib
            if model_names:
                return list(model_names)
        except Exception as e:
            logger.error("Failed to list models from GCS: %s", e)

    directory = _tenant_dir(tenant_id)
    return [
        f.stem
        for f in directory.glob("*.joblib")
        if "__" not in f.stem
    ]


def delete_model(tenant_id: str, model_name: str) -> bool:
    """Delete a model file from GCS and Local."""
    model_name = validate_model_name(model_name)
    deleted_any = False
    
    gcs_client = get_gcs_client()
    if gcs_client:
        try:
            bucket = gcs_client.bucket(settings.GCS_BUCKET_NAME)
            blobs = bucket.list_blobs(prefix=f"{tenant_id}/{model_name}")
            for blob in blobs:
                if blob.name == f"{tenant_id}/{model_name}.joblib" or f"{tenant_id}/{model_name}__" in blob.name:
                    blob.delete()
                    deleted_any = True
            logger.info("Model deleted from GCS: tenant=%s model=%s", tenant_id, model_name)
        except Exception as e:
            logger.error("Failed to delete model from GCS: %s", e)

    directory = _tenant_dir(tenant_id)
    filepath = directory / f"{model_name}.joblib"

    if filepath.exists():
        filepath.unlink()
        deleted_any = True

    for versioned_file in directory.glob(f"{model_name}__*.joblib"):
        versioned_file.unlink()
        deleted_any = True

    if deleted_any:
        logger.info("Model deleted: tenant=%s model=%s", tenant_id, model_name)
    return deleted_any


def load_all_models() -> Dict[str, Dict[str, UniversalAdaptiveScorer]]:
    """
    Scan model_artifacts/ (and GCS) and load ALL models into memory.
    """
    all_models: Dict[str, Dict[str, UniversalAdaptiveScorer]] = {}
    
    # First sync from GCS if available
    gcs_client = get_gcs_client()
    if gcs_client:
        try:
            bucket = gcs_client.bucket(settings.GCS_BUCKET_NAME)
            blobs = bucket.list_blobs()
            for blob in blobs:
                if blob.name.endswith(".joblib") and "__" not in blob.name:
                    # blob.name is tenant_id/model_name.joblib
                    parts = blob.name.split("/")
                    if len(parts) == 2:
                        t_id, f_name = parts
                        local_path = Path(settings.MODEL_ARTIFACTS_DIR) / t_id / f_name
                        local_path.parent.mkdir(parents=True, exist_ok=True)
                        # Only download if we don't have it or we want fresh, let's just always download latest for now
                        blob.download_to_filename(str(local_path))
                        logger.info("Synced model from GCS on startup: gs://%s/%s", settings.GCS_BUCKET_NAME, blob.name)
        except Exception as e:
            logger.error("Failed to sync models from GCS on startup: %s", e)

    artifacts_dir = Path(settings.MODEL_ARTIFACTS_DIR)

    if not artifacts_dir.exists():
        logger.info("No model_artifacts directory found, starting fresh")
        return all_models

    for tenant_dir in artifacts_dir.iterdir():
        if not tenant_dir.is_dir():
            continue
        tenant_id = tenant_dir.name
        all_models[tenant_id] = {}

        for model_file in tenant_dir.glob("*.joblib"):
            model_name = model_file.stem
            if "__" in model_name:
                continue
            try:
                model = _load_first_compatible([model_file, *_versioned_candidates(tenant_dir, model_name)])
                all_models[tenant_id][model_name] = model
                logger.info("Loaded model on startup: tenant=%s model=%s", tenant_id, model_name)
            except Exception as e:
                logger.error("Failed to load model %s/%s: %s", tenant_id, model_name, e)

    total = sum(len(models) for models in all_models.values())
    logger.info("Startup model reload complete: %d models across %d tenants", total, len(all_models))
    return all_models
