"""
Scoring & Training API routes - protected by Firebase auth, scoped by tenant.
Uses the configured SQL database (SQLAlchemy engine) for database operations.
"""

import io
import json
import uuid
import logging
from typing import Optional, List, Dict, Any, Tuple

from fastapi import APIRouter, UploadFile, File, Query, Depends, BackgroundTasks, Request
import pandas as pd
import numpy as np
from sklearn.metrics import roc_auc_score, accuracy_score, precision_score, recall_score

from app.database import get_db
from app.core.auth import get_current_user, get_optional_user, has_full_access
from app.core.config import get_settings
from app.core.responses import success_response, error_response
from app.services import model_storage
from app.services.dataset_relationships import (
    DatasetAsset,
    analyze_dataset_collection,
    execute_merge_plan,
    prepare_combined_dataset,
)
from app.services.explanation_translator import translate_scoring_results
from app.services.upload_quantization import IngestedDatasetAsset, ingest_uploaded_dataset
from app.services.job_queue import get_job_queue, JobStatus
from app.services.column_matcher import find_best_matches
from app.services.intelligent_imputation import extract_imputation_stats, impute_missing_columns
from app.services.type_coercion import coerce_series_to_expected_type
from app.services.behavioral_signals import BehavioralSignalExtractor
from adaptive_scorer import UniversalAdaptiveScorer, DataAnalyzer, EngagementScorer, ActionRecommender

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(tags=["Scoring"])

# ── Job Queue for async operations ────────────────────────────
job_queue = get_job_queue()

# ── In-memory model cache ─────────────────────────────────────
# {tenant_id: {model_name: UniversalAdaptiveScorer}}
trained_models = {}


def _blend_behavioral_score(profile_score: float, relationship_strength: Optional[float], weight: float) -> float:
    """Blend a behavioral score without allowing it to escape the 0-100 scale."""
    profile_score = max(0.0, min(100.0, float(profile_score)))
    if relationship_strength is None:
        return profile_score
    relationship_strength = max(0.0, min(100.0, float(relationship_strength)))
    weight = max(0.0, min(1.0, float(weight)))
    return round(profile_score * (1.0 - weight) + relationship_strength * weight, 2)


def _row_signature(data: dict) -> str:
    """Build a deterministic fingerprint for a scored row."""
    normalized = {}
    for key, value in sorted(data.items()):
        if isinstance(value, float):
            normalized[key] = round(value, 6)
        else:
            normalized[key] = value
    return json.dumps(normalized, sort_keys=True, default=str)


def _get_model(tenant_id: str, model_name: str) -> Optional[UniversalAdaptiveScorer]:
    """Get model from cache, or lazily load it from storage."""
    model = trained_models.get(tenant_id, {}).get(model_name)
    if model is None:
        try:
            model = model_storage.load_model(tenant_id, model_name)
            if tenant_id not in trained_models:
                trained_models[tenant_id] = {}
            trained_models[tenant_id][model_name] = model
        except Exception as e:
            logger.warning("Failed to lazy load model %s for tenant %s: %s", model_name, tenant_id, e)
            artifact_path = _latest_training_artifact_path(tenant_id, model_name)
            if artifact_path:
                try:
                    model = model_storage.load_model_from_path(artifact_path)
                    trained_models.setdefault(tenant_id, {})[model_name] = model
                    logger.info(
                        "Loaded model from training_runs artifact path: tenant=%s model=%s",
                        tenant_id,
                        model_name,
                    )
                except Exception as artifact_exc:
                    logger.warning(
                        "Failed to load model %s for tenant %s from artifact_path=%s: %s",
                        model_name,
                        tenant_id,
                        artifact_path,
                        artifact_exc,
                    )
                    return None
            else:
                return None
    return model


def _latest_training_artifact_path(tenant_id: str, model_name: str) -> Optional[str]:
    """Return the newest persisted artifact path for a tenant/model, if metadata exists."""
    try:
        conn = get_db()
        result = conn.execute(
            """SELECT artifact_path
               FROM training_runs
               WHERE tenant_id = ? AND model_name = ?
               ORDER BY created_at DESC LIMIT 1""",
            [tenant_id, model_name],
        )
        if result.rows:
            return result.rows[0][0]
    except Exception as exc:
        logger.warning(
            "Could not read training artifact path: tenant=%s model=%s error=%s",
            tenant_id,
            model_name,
            exc,
        )
    return None


def _list_training_run_model_names(tenant_id: str) -> List[str]:
    """Return model names recorded in training metadata for this tenant."""
    try:
        conn = get_db()
        result = conn.execute(
            """SELECT DISTINCT model_name
               FROM training_runs
               WHERE tenant_id = ?
               ORDER BY model_name ASC""",
            [tenant_id],
        )
        return [row[0] for row in result.rows if row and row[0]]
    except Exception as exc:
        logger.warning("Could not list training-run models for tenant=%s: %s", tenant_id, exc)
        return []


def _extract_model_input_columns(model: UniversalAdaptiveScorer) -> set[str]:
    """Best-effort extraction of raw input columns a model expects."""
    columns: set[str] = set()

    engineer = getattr(model, "engineer", None)
    feature_lineage = getattr(engineer, "feature_lineage", {}) if engineer else {}
    if isinstance(feature_lineage, dict):
        for meta in feature_lineage.values():
            if isinstance(meta, dict):
                source = meta.get("source_column")
                if source:
                    columns.add(str(source))

    analyzer = getattr(model, "analyzer", None)
    column_types = getattr(analyzer, "column_types", {}) if analyzer else {}
    if isinstance(column_types, dict):
        for col, col_type in column_types.items():
            if col_type != "ignore":
                columns.add(str(col))

    target_col = getattr(analyzer, "target_col", None) if analyzer else None
    if target_col:
        columns.discard(str(target_col))
    columns.discard("__synthetic_target__")

    return {c for c in columns if c and c != "None"}


def _score_model_compatibility(model: UniversalAdaptiveScorer, input_columns: set[str]) -> Dict[str, Any]:
    """Compute schema compatibility score between scoring payload and model."""
    expected = _extract_model_input_columns(model)
    if not expected:
        return {
            "score": 0.0,
            "expected_columns": 0,
            "matched_columns": 0,
            "coverage": 0.0,
            "precision": 0.0,
            "matched_sample": [],
            "missing_sample": [],
        }

    match_result = find_best_matches(expected, input_columns)
    matches = match_result["matches"]
    matched_expected = {m["expected"] for m in matches}
    matched_actual = {m["actual"] for m in matches}
    missing = set(match_result["unmatched_expected"])
    unexpected = set(match_result["unmatched_actual"])

    coverage = len(matched_expected) / len(expected) if expected else 0.0
    precision = len(matched_actual) / len(input_columns) if input_columns else 0.0
    avg_score = float(np.mean([m["score"] for m in matches])) if matches else 0.0
    score = (0.7 * coverage) + (0.3 * precision) + (0.1 * avg_score)
    score = min(score, 1.0)

    return {
        "score": float(round(score, 4)),
        "expected_columns": int(len(expected)),
        "matched_columns": int(len(matched_expected)),
        "coverage": float(round(coverage, 4)),
        "precision": float(round(precision, 4)),
        "fuzzy_bonus": float(round(avg_score, 4)),
        "matched_sample": [
            {"expected": m["expected"], "actual": m["actual"], "score": m["score"], "method": m["method"]}
            for m in matches[:8]
        ],
        "missing_sample": sorted(list(missing))[:8],
        "unexpected_sample": sorted(list(unexpected))[:8],
    }


def _preprocess_scoring_dataframe(
    model: UniversalAdaptiveScorer,
    df: pd.DataFrame,
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """Fuzzy-match columns, impute missing, and coerce types for scoring."""
    expected = _extract_model_input_columns(model)
    match_result = find_best_matches(expected, set(df.columns))
    rename_map = match_result["mapping_actual_to_expected"]

    if rename_map:
        df = df.rename(columns=rename_map)

    analyzer = getattr(model, "analyzer", None)
    column_types = getattr(analyzer, "column_types", {}) if analyzer else {}
    imputation_stats = getattr(analyzer, "imputation_stats", None) if analyzer else None
    if not imputation_stats and analyzer is not None:
        imputation_stats = extract_imputation_stats(analyzer.df, column_types, analyzer.target_col)

    df, imputation_report = impute_missing_columns(df, expected, imputation_stats or {})

    coercion_reports: Dict[str, Any] = {}
    coercion_ratios = []
    for col in expected:
        expected_type = column_types.get(col)
        if not expected_type or col not in df.columns:
            continue
        coerced, report = coerce_series_to_expected_type(df[col], expected_type)
        df[col] = coerced
        coercion_reports[col] = report
        if report["original_non_null"] > 0:
            coercion_ratios.append(report["coercion_ratio"])

    coercion_success = float(np.mean(coercion_ratios)) if coercion_ratios else 1.0

    coverage = (len(expected) - len(imputation_report["missing_columns"])) / len(expected) if expected else 0.0
    extra_columns = match_result["unmatched_actual"]
    extra_ratio = len(extra_columns) / len(df.columns) if len(df.columns) else 0.0

    report = {
        "matches": match_result["matches"],
        "missing_columns": imputation_report["missing_columns"],
        "extra_columns": extra_columns,
        "imputed_columns": imputation_report["imputed_columns"],
        "coverage": float(round(coverage, 4)),
        "extra_ratio": float(round(extra_ratio, 4)),
        "coercion_success": float(round(coercion_success, 4)),
    }

    return df, report


def _choose_model_for_dataframe(
    tenant_id: str,
    requested_model: str,
    df: pd.DataFrame,
    *,
    auto_select_model: bool,
    ambiguity_margin: float = 0.05,
    minimum_score: float = 0.5,
) -> Tuple[Optional[str], Optional[UniversalAdaptiveScorer], Dict[str, Any]]:
    """
    Resolve model selection for scoring.
    - Default behavior: keep requested model (backward-compatible).
    - Auto-select mode: choose highest schema-compatibility model and report ambiguity.
    """
    tenant_models = _ensure_tenant_models_loaded(tenant_id)
    input_columns = {str(c) for c in df.columns}

    if not tenant_models:
        return None, None, {
            "status": "no_models_available",
            "requested_model": requested_model,
            "auto_selected": False,
        }

    # Backward-compatible: explicit model wins unless auto-select requested.
    if not auto_select_model and requested_model != "auto":
        scorer = tenant_models.get(requested_model)
        if scorer is None:
            return None, None, {
                "status": "requested_model_not_found",
                "requested_model": requested_model,
                "available_models": sorted(list(tenant_models.keys()))[:25],
                "auto_selected": False,
            }
        return requested_model, scorer, {
            "status": "manual_model_selected",
            "requested_model": requested_model,
            "selected_model": requested_model,
            "auto_selected": False,
        }

    candidates = []
    for name, model in tenant_models.items():
        compatibility = _score_model_compatibility(model, input_columns)
        candidates.append({
            "model_name": name,
            "compatibility": compatibility,
        })
    candidates.sort(key=lambda item: item["compatibility"]["score"], reverse=True)

    best = candidates[0]
    second = candidates[1] if len(candidates) > 1 else None
    best_score = best["compatibility"]["score"]
    second_score = second["compatibility"]["score"] if second else 0.0
    ambiguous = bool(
        second
        and best_score >= minimum_score
        and second_score >= minimum_score
        and (best_score - second_score) <= ambiguity_margin
    )

    if best_score < minimum_score:
        # Fallback: if the user explicitly named a model that exists, use it
        # rather than failing entirely due to low schema compatibility scores.
        if requested_model != "auto" and requested_model in tenant_models:
            logger.info(
                "Auto-select below threshold (%.2f < %.2f), falling back to requested model '%s'",
                best_score, minimum_score, requested_model,
            )
            return requested_model, tenant_models[requested_model], {
                "status": "auto_select_fallback_to_requested",
                "requested_model": requested_model,
                "selected_model": requested_model,
                "auto_selected": True,
                "ambiguous": False,
                "best_score": best_score,
                "minimum_score": minimum_score,
                "candidates": candidates[:5],
                "message": (
                    f"Auto-select could not confidently match a model (best score {best_score:.2f}). "
                    f"Falling back to requested model '{requested_model}'."
                ),
            }
        return None, None, {
            "status": "no_confident_model_match",
            "requested_model": requested_model,
            "selected_model": None,
            "auto_selected": True,
            "ambiguous": False,
            "best_score": best_score,
            "minimum_score": minimum_score,
            "candidates": candidates[:5],
        }

    selected_name = best["model_name"]
    selected_model = tenant_models[selected_name]
    return selected_name, selected_model, {
        "status": "auto_model_selected",
        "requested_model": requested_model,
        "selected_model": selected_name,
        "auto_selected": True,
        "ambiguous": ambiguous,
        "best_score": best_score,
        "second_best_score": second_score if second else None,
        "ambiguity_margin": ambiguity_margin,
        "minimum_score": minimum_score,
        "candidates": candidates[:5],
        "message": (
            "Multiple similar models matched this scoring dataset; user may override model_name."
            if ambiguous
            else "Model selected by schema compatibility."
        ),
    }


def _set_model(tenant_id: str, model_name: str, model: UniversalAdaptiveScorer):
    """Put model in cache."""
    if tenant_id not in trained_models:
        trained_models[tenant_id] = {}
    trained_models[tenant_id][model_name] = model


def _ensure_tenant_models_loaded(tenant_id: str) -> Dict[str, UniversalAdaptiveScorer]:
    """Hydrate a tenant's model cache from persistent storage when Cloud Run starts cold."""
    tenant_models = trained_models.setdefault(tenant_id, {})
    persisted_model_names = sorted(set(model_storage.list_models(tenant_id)) | set(_list_training_run_model_names(tenant_id)))

    for model_name in persisted_model_names:
        if model_name in tenant_models:
            continue
        model = _get_model(tenant_id, model_name)
        if model is not None:
            tenant_models[model_name] = model
            logger.info("Lazy-loaded model into cache: tenant=%s model=%s", tenant_id, model_name)

    return tenant_models


def init_models_cache(all_models):
    """Initialize cache on startup from loaded models."""
    trained_models.clear()
    trained_models.update(all_models or {})


# ── Helper: Smart Merge ──────────────────────────────────────

def smart_merge_dfs(dfs: List[pd.DataFrame]) -> pd.DataFrame:
    """Intelligently merge multiple DataFrames."""
    if not dfs:
        return pd.DataFrame()
    if len(dfs) == 1:
        return dfs[0]

    cols_set = [set(df.columns) for df in dfs]
    if all(s == cols_set[0] for s in cols_set):
        return pd.concat(dfs, axis=0, ignore_index=True)

    common_cols = set.intersection(*cols_set)
    candidate_keys = []
    for col in common_cols:
        is_id_name = any(kw in col.lower() for kw in ['id', 'email', 'key', 'contact', 'prospect'])
        is_unique = all(df[col].nunique() / len(df) > 0.8 for df in dfs if len(df) > 0)
        if is_id_name or is_unique:
            candidate_keys.append(col)

    if candidate_keys:
        key = sorted(candidate_keys, key=lambda x: ('email' in x.lower() or 'id' in x.lower()), reverse=True)[0]
        logger.info("MERGE: Joining on key: %s", key)
        merged = dfs[0]
        for i in range(1, len(dfs)):
            merged = pd.merge(merged, dfs[i], on=key, how='left', suffixes=('', f'_extra_{i}'))
        return merged

    logger.info("MERGE: No common ID key found. Concatenating.")
    return pd.concat(dfs, axis=0, ignore_index=True)


# ── Input Validation ─────────────────────────────────────────

MAX_CSV_SIZE_MB = settings.MAX_CSV_SIZE_MB
MAX_CSV_SIZE = MAX_CSV_SIZE_MB * 1024 * 1024
MAX_COLUMNS = 500


async def _collect_uploaded_file_payloads(
    file: Optional[UploadFile],
    files: Optional[List[UploadFile]],
    request: Optional[Request] = None,
    context: str = "upload",
) -> List[Tuple[str, bytes]]:
    """Read uploaded CSV payloads, including a fallback for multipart binding issues."""
    files_data: List[Tuple[str, bytes]] = []

    if file:
        files_data.append((file.filename or "upload.csv", await file.read()))

    if files:
        for uploaded in files:
            files_data.append((uploaded.filename or "upload.csv", await uploaded.read()))

    files_data = _dedupe_file_payloads(files_data)

    if files_data or request is None:
        return files_data

    try:
        form = await request.form()
        form_keys = list(form.keys())
        for key, value in form.multi_items():
            if hasattr(value, "filename") and hasattr(value, "read"):
                files_data.append((value.filename or f"{key}.csv", await value.read()))

        files_data = _dedupe_file_payloads(files_data)
        logger.warning(
            "No files bound by FastAPI for %s; content_type=%s form_keys=%s recovered_files=%d",
            context,
            request.headers.get("content-type"),
            form_keys,
            len(files_data),
        )
    except Exception as exc:
        logger.warning(
            "Could not inspect multipart form for %s; content_type=%s error=%s",
            context,
            request.headers.get("content-type"),
            exc,
        )

    return files_data


async def _validate_and_ingest_files(
    file: Optional[UploadFile],
    files: Optional[List[UploadFile]],
    target_column: Optional[str] = None,
    request: Optional[Request] = None,
    context: str = "upload",
) -> List[IngestedDatasetAsset]:
    """Validate, read, and pre-compress uploaded CSV files with security checks."""
    files_data = await _collect_uploaded_file_payloads(file, files, request=request, context=context)

    if not files_data:
        content_type = request.headers.get("content-type", "missing") if request else "missing"
        raise ValueError(
            "No files provided. Please select at least one CSV file and retry. "
            f"Upload content-type received: {content_type}."
        )

    ingested_assets = []
    for filename, contents in files_data:
        # Validate file extension
        filename = filename or ""
        if not filename.lower().endswith(".csv"):
            raise ValueError(f"Only .csv files accepted. Got: '{filename}'")

        if not contents:
            raise ValueError(f"File '{filename}' was empty. Please choose a non-empty CSV.")

        # Validate file size
        if len(contents) > MAX_CSV_SIZE:
            raise ValueError(
                f"File '{filename}' exceeds {MAX_CSV_SIZE_MB}MB limit ({len(contents) / 1024 / 1024:.1f}MB)"
            )

        df = pd.read_csv(io.BytesIO(contents))

        # Validate column count
        if len(df.columns) > MAX_COLUMNS:
            raise ValueError(f"File '{filename}' has {len(df.columns)} columns (max {MAX_COLUMNS})")

        ingested_assets.append(
            ingest_uploaded_dataset(
                filename,
                df,
                enabled=settings.UPLOAD_COMPRESSION_ENABLED,
                mode=settings.UPLOAD_COMPRESSION_MODE,
                numeric_only=settings.UPLOAD_COMPRESSION_NUMERIC_ONLY,
                min_rows=settings.UPLOAD_COMPRESSION_MIN_ROWS,
                max_allowed_mse=settings.UPLOAD_COMPRESSION_MAX_ALLOWED_MSE,
                max_allowed_ip_error=settings.UPLOAD_COMPRESSION_MAX_ALLOWED_IP_ERROR,
                target_column=target_column,
            )
        )

    return ingested_assets


def _uploaded_dataset_names(
    file: Optional[UploadFile],
    files: Optional[List[UploadFile]],
) -> List[str]:
    uploaded = []
    if file:
        uploaded.append(file)
    if files:
        uploaded.extend(files)

    names = []
    for index, uploaded_file in enumerate(uploaded, start=1):
        names.append(uploaded_file.filename or f"dataset_{index}.csv")
    return names


def _prepare_assets(dataset_names: List[str], ingested_assets: List[IngestedDatasetAsset]) -> List[DatasetAsset]:
    return [
        DatasetAsset(
            name=ingested.name or name,
            df=ingested.raw_df,
            raw_df=ingested.raw_df,
            protected_df=ingested.protected_df,
            dequantized_df=ingested.dequantized_df,
            compression=ingested.diagnostics,
            execution_mode=ingested.mode,
        )
        for name, ingested in zip(dataset_names or [asset.name for asset in ingested_assets], ingested_assets)
    ]


def _compression_summary(assets: List[DatasetAsset]) -> Dict:
    dataset_summaries = []
    total_memory_saved = 0.0
    used_compressed_execution = False

    for asset in assets:
        compression = asset.compression or {}
        total_memory_saved += float(compression.get("estimated_memory_saved_mb") or 0.0)
        used_compressed_execution = used_compressed_execution or bool(compression.get("used_compressed_execution"))
        dataset_summaries.append({
            "dataset": asset.name,
            "mode": compression.get("mode", asset.execution_mode),
            "eligible_numeric_columns": compression.get("eligible_numeric_columns", []),
            "compressed_numeric_columns": compression.get("compressed_numeric_columns", []),
            "bypass_reason": compression.get("bypass_reason"),
            "latency_ms": compression.get("latency_ms", 0.0),
            "estimated_memory_saved_mb": compression.get("estimated_memory_saved_mb", 0.0),
            "distortion_metrics": compression.get("distortion_metrics"),
        })

    return {
        "enabled": settings.UPLOAD_COMPRESSION_ENABLED,
        "mode": settings.UPLOAD_COMPRESSION_MODE,
        "used_compressed_execution": used_compressed_execution,
        "estimated_memory_saved_mb": round(total_memory_saved, 4),
        "datasets": dataset_summaries,
    }


def _resolve_combined_dataset(assets: List[DatasetAsset], compression: Dict) -> tuple[pd.DataFrame, Dict]:
    """
    Prepare the merged dataset once for the dominant full-precision path.
    Only re-execute on dequantized assets when compressed execution is explicitly enabled.
    """
    if compression.get("used_compressed_execution"):
        execution_assets = [asset.for_execution() for asset in assets]
        _, merge_plan = prepare_combined_dataset(assets)
        return execute_merge_plan(execution_assets, merge_plan)

    return prepare_combined_dataset(assets)


def _dedupe_file_payloads(files_data: List[Tuple[str, bytes]]) -> List[Tuple[str, bytes]]:
    """Avoid double-reading the same uploaded file when clients send file and files keys."""
    seen = set()
    unique = []
    for filename, content in files_data:
        marker = (filename, len(content), content[:128])
        if marker in seen:
            continue
        seen.add(marker)
        unique.append((filename, content))
    return unique


# ── Background task: persist scored leads ────────────────────

def _persist_scores(tenant_id: str, model_name: str, results: list, scoring_run_id: str):
    """Persist scored leads to the configured database in background (doesn't slow down response)."""
    try:
        conn = get_db()

        # Find training run for this model
        result = conn.execute(
            "SELECT id FROM training_runs WHERE tenant_id = ? AND model_name = ? ORDER BY created_at DESC LIMIT 1",
            [tenant_id, model_name],
        )
        training_run_id = result.rows[0][0] if result.rows else None

        for r in results:
            lead_id = str(uuid.uuid4())
            score = r.get("score", 0.0)
            lead_data = json.dumps(r.get("data", {}), default=str)
            lead_signature = _row_signature(r.get("data", {}))
            ranking_version = r.get("ranking_version")

            conn.execute(
                """INSERT INTO scored_leads (
                       id, tenant_id, training_run_id, lead_data, lead_signature,
                       model_name, ranking_version, scoring_run_id, final_score, scored_at
                   )
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))""",
                [lead_id, tenant_id, training_run_id, lead_data, lead_signature, model_name, ranking_version, scoring_run_id, score],
            )

        logger.info("Persisted %d scored leads for tenant=%s", len(results), tenant_id)
    except Exception as e:
        logger.error("Failed to persist scores: %s", str(e))


@router.get("/ranked-lists")
async def list_saved_ranked_lists(user: dict = Depends(get_current_user)):
    """List every saved ranking run belonging to the authenticated tenant only."""
    conn = get_db()
    rows = conn.execute(
        """SELECT COALESCE(scoring_run_id, scored_at), model_name, ranking_version,
                  COUNT(*), MAX(scored_at), MAX(final_score), MIN(final_score)
           FROM scored_leads
           WHERE tenant_id = ?
           GROUP BY COALESCE(scoring_run_id, scored_at), model_name, ranking_version
           ORDER BY MAX(scored_at) DESC""",
        [user["tenant_id"]],
    ).rows
    return success_response(data={
        "ranked_lists": [
            {
                "run_id": row[0], "model_name": row[1] or "default",
                "ranking_version": row[2], "lead_count": int(row[3]),
                "scored_at": row[4], "highest_score": float(row[5]) if row[5] is not None else None,
                "lowest_score": float(row[6]) if row[6] is not None else None,
            }
            for row in rows
        ]
    })


@router.get("/ranked-lists/{run_id}")
async def get_saved_ranked_list(run_id: str, user: dict = Depends(get_current_user)):
    """Return one saved ranking run; the tenant filter prevents cross-account access."""
    conn = get_db()
    rows = conn.execute(
        """SELECT lead_data, final_score, model_name, ranking_version, scored_at
           FROM scored_leads
           WHERE tenant_id = ? AND COALESCE(scoring_run_id, scored_at) = ?
           ORDER BY final_score DESC, id ASC""",
        [user["tenant_id"], run_id],
    ).rows
    if not rows:
        return error_response("RANKED_LIST_NOT_FOUND", "This ranked list was not found.", 404)
    results = []
    for index, row in enumerate(rows, start=1):
        try:
            data = json.loads(row[0]) if row[0] else {}
        except json.JSONDecodeError:
            data = {}
        score = float(row[1]) if row[1] is not None else 0.0
        results.append({
            "rank": index, "score": score, "profile_score": score, "data": data,
            "score_band": "high" if score >= 80 else "medium" if score >= 55 else "low",
        })
    return success_response(data={
        "run_id": run_id, "model_name": rows[0][2] or "default",
        "ranking_version": rows[0][3], "scored_at": rows[0][4],
        "n_leads": len(results), "results": results,
    })


@router.post("/merge-plan")
async def merge_plan(
    request: Request,
    file: Optional[UploadFile] = File(None),
    files: Optional[List[UploadFile]] = File(None),
    user: dict = Depends(get_optional_user),
):
    """Profile uploaded datasets and recommend safe relationship-aware merge steps."""
    try:
        dataset_names = _uploaded_dataset_names(file, files)
        ingested_assets = await _validate_and_ingest_files(file, files, request=request, context="merge-plan")
        assets = _prepare_assets(dataset_names, ingested_assets)
        analysis = analyze_dataset_collection(assets)
        _, plan = prepare_combined_dataset(assets)

        return success_response(data={
            "status": "success",
            "analysis": analysis,
            "merge_plan": plan,
            "compression": _compression_summary(assets),
        })
    except ValueError as e:
        return error_response("VALIDATION_ERROR", str(e), 400)
    except Exception as e:
        logger.exception("Merge planning failed")
        return error_response("MERGE_PLAN_FAILED", f"Merge planning failed: {str(e)}", 500)


def _get_model_version_history(tenant_id: str, model_name: str, limit: int = 2):
    """Return latest training run rows for a model."""
    conn = get_db()
    result = conn.execute(
        """SELECT id, artifact_path, created_at
           FROM training_runs
           WHERE tenant_id = ? AND model_name = ?
           ORDER BY created_at DESC
           LIMIT ?""",
        [tenant_id, model_name, limit],
    )
    return result.rows if result.rows else []


def _load_feedback_training_frame(tenant_id: str, model_name: str, target_column: str) -> pd.DataFrame:
    """Reconstruct a supervised training frame from persisted feedback events."""
    conn = get_db()
    rows = conn.execute(
        """SELECT lead_data, actual_outcome
           FROM feedback_events
           WHERE tenant_id = ? AND model_name = ?
           ORDER BY feedback_at DESC""",
        [tenant_id, model_name],
    ).rows

    records = []
    for lead_data_json, actual_outcome in rows:
        try:
            lead_data = json.loads(lead_data_json) if lead_data_json else {}
        except json.JSONDecodeError:
            continue
        lead_data[target_column] = int(actual_outcome)
        records.append(lead_data)

    if not records:
        return pd.DataFrame()

    return pd.DataFrame(records)


def _load_segment_feedback_training_frame(
    tenant_id: str,
    model_name: str,
    target_column: str,
    segment_dimension: str,
    segment_value: str,
) -> pd.DataFrame:
    """Reconstruct a supervised training frame for one drifting segment."""
    feedback_df = _load_feedback_training_frame(tenant_id, model_name, target_column)
    if feedback_df.empty or segment_dimension not in feedback_df.columns:
        return pd.DataFrame()

    filtered = feedback_df[feedback_df[segment_dimension].astype(str) == str(segment_value)].copy()
    if filtered.empty:
        return pd.DataFrame()
    return filtered


def _auto_retrain_policy(learning_signal: Dict) -> Dict:
    """Decide whether feedback evidence is strong enough to auto-retrain."""
    matched_rows = int(learning_signal.get("matched_rows", 0))
    feedback_accuracy = float(learning_signal.get("feedback_accuracy", 0.0))
    feedback_recall = float(learning_signal.get("feedback_recall", 0.0))
    recommendation = learning_signal.get("recommendation")

    should_retrain = (
        matched_rows >= 25
        and recommendation == "retrain_with_feedback"
        and (feedback_accuracy < 0.82 or feedback_recall < 0.72)
    )

    reasons = []
    if matched_rows >= 25:
        reasons.append("enough_feedback_volume")
    if feedback_accuracy < 0.82:
        reasons.append("accuracy_below_policy")
    if feedback_recall < 0.72:
        reasons.append("recall_below_policy")

    return {
        "should_auto_retrain": should_retrain,
        "policy_name": "feedback_guardrail_v1",
        "reasons": reasons,
        "thresholds": {
            "min_matched_rows": 25,
            "min_accuracy": 0.82,
            "min_recall": 0.72,
        },
    }


def _execute_feedback_retrain(
    tenant_id: str,
    model_name: str,
    feedback_weight: int,
    scorer: UniversalAdaptiveScorer,
):
    """Retrain a model from persisted feedback events and persist the new version."""
    target_column = scorer.analyzer.target_col
    feedback_df = _load_feedback_training_frame(tenant_id, model_name, target_column)

    if feedback_df.empty:
        raise ValueError(f"No feedback events found for model '{model_name}'. Upload outcomes first.")
    if len(feedback_df) < 10:
        raise ValueError(f"Need at least 10 matched feedback rows to retrain. Found {len(feedback_df)}.")

    weighted_frames = [feedback_df.copy() for _ in range(feedback_weight)]
    retrain_df = pd.concat(weighted_frames, ignore_index=True)

    new_scorer = UniversalAdaptiveScorer()
    result = new_scorer.train(
        retrain_df,
        target_col=target_column,
        client_id=model_name,
    )

    artifact_path = model_storage.save_model(new_scorer, tenant_id, model_name)
    _set_model(tenant_id, model_name, new_scorer)

    run_id = str(uuid.uuid4())
    conn = get_db()
    metrics_payload = {
        **result["metrics"],
        "training_source": "feedback_events",
        "feedback_rows": int(len(feedback_df)),
        "feedback_weight": int(feedback_weight),
    }
    if new_scorer.scorer:
        new_scorer.scorer.metadata.update(metrics_payload)
    conn.execute(
        """INSERT INTO training_runs (id, tenant_id, model_name, artifact_path, metrics, row_count, created_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'))""",
        [run_id, tenant_id, model_name, artifact_path, json.dumps(metrics_payload, default=str), len(retrain_df)],
    )

    logger.info(
        "Feedback retrain complete: tenant=%s model=%s rows=%d weighted_rows=%d",
        tenant_id,
        model_name,
        len(feedback_df),
        len(retrain_df),
    )

    return {
        "status": "success",
        "model_name": model_name,
        "message": f"Retrained from {len(feedback_df)} feedback rows with weight {feedback_weight}",
        "analysis": result["analysis"],
        "metrics": metrics_payload,
    }


def _execute_segment_feedback_retrain(
    tenant_id: str,
    model_name: str,
    feedback_weight: int,
    scorer: UniversalAdaptiveScorer,
    segment_dimension: str,
    segment_value: str,
):
    """Retrain a model from feedback rows belonging to one segment hotspot."""
    target_column = scorer.analyzer.target_col
    feedback_df = _load_segment_feedback_training_frame(
        tenant_id,
        model_name,
        target_column,
        segment_dimension,
        segment_value,
    )

    if feedback_df.empty:
        raise ValueError(
            f"No feedback events found for segment '{segment_dimension}={segment_value}' on model '{model_name}'."
        )
    if len(feedback_df) < 8:
        raise ValueError(
            f"Need at least 8 matched feedback rows for segment retrain. Found {len(feedback_df)}."
        )

    weighted_frames = [feedback_df.copy() for _ in range(feedback_weight)]
    retrain_df = pd.concat(weighted_frames, ignore_index=True)

    segment_model_name = f"{model_name}__{segment_dimension}_{str(segment_value).replace(' ', '_')}"
    new_scorer = UniversalAdaptiveScorer()
    result = new_scorer.train(
        retrain_df,
        target_col=target_column,
        client_id=segment_model_name,
    )

    artifact_path = model_storage.save_model(new_scorer, tenant_id, segment_model_name)
    _set_model(tenant_id, segment_model_name, new_scorer)

    run_id = str(uuid.uuid4())
    conn = get_db()
    metrics_payload = {
        **result["metrics"],
        "training_source": "segment_feedback_events",
        "feedback_rows": int(len(feedback_df)),
        "feedback_weight": int(feedback_weight),
        "segment_dimension": segment_dimension,
        "segment_value": str(segment_value),
        "base_model_name": model_name,
    }
    if new_scorer.scorer:
        new_scorer.scorer.metadata.update(metrics_payload)
    conn.execute(
        """INSERT INTO training_runs (id, tenant_id, model_name, artifact_path, metrics, row_count, created_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'))""",
        [
            run_id,
            tenant_id,
            segment_model_name,
            artifact_path,
            json.dumps(metrics_payload, default=str),
            len(retrain_df),
        ],
    )

    logger.info(
        "Segment feedback retrain complete: tenant=%s base_model=%s segment=%s=%s rows=%d weighted_rows=%d",
        tenant_id,
        model_name,
        segment_dimension,
        segment_value,
        len(feedback_df),
        len(retrain_df),
    )

    return {
        "status": "success",
        "model_name": segment_model_name,
        "message": f"Retrained segment model for {segment_dimension}={segment_value} from {len(feedback_df)} feedback rows",
        "analysis": result["analysis"],
        "metrics": metrics_payload,
    }


def _get_segment_models_for_base(tenant_id: str, base_model_name: str):
    """Return cached segment-specialized models derived from a base model."""
    segment_models = []
    tenant_models = trained_models.get(tenant_id, {})
    for candidate_name, candidate_model in tenant_models.items():
        if candidate_name == base_model_name:
            continue
        scorer = getattr(candidate_model, "scorer", None)
        metadata = getattr(scorer, "metadata", {}) if scorer else {}
        if metadata.get("base_model_name") != base_model_name:
            continue
        if not metadata.get("segment_dimension") or metadata.get("segment_value") is None:
            continue
        segment_models.append({
            "model_name": candidate_name,
            "model": candidate_model,
            "segment_dimension": metadata.get("segment_dimension"),
            "segment_value": str(metadata.get("segment_value")),
            "feedback_rows": int(metadata.get("feedback_rows", 0) or 0),
            "accuracy": float(metadata.get("accuracy", 0.0) or 0.0),
            "roc_auc": float(metadata.get("roc_auc", 0.0) or 0.0),
        })
    return segment_models


def _route_priority(candidate: Dict) -> float:
    """Deterministic priority score for choosing between matching segment models."""
    return (
        candidate.get("feedback_rows", 0) * 1.0
        + candidate.get("roc_auc", 0.0) * 100
        + candidate.get("accuracy", 0.0) * 10
    )


def _route_and_score_rows(
    tenant_id: str,
    base_model_name: str,
    base_scorer: UniversalAdaptiveScorer,
    df: pd.DataFrame,
):
    """Score rows with segment-specialized models when they match, otherwise use base model."""
    segment_models = _get_segment_models_for_base(tenant_id, base_model_name)
    if not segment_models:
        results = base_scorer.score(df)
        for result in results:
            result["routing"] = {
                "used_model": base_model_name,
                "route_type": "base",
                "policy": "lucida_route_policy_v1",
                "reason": "no_segment_models_available",
                "candidates_considered": [],
            }
        return results

    routed_results = []
    for idx in range(len(df)):
        row_df = df.iloc[[idx]].copy()
        row_series = row_df.iloc[0]
        selected = {
            "used_model": base_model_name,
            "route_type": "base",
            "matched_segment": None,
            "policy": "lucida_route_policy_v1",
            "reason": "no_segment_match",
            "candidates_considered": [],
        }
        scorer_to_use = base_scorer
        matching_candidates = []

        for candidate in segment_models:
            dimension = candidate["segment_dimension"]
            if dimension not in row_df.columns:
                continue
            row_value = row_series.get(dimension)
            if pd.isna(row_value):
                continue
            if str(row_value) == candidate["segment_value"]:
                matching_candidates.append(candidate)

        if matching_candidates:
            ranked_candidates = sorted(
                matching_candidates,
                key=_route_priority,
                reverse=True,
            )
            chosen = ranked_candidates[0]
            scorer_to_use = chosen["model"]
            selected = {
                "used_model": chosen["model_name"],
                "route_type": "segment",
                "matched_segment": {
                    "dimension": chosen["segment_dimension"],
                    "value": chosen["segment_value"],
                },
                "policy": "lucida_route_policy_v1",
                "reason": "highest_priority_matching_segment",
                "candidates_considered": [
                    {
                        "model_name": candidate["model_name"],
                        "segment_dimension": candidate["segment_dimension"],
                        "segment_value": candidate["segment_value"],
                        "feedback_rows": candidate["feedback_rows"],
                        "accuracy": round(candidate["accuracy"], 4),
                        "roc_auc": round(candidate["roc_auc"], 4),
                        "priority_score": round(_route_priority(candidate), 4),
                    }
                    for candidate in ranked_candidates
                ],
            }

        result = scorer_to_use.score(row_df)[0]
        result["routing"] = selected
        routed_results.append(result)

    routed_results.sort(key=lambda item: item["score"], reverse=True)
    return routed_results


def _compare_against_previous_version(
    tenant_id: str,
    model_name: str,
    df: pd.DataFrame,
    current_results: list,
):
    """Compare current ranking to the previous saved model version for the same model name."""
    rows = _get_model_version_history(tenant_id, model_name, limit=2)
    if len(rows) < 2:
        return None

    previous_artifact_path = rows[1][1]
    previous_created_at = rows[1][2]

    try:
        previous_model = model_storage.load_model_from_path(previous_artifact_path)
        previous_results = previous_model.score(df.copy())
    except Exception as exc:
        logger.warning("Unable to compare previous version for tenant=%s model=%s: %s", tenant_id, model_name, exc)
        return None

    previous_index = {}
    for rank, result in enumerate(previous_results, start=1):
        previous_index[_row_signature(result.get("data", {}))] = {
            "rank": rank,
            "score": result.get("score", 0.0),
        }

    for rank, result in enumerate(current_results, start=1):
        signature = _row_signature(result.get("data", {}))
        previous = previous_index.get(signature)
        if not previous:
            result["rank_movement"] = {
                "status": "new",
                "current_rank": rank,
                "previous_rank": None,
                "rank_delta": None,
                "score_delta": None,
            }
            continue

        rank_delta = previous["rank"] - rank
        score_delta = round(float(result.get("score", 0.0) - previous.get("score", 0.0)), 2)

        status = "unchanged"
        if rank_delta > 0:
            status = "up"
        elif rank_delta < 0:
            status = "down"

        result["rank_movement"] = {
            "status": status,
            "current_rank": rank,
            "previous_rank": previous["rank"],
            "rank_delta": rank_delta,
            "score_delta": score_delta,
            "compared_to": previous_created_at,
        }

    return {
        "baseline_created_at": previous_created_at,
        "comparison_type": "previous_model_version",
    }

from fastapi import HTTPException

def _check_freemium_limits(tenant_id: str, operation: str, user_role: str = "admin", user_email: Optional[str] = None):
    """Enforce the 'only first use is free' rule."""
    if user_role == "guest" or has_full_access(user_email):
        return # Guests are already limited by the frontend to 100 rows and cannot download
        
    conn = get_db()
    result = conn.execute("SELECT plan FROM tenants WHERE id = ?", [tenant_id])
    if result.rows:
        plan = result.rows[0][0]
        if plan == "free":
            if operation == "train":
                trains = conn.execute("SELECT COUNT(*) FROM training_runs WHERE tenant_id = ?", [tenant_id]).rows[0][0]
                if trains >= 1:
                    raise HTTPException(status_code=403, detail="FREE_LIMIT_REACHED: You have already trained your free model. Please upgrade to train more.")
            elif operation == "score":
                # Check if they have scored using ANY model in the past
                scores = conn.execute("SELECT COUNT(*) FROM scored_leads WHERE tenant_id = ?", [tenant_id]).rows[0][0]
                if scores > 0: # If they have any scores saved, they already used their free scoring run
                    raise HTTPException(status_code=403, detail="FREE_LIMIT_REACHED: You have already scored your free list. Please upgrade to score more.")

# ── Train ────────────────────────────────────────────────────

@router.post("/train")
async def train_model(
    request: Request,
    file: Optional[UploadFile] = File(None),
    files: Optional[List[UploadFile]] = File(None),
    model_name: str = Query("default", description="Name for this model"),
    target_column: Optional[str] = Query(None),
    mode: str = Query("supervised", description="Training mode: 'supervised' (requires binary target) or 'unsupervised' (ranks rows without labels)"),
    user: dict = Depends(get_optional_user),
):
    """Upload CSVs → auto-merge → auto-train. Protected + tenant-scoped.
    
    Modes:
    - supervised (default): Requires a binary target column. Uses adaptive scorer for classification.
    - unsupervised: No target needed. Ranks rows using multi-criteria signals without labels.
    """
    try:
        model_name = model_storage.validate_model_name(model_name)
    except ValueError as exc:
        return error_response("VALIDATION_ERROR", str(exc), 400)
    tenant_id = user["tenant_id"]
    _check_freemium_limits(tenant_id, "train", user.get("role", "admin"), user.get("email"))
    try:
        dataset_names = _uploaded_dataset_names(file, files)
        ingested_assets = await _validate_and_ingest_files(
            file,
            files,
            target_column=target_column,
            request=request,
            context="sync training",
        )
        assets = _prepare_assets(dataset_names, ingested_assets)
        compression = _compression_summary(assets)

        logger.info("Training: tenant=%s model=%s mode=%s files=%d", tenant_id, model_name, mode, len(assets))

        df, merge_plan = _resolve_combined_dataset(assets, compression)
        logger.info("Prepared data shape: %s using strategy=%s", df.shape, merge_plan.get("strategy"))

        if len(assets) > 1 and not merge_plan.get("executed_steps") and merge_plan.get("warnings"):
            return error_response(
                "NO_SAFE_MERGE_PLAN",
                "No safe dataset relationship was found. Review merge-plan results or upload datasets with stronger keys.",
                400,
            )

        if df.shape[0] < 10:
            return error_response("TOO_FEW_ROWS", f"Need at least 10 rows, got {df.shape[0]}", 400)
        if df.shape[1] < 2:
            return error_response("TOO_FEW_COLUMNS", f"Need at least 2 columns, got {df.shape[1]}", 400)

        if mode == "unsupervised":
            from app.core.target_discovery_engine import TargetDiscoveryEngine
            # ── UNSUPERVISED MODE: Discover a synthetic target using TargetDiscoveryEngine ──
            engine = TargetDiscoveryEngine(df)
            options = engine.suggest_ranking_options()
            # Choose composite score if available, else first option
            chosen_option = 1
            for opt in options:
                if opt.get('type') == 'composite':
                    chosen_option = opt['option_id']
                    break

            df_with_synthetic, discovery_info = engine.run_discovery(user_choice=chosen_option)
            if df_with_synthetic is None:
                # Fallback if discovery fails
                df_with_synthetic = df.copy()
                df_with_synthetic["__synthetic_target__"] = (np.arange(len(df)) % 2).astype(int)

            synthetic_target_col = "__target__" if "__target__" in df_with_synthetic.columns else "__synthetic_target__"

            scorer = UniversalAdaptiveScorer()
            train_result = scorer.train(df_with_synthetic, target_col=synthetic_target_col, client_id=model_name)

            # Mark this model as unsupervised so scoring knows to rank differently
            if scorer.scorer and hasattr(scorer.scorer, 'metadata'):
                scorer.scorer.metadata['training_mode'] = 'unsupervised'
                scorer.scorer.metadata['original_columns'] = list(df.columns)
            
            train_result["analysis"]["training_mode"] = "unsupervised"
            explanation = discovery_info.get('explanation', 'ranks rows by multi-criteria signals')
            train_result["analysis"]["message"] = f"Trained in UNSUPERVISED mode: {explanation}"

        else:
            # ── SUPERVISED MODE: Standard classification with binary target ──
            scorer = UniversalAdaptiveScorer()
            train_result = scorer.train(df, target_col=target_column, client_id=model_name)

            if not target_column and train_result["analysis"]["target_diagnostics"].get("recommendation") == "manual_review_recommended":
                return error_response(
                    "AMBIGUOUS_TARGET",
                    "Automatic target detection is not reliable for this CRM export. Please provide target_column explicitly or use mode=unsupervised.",
                    400,
                )
            
            train_result["analysis"]["training_mode"] = "supervised"

        # Save model to disk
        artifact_path = model_storage.save_model(scorer, tenant_id, model_name)

        # Cache in memory
        _set_model(tenant_id, model_name, scorer)

        persistence_warning = None

        # Save training run metadata to the configured database
        try:
            run_id = str(uuid.uuid4())
            conn = get_db()
            conn.execute(
                """INSERT INTO training_runs (id, tenant_id, model_name, artifact_path, metrics, row_count, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, datetime('now'))""",
                [run_id, tenant_id, model_name, artifact_path,
                 json.dumps(train_result["metrics"], default=str), len(df)],
            )
        except Exception as exc:
            persistence_warning = f"Training succeeded but metadata persistence was unavailable: {exc}"
            logger.warning(
                "Training metadata persistence failed: tenant=%s model=%s error=%s",
                tenant_id,
                model_name,
                exc,
            )

        logger.info(
            "Training complete: tenant=%s model=%s mode=%s rows=%d",
            tenant_id, model_name, mode, len(df),
        )

        return success_response(data={
            "status": "success",
            "model_name": model_name,
            "training_mode": mode,
            "message": f"Trained on {len(df)} samples ({len(assets)} files) with {train_result['analysis']['n_features']} features" + 
                      (" - UNSUPERVISED RANKING (no target needed)" if mode == "unsupervised" else ""),
            "analysis": train_result["analysis"],
            "metrics": train_result["metrics"],
            "merge_plan": merge_plan,
            "compression": compression,
            "persistence_warning": persistence_warning,
        })

    except ValueError as e:
        logger.warning("Training validation error: %s", str(e))
        return error_response("VALIDATION_ERROR", str(e), 400)
    except Exception as e:
        logger.exception("Training failed")
        return error_response("TRAINING_FAILED", f"Training failed: {str(e)}", 500)


# ── ASYNC TRAINING ENDPOINTS (Non-blocking, Production-Ready) ───

@router.post("/train/async")
async def train_model_async(
    request: Request,
    file: Optional[UploadFile] = File(None),
    files: Optional[List[UploadFile]] = File(None),
    model_name: str = Query("default", description="Name for this model"),
    target_column: Optional[str] = Query(None),
    mode: str = Query("supervised", description="'supervised' or 'unsupervised'"),
    user: dict = Depends(get_optional_user),
):
    """
    Queue long-running training job. Returns immediately with job_id.
    
    **For production use - doesn't timeout!**
    
    Response: {job_id, status, created_at}
    Then poll: GET /train/status/{job_id}
    """
    try:
        model_name = model_storage.validate_model_name(model_name)
    except ValueError as exc:
        return error_response("VALIDATION_ERROR", str(exc), 400)
    tenant_id = user["tenant_id"]
    _check_freemium_limits(tenant_id, "train", user.get("role", "admin"), user.get("email"))
    
    try:
        files_data = await _collect_uploaded_file_payloads(
            file,
            files,
            request=request,
            context="async training",
        )

        if not files_data:
            content_type = request.headers.get("content-type", "")
            return error_response(
                "NO_FILES",
                (
                    "No files provided. Please select a CSV again and retry. "
                    f"Upload content-type received: {content_type or 'missing'}."
                ),
                400,
            )

        for filename, content in files_data:
            if not filename.lower().endswith(".csv"):
                return error_response("VALIDATION_ERROR", f"Only .csv files accepted. Got: '{filename}'", 400)
            if not content:
                return error_response("VALIDATION_ERROR", f"File '{filename}' was empty. Please choose a non-empty CSV.", 400)
            if len(content) > MAX_CSV_SIZE:
                return error_response(
                    "VALIDATION_ERROR",
                    f"File '{filename}' exceeds {MAX_CSV_SIZE_MB}MB limit ({len(content) / 1024 / 1024:.1f}MB)",
                    400,
                )
        
        # Create job in queue
        job_id = job_queue.create_job(model_name, tenant_id)
        
        # Define progress callback
        def progress_callback(progress: int, step: str):
            job_queue.update_job_progress(job_id, progress, step)
        
        # Import here to avoid circular imports
        from app.services.training_task import execute_training_task
        
        # Start background task (won't block response)
        job_queue.execute_job(
            job_id,
            execute_training_task,
            files_data=files_data,
            target_column=target_column,
            mode=mode,
            model_name=model_name,
            tenant_id=tenant_id,
            progress_callback=progress_callback,
        )
        
        logger.info(f"Created async training job {job_id} for {model_name}")
        
        return success_response(data={
            "job_id": job_id,
            "status": "queued",
            "model_name": model_name,
            "message": f"Training queued. Poll /train/status/{job_id} for updates",
            "poll_url": f"/train/status/{job_id}",
            "result_url": f"/train/{job_id}/result",
        })
    
    except Exception as e:
        logger.exception("Failed to queue training job")
        return error_response("JOB_QUEUE_ERROR", str(e), 500)


@router.get("/train/status/{job_id}")
async def get_training_status(
    job_id: str,
    user: dict = Depends(get_current_user),
):
    """
    Poll this endpoint to check training progress.
    Returns: status, progress (0-100), current_step, elapsed_time
    """
    tenant_id = user["tenant_id"]
    
    job = job_queue.get_job(job_id)
    if not job:
        return error_response("JOB_NOT_FOUND", f"Job {job_id} not found", 404)
    
    # Verify tenant ownership
    if job.tenant_id != tenant_id:
        return error_response("UNAUTHORIZED", "You don't have access to this job", 403)
    
    return success_response(data=job.to_dict())


@router.get("/train/{job_id}/result")
async def get_training_result(
    job_id: str,
    user: dict = Depends(get_current_user),
):
    """
    Get final training results when job is completed.
    Returns: metrics, model_name, target_column, dataset info
    """
    tenant_id = user["tenant_id"]
    
    job = job_queue.get_job(job_id)
    if not job:
        return error_response("JOB_NOT_FOUND", f"Job {job_id} not found", 404)
    
    # Verify tenant ownership
    if job.tenant_id != tenant_id:
        return error_response("UNAUTHORIZED", "You don't have access to this job", 403)
    
    # Check if still processing
    if job.status == JobStatus.QUEUED or job.status == JobStatus.PROCESSING:
        return error_response(
            "JOB_NOT_READY",
            f"Job still {job.status.value}. Check /train/status/{job_id}",
            202,  # 202 Accepted
        )
    
    # Check if failed
    if job.status == JobStatus.FAILED:
        return error_response("JOB_FAILED", job.error or "Unknown error", 500)
    
    # Return result
    return success_response(data={
        "job_id": job_id,
        "status": job.status.value,
        "model_name": job.model_name,
        "result": job.result,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
    })


@router.get("/train/jobs")
async def list_training_jobs(
    limit: int = Query(50, ge=1, le=100),
    user: dict = Depends(get_current_user),
):
    """
    List all training jobs for this tenant (most recent first).
    """
    tenant_id = user["tenant_id"]
    
    jobs = job_queue.list_jobs(tenant_id, limit=limit)
    
    return success_response(data={
        "jobs": jobs,
        "count": len(jobs),
        "tenant_id": tenant_id,
    })


# ── Score CSV ────────────────────────────────────────────────

@router.post("/score")
async def score_csv(
    request: Request,
    file: Optional[UploadFile] = File(None),
    files: Optional[List[UploadFile]] = File(None),
    model_name: str = Query("default", description="Model to score with"),
    auto_select_model: bool = Query(False, description="Auto-choose best model by schema compatibility"),
    include_engagement: bool = Query(True, description="Include engagement momentum scoring"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    user: dict = Depends(get_optional_user),
):
    """Upload CSVs of leads to score, enrich them with sales signals, and rank them."""
    try:
        model_name = model_storage.validate_model_name(model_name)
    except ValueError as exc:
        return error_response("VALIDATION_ERROR", str(exc), 400)
    tenant_id = user["tenant_id"]
    _check_freemium_limits(tenant_id, "score", user.get("role", "admin"), user.get("email"))

    try:
        dataset_names = _uploaded_dataset_names(file, files)
        ingested_assets = await _validate_and_ingest_files(file, files, request=request, context="scoring")
        assets = _prepare_assets(dataset_names, ingested_assets)
        compression = _compression_summary(assets)
        df, merge_plan = _resolve_combined_dataset(assets, compression)
        if df is None or df.empty:
            return error_response("VALIDATION_ERROR", "Missing lead data or empty file provided.", 400)

        selected_model_name, scorer, model_selection = _choose_model_for_dataframe(
            tenant_id, requested_model=model_name, df=df, auto_select_model=auto_select_model,
        )
        if scorer is None or selected_model_name is None:
            status_code = 409 if model_selection.get("status") == "no_confident_model_match" else 404
            return error_response(
                "MODEL_SELECTION_FAILED",
                "No confident model could be selected for this scoring payload."
                if status_code == 409 else f"No model '{model_name}' found. Train first.",
                status_code,
            )

        df, preprocessing_report = _preprocess_scoring_dataframe(scorer, df)
        results = _route_and_score_rows(tenant_id, selected_model_name, scorer, df)

        behavioral_analysis = None
        if settings.BEHAVIORAL_SIGNALS_ENABLED:
            behavioral_extractor = BehavioralSignalExtractor()
            behavioral_analysis = behavioral_extractor.analyze(df)
            behavioral_extractor.detect_columns(df)
            blend_weight = max(0.0, min(1.0, settings.BEHAVIORAL_SCORE_BLEND_WEIGHT))
            for result in results:
                profile_score = float(result.get("score", 0.0))
                behavioral = behavioral_extractor.score_lead(pd.Series(result.get("data", {})), df)
                behavioral_data = {
                    "intent_score": behavioral.intent_score,
                    "authority_score": behavioral.authority_score,
                    "trust_score": behavioral.trust_score,
                    "urgency_score": behavioral.urgency_score,
                    "momentum_score": behavioral.momentum_score,
                    "friction_score": behavioral.friction_score,
                    "relationship_strength": behavioral.relationship_strength,
                    "detected_columns": behavioral.detected_columns,
                    "top_signals": behavioral.top_signals,
                    "note_tags": behavioral.note_tags,
                    "has_behavioral_data": behavioral.has_behavioral_data,
                }
                result["profile_score"] = profile_score
                result["behavioral_signals"] = behavioral_data
                result["score"] = _blend_behavioral_score(
                    profile_score, behavioral.relationship_strength, blend_weight,
                )
                final_score = float(result["score"])
                result["score_band"] = "high" if final_score >= 80 else "medium" if final_score >= 55 else "low"

            # Psychology changes the final rank, so sort before rank tracking and persistence.
            results.sort(key=lambda item: float(item.get("score", 0.0)), reverse=True)

        rank_tracking = _compare_against_previous_version(tenant_id, selected_model_name, df, results)
        routed_count = sum(1 for row in results if row.get("routing", {}).get("route_type") == "segment")
        enriched_results = translate_scoring_results(results)

        engagement_analysis = None
        if include_engagement:
            engagement_scorer = EngagementScorer()
            engagement_analysis = engagement_scorer.analyze(df)
            action_recommender = ActionRecommender()
            for result in enriched_results:
                row = pd.Series(result.get("data", {}))
                eng_result = engagement_scorer.score_lead(row) if engagement_analysis["detected_columns"] else {}
                score_for_action = float(result.get("score", 0.0))
                result.setdefault("profile_score", score_for_action)
                result["engagement_score"] = eng_result.get("engagement_score")
                result["engagement_signals"] = eng_result.get("signals", {})
                result["engagement_band"] = eng_result.get("engagement_band")
                result["top_engagement_signals"] = eng_result.get("top_signals", [])
                action = action_recommender.recommend(score_for_action, result["engagement_score"])
                result["recommended_action"] = action["action"]
                result["action_emoji"] = action["emoji"]
                result["action_color"] = action["color"]
                result["action_priority"] = action["priority"]
                result["action_description"] = action["description"]
                result["action_next_steps"] = action["next_steps"]
                result["action_confidence"] = action["confidence"]
                result["quadrant"] = action["quadrant"]

        scoring_run_id = str(uuid.uuid4())
        background_tasks.add_task(_persist_scores, tenant_id, selected_model_name, enriched_results, scoring_run_id)
        response_data = {
            "status": "success", "model_name": selected_model_name, "scoring_run_id": scoring_run_id, "n_leads": len(enriched_results),
            "results": enriched_results, "rank_tracking": rank_tracking, "merge_plan": merge_plan,
            "compression": compression, "model_selection": model_selection,
            "preprocessing": preprocessing_report,
            "routing_summary": {"base_model": selected_model_name, "segment_routed_rows": routed_count,
                                "base_routed_rows": len(enriched_results) - routed_count},
        }
        if behavioral_analysis is not None:
            response_data["behavioral_analysis"] = {
                **behavioral_analysis, "coverage_percent": round(behavioral_analysis["coverage"], 1),
            }
        if include_engagement and engagement_analysis:
            response_data["engagement_analysis"] = {
                "detected_columns": engagement_analysis["detected_columns"],
                "signals_found": engagement_analysis["signals_found"],
                "signals_missing": engagement_analysis["signals_missing"],
                "coverage_percent": round(engagement_analysis["coverage"], 1),
            }
            response_data["action_summary"] = {}
            for result in enriched_results:
                action = result.get("recommended_action", "UNKNOWN")
                response_data["action_summary"][action] = response_data["action_summary"].get(action, 0) + 1
        return success_response(data=response_data)
    except ValueError as exc:
        return error_response("VALIDATION_ERROR", str(exc), 400)
    except Exception as exc:
        logger.exception("Scoring failed")
        message = "Scoring failed. Please retry or contact support."
        if not settings.is_production:
            message = f"Scoring failed: {exc}"
        return error_response("SCORING_FAILED", message, 500)


# ── Score CSV (legacy alias) ─────────────────────────────────

@router.post("/score-csv")
async def score_csv_legacy(
    request: Request,
    file: Optional[UploadFile] = File(None),
    files: Optional[List[UploadFile]] = File(None),
    model_name: str = Query("default"),
    auto_select_model: bool = Query(False),
    include_engagement: bool = Query(True),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    user: dict = Depends(get_optional_user),
):
    """Legacy alias for /score. Kept for backward compatibility."""
    return await score_csv(
        request=request,
        file=file,
        files=files,
        model_name=model_name,
        auto_select_model=auto_select_model,
        include_engagement=include_engagement,
        background_tasks=background_tasks,
        user=user,
    )


# ── Analyze ──────────────────────────────────────────────────

@router.post("/analyze")
async def analyze_csv(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Preview CSV analysis without training. Protected."""
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))

        analyzer = DataAnalyzer(df)
        column_types = analyzer.infer_column_types()
        target = analyzer.auto_detect_target()
        importance = analyzer.compute_feature_importance()

        return success_response(data={
            "status": "success",
            "rows": len(df),
            "columns": len(df.columns),
            "column_types": column_types,
            "detected_target": target,
            "target_diagnostics": analyzer.get_target_diagnostics(),
            "feature_importance": dict(sorted(importance.items(), key=lambda x: x[1], reverse=True)[:10]),
        })

    except Exception as e:
        return error_response("ANALYSIS_FAILED", f"Analysis failed: {str(e)}", 500)


@router.post("/feedback")
async def ingest_feedback(
    file: UploadFile = File(...),
    model_name: str = Query("default"),
    outcome_column: Optional[str] = Query(None, description="Optional binary outcome column"),
    auto_retrain: bool = Query(False, description="Automatically retrain if policy thresholds are met"),
    feedback_weight: int = Query(2, ge=1, le=10, description="Weight to use if auto retrain runs"),
    user: dict = Depends(get_current_user),
):
    """Upload actual outcome data to measure how past scores performed."""
    tenant_id = user["tenant_id"]
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
        if df.empty:
            return error_response("EMPTY_FEEDBACK_FILE", "Feedback CSV is empty.", 400)

        analyzer = DataAnalyzer(df, target_col=outcome_column)
        analyzer.infer_column_types()
        detected_target = analyzer.auto_detect_target()
        encoded_outcomes = analyzer._encode_binary(detected_target)

        conn = get_db()
        recent_scores = conn.execute(
            """SELECT lead_signature, lead_data, final_score, scored_at
               FROM scored_leads
               WHERE tenant_id = ? AND model_name = ?
               ORDER BY scored_at DESC
               LIMIT 5000""",
            [tenant_id, model_name],
        ).rows

        if not recent_scores:
            return error_response("NO_SCORES_FOUND", f"No scored leads found for model '{model_name}'. Score leads before uploading feedback.", 404)

        score_index = {}
        for idx, row in enumerate(recent_scores, start=1):
            signature = row[0]
            score_index.setdefault(signature, {
                "lead_data": json.loads(row[1]) if row[1] else {},
                "predicted_score": float(row[2]) if row[2] is not None else 0.0,
                "scored_at": row[3],
                "rank_at_score_time": idx,
            })

        matched_feedback = []
        for idx, row in df.iterrows():
            row_data = row.to_dict()
            outcome_value = int(encoded_outcomes.iloc[idx])
            feature_payload = {}
            for key, value in row_data.items():
                if key == detected_target:
                    continue
                if hasattr(value, "item"):
                    feature_payload[key] = value.item()
                elif pd.isna(value):
                    feature_payload[key] = None
                else:
                    feature_payload[key] = value

            signature = _row_signature(feature_payload)
            prior_score = score_index.get(signature)
            if prior_score:
                matched_feedback.append({
                    "lead_signature": signature,
                    "lead_data": feature_payload,
                    "actual_outcome": outcome_value,
                    "predicted_score": prior_score["predicted_score"],
                    "rank_at_score_time": prior_score["rank_at_score_time"],
                    "scored_at": prior_score["scored_at"],
                })

        if not matched_feedback:
            return error_response(
                "NO_FEEDBACK_MATCHES",
                "No feedback rows matched previously scored leads. Upload the same lead fields used during scoring.",
                400,
            )

        predicted_binary = [1 if row["predicted_score"] >= 50 else 0 for row in matched_feedback]
        actuals = [row["actual_outcome"] for row in matched_feedback]
        predicted_scores = [row["predicted_score"] / 100 for row in matched_feedback]

        try:
            feedback_auc = float(roc_auc_score(actuals, predicted_scores)) if len(set(actuals)) > 1 else None
        except Exception:
            feedback_auc = None

        accuracy = float(accuracy_score(actuals, predicted_binary))
        precision = float(precision_score(actuals, predicted_binary, zero_division=0))
        recall = float(recall_score(actuals, predicted_binary, zero_division=0))

        avg_positive_score = float(np.mean([row["predicted_score"] for row in matched_feedback if row["actual_outcome"] == 1])) if any(row["actual_outcome"] == 1 for row in matched_feedback) else 0.0
        avg_negative_score = float(np.mean([row["predicted_score"] for row in matched_feedback if row["actual_outcome"] == 0])) if any(row["actual_outcome"] == 0 for row in matched_feedback) else 0.0

        top_misses = []
        for row, predicted_label in zip(matched_feedback, predicted_binary):
            if predicted_label == row["actual_outcome"]:
                continue
            top_misses.append({
                "lead_data": row["lead_data"],
                "predicted_score": row["predicted_score"],
                "actual_outcome": row["actual_outcome"],
                "rank_at_score_time": row["rank_at_score_time"],
                "miss_type": "high_score_miss" if row["actual_outcome"] == 0 else "low_score_win",
                "gap": round(abs(row["predicted_score"] - (100 if row["actual_outcome"] == 1 else 0)), 2),
            })
        top_misses = sorted(top_misses, key=lambda item: item["gap"], reverse=True)[:5]

        training_run_rows = conn.execute(
            """SELECT id FROM training_runs
               WHERE tenant_id = ? AND model_name = ?
               ORDER BY created_at DESC LIMIT 1""",
            [tenant_id, model_name],
        ).rows
        training_run_id = training_run_rows[0][0] if training_run_rows else None

        for row in matched_feedback:
            feedback_id = str(uuid.uuid4())
            score_band = "high" if row["predicted_score"] >= 80 else "medium" if row["predicted_score"] >= 55 else "low"
            conn.execute(
                """INSERT INTO feedback_events (
                       id, tenant_id, training_run_id, model_name, lead_signature, actual_outcome,
                       predicted_score, score_band, rank_at_score_time, feedback_source, lead_data, feedback_at
                   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))""",
                [
                    feedback_id,
                    tenant_id,
                    training_run_id,
                    model_name,
                    row["lead_signature"],
                    row["actual_outcome"],
                    row["predicted_score"],
                    score_band,
                    row["rank_at_score_time"],
                    "csv_upload",
                    json.dumps(row["lead_data"], default=str),
                ],
            )

        learning_signal = {
            "matched_rows": len(matched_feedback),
            "unmatched_rows": int(len(df) - len(matched_feedback)),
            "actual_positive_rate": float(round(np.mean(actuals), 4)) if actuals else 0.0,
            "avg_score_for_actual_wins": float(round(avg_positive_score, 2)),
            "avg_score_for_actual_losses": float(round(avg_negative_score, 2)),
            "feedback_accuracy": float(round(accuracy, 4)),
            "feedback_precision": float(round(precision, 4)),
            "feedback_recall": float(round(recall, 4)),
            "feedback_roc_auc": float(round(feedback_auc, 4)) if feedback_auc is not None else None,
            "recommendation": "retrain_with_feedback" if len(matched_feedback) >= 25 else "collect_more_feedback",
            "target_column": detected_target,
            "target_diagnostics": analyzer.get_target_diagnostics(),
            "top_misses": top_misses,
        }
        auto_retrain_policy = _auto_retrain_policy(learning_signal)
        auto_retrain_result = None

        if auto_retrain and auto_retrain_policy["should_auto_retrain"]:
            scorer = _get_model(tenant_id, model_name)
            if scorer and scorer.analyzer:
                auto_retrain_result = _execute_feedback_retrain(
                    tenant_id,
                    model_name,
                    feedback_weight,
                    scorer,
                )

        return success_response(data={
            "status": "success",
            "model_name": model_name,
            "learning_signal": learning_signal,
            "auto_retrain_policy": auto_retrain_policy,
            "auto_retrain_result": auto_retrain_result,
        })

    except ValueError as e:
        return error_response("FEEDBACK_VALIDATION_ERROR", str(e), 400)
    except Exception as e:
        logger.exception("Feedback ingestion failed")
        return error_response("FEEDBACK_FAILED", f"Feedback ingestion failed: {str(e)}", 500)


# ── Retrain ──────────────────────────────────────────────────

@router.post("/retrain")
async def retrain_model(
    file: UploadFile = File(...),
    model_name: str = Query("default"),
    include_features: bool = Query(True),
    user: dict = Depends(get_current_user),
):
    """Retrain an existing model with new data. Protected + tenant-scoped."""
    tenant_id = user["tenant_id"]
    scorer = _get_model(tenant_id, model_name)

    if not scorer:
        return error_response("MODEL_NOT_FOUND", f"No model '{model_name}'. Train first.", 404)

    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))

        new_scorer = UniversalAdaptiveScorer()
        result = new_scorer.train(
            df,
            target_col=scorer.analyzer.target_col,
            client_id=model_name,
        )

        artifact_path = model_storage.save_model(new_scorer, tenant_id, model_name)
        _set_model(tenant_id, model_name, new_scorer)

        # Save training run metadata to the configured database
        run_id = str(uuid.uuid4())
        conn = get_db()
        conn.execute(
            """INSERT INTO training_runs (id, tenant_id, model_name, artifact_path, metrics, row_count, created_at)
               VALUES (?, ?, ?, ?, ?, ?, datetime('now'))""",
            [run_id, tenant_id, model_name, artifact_path,
             json.dumps(result["metrics"], default=str), len(df)],
        )

        logger.info("Retrained: tenant=%s model=%s", tenant_id, model_name)

        return success_response(data={
            "status": "success",
            "model_name": model_name,
            "message": f"Retrained on {len(df)} samples",
            "analysis": result["analysis"],
            "metrics": result["metrics"],
        })

    except Exception as e:
        logger.exception("Retrain failed")
        return error_response("RETRAIN_FAILED", f"Retrain failed: {str(e)}", 500)


@router.post("/retrain-from-feedback")
async def retrain_from_feedback(
    model_name: str = Query("default"),
    feedback_weight: int = Query(2, ge=1, le=10, description="How strongly to emphasize feedback rows"),
    user: dict = Depends(get_current_user),
):
    """Retrain a model directly from accumulated real-world feedback events."""
    tenant_id = user["tenant_id"]
    scorer = _get_model(tenant_id, model_name)

    if not scorer or not scorer.analyzer:
        return error_response("MODEL_NOT_FOUND", f"No model '{model_name}'. Train first.", 404)

    try:
        result = _execute_feedback_retrain(tenant_id, model_name, feedback_weight, scorer)
        return success_response(data=result)
    except ValueError as e:
        code = "NO_FEEDBACK_DATA" if "No feedback events" in str(e) else "INSUFFICIENT_FEEDBACK"
        status = 404 if code == "NO_FEEDBACK_DATA" else 400
        return error_response(code, str(e), status)
    except Exception as e:
        logger.exception("Feedback retrain failed")
        return error_response("FEEDBACK_RETRAIN_FAILED", f"Feedback retrain failed: {str(e)}", 500)


@router.post("/retrain-segment-feedback")
async def retrain_segment_from_feedback(
    model_name: str = Query("default"),
    segment_dimension: str = Query(...),
    segment_value: str = Query(...),
    feedback_weight: int = Query(2, ge=1, le=10),
    user: dict = Depends(get_current_user),
):
    """Retrain a segment-specialized model from feedback rows in one cohort."""
    tenant_id = user["tenant_id"]
    scorer = _get_model(tenant_id, model_name)

    if not scorer or not scorer.analyzer:
        return error_response("MODEL_NOT_FOUND", f"No model '{model_name}'. Train first.", 404)

    try:
        result = _execute_segment_feedback_retrain(
            tenant_id,
            model_name,
            feedback_weight,
            scorer,
            segment_dimension,
            segment_value,
        )
        return success_response(data=result)
    except ValueError as e:
        code = "NO_SEGMENT_FEEDBACK_DATA" if "No feedback events found" in str(e) else "INSUFFICIENT_SEGMENT_FEEDBACK"
        status = 404 if code == "NO_SEGMENT_FEEDBACK_DATA" else 400
        return error_response(code, str(e), status)
    except Exception as e:
        logger.exception("Segment feedback retrain failed")
        return error_response("SEGMENT_FEEDBACK_RETRAIN_FAILED", f"Segment feedback retrain failed: {str(e)}", 500)
