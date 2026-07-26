"""RESTful v1 lead scoring API."""

from __future__ import annotations

import io
import hashlib
import json

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.config import get_settings
from app.db.session import get_session
from app.models.entities import Lead, LeadSignal
from app.models.schemas import (
    DatasetUploadResponse,
    ExplainRequest,
    ExplainResponse,
    FeedbackRequest,
    FeedbackResponse,
    ScoreRequest,
    ScoreResponse,
    SignalRecord,
    SignalsResponse,
)
from app.services.feedback_learning import FeedbackLearningService
from app.services.lead_scoring import LeadScoringService


router = APIRouter(prefix="/v1", tags=["Lead Scoring v1"])
settings = get_settings()

scoring_service = LeadScoringService(
    cache_ttl_seconds=settings.SCORE_CACHE_TTL_SECONDS,
    signal_cache_ttl_seconds=settings.SIGNAL_CACHE_TTL_SECONDS,
)
feedback_service = FeedbackLearningService()


@router.post("/score", response_model=ScoreResponse)
def score_leads(
    request: ScoreRequest,
    user: dict = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ScoreResponse:
    rows = [dict(lead.attributes, lead_id=lead.lead_id) for lead in request.leads]
    artifacts = scoring_service.score_leads(
        session,
        tenant_id=user["tenant_id"],
        model_name=request.model_name,
        leads=rows,
        use_cache=request.use_cache,
    )
    session.commit()
    return ScoreResponse(model_name=request.model_name, cached=artifacts.cached, results=artifacts.response_rows)


@router.post("/explain", response_model=ExplainResponse)
def explain_leads(
    request: ExplainRequest,
    user: dict = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ExplainResponse:
    rows = [dict(lead.attributes, lead_id=lead.lead_id) for lead in request.leads]
    artifacts = scoring_service.score_leads(
        session,
        tenant_id=user["tenant_id"],
        model_name=request.model_name,
        leads=rows,
        use_cache=True,
    )
    session.commit()
    return ExplainResponse(model_name=request.model_name, explanations=artifacts.response_rows)


@router.post("/feedback", response_model=FeedbackResponse)
def record_feedback(
    request: FeedbackRequest,
    user: dict = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FeedbackResponse:
    try:
        model, feedback = feedback_service.record_feedback(
            session,
            tenant_id=user["tenant_id"],
            lead_id=request.lead_id,
            model_name=request.model_name,
            converted=request.converted,
            notes=request.notes,
            metadata=request.metadata,
        )
    except ValueError as exc:
        session.rollback()
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    session.commit()
    return FeedbackResponse(
        lead_id=request.lead_id,
        model_name=request.model_name,
        converted=request.converted,
        adaptive_weights=(model.config or {}).get("adaptive_weights", {}),
        updated_at=feedback.timestamp,
    )


@router.post("/dataset/upload", response_model=DatasetUploadResponse)
async def upload_dataset(
    file: UploadFile = File(...),
    id_column: str | None = Query(None),
    user: dict = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> DatasetUploadResponse:
    contents = await file.read()
    df = pd.read_csv(io.BytesIO(contents))

    created_ids = []
    for _, row in df.iterrows():
        payload = {key: (None if pd.isna(value) else value.item() if hasattr(value, "item") else value) for key, value in row.items()}
        lead_id = str(payload.get(id_column)) if id_column and payload.get(id_column) is not None else None
        lead = Lead(
            tenant_id=user["tenant_id"],
            external_id=lead_id,
            data=payload,
            signature=hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode("utf-8")).hexdigest(),
        )
        session.add(lead)
        session.flush()
        created_ids.append(lead.id)

    session.commit()
    return DatasetUploadResponse(
        dataset_name=file.filename or "uploaded.csv",
        rows_ingested=len(df),
        leads_created=len(created_ids),
        columns=[str(column) for column in df.columns],
        preview_ids=created_ids[:5],
    )


@router.get("/signals", response_model=SignalsResponse)
def get_signals(
    lead_id: str | None = Query(None),
    model_name: str = Query("default"),
    limit: int = Query(100, ge=1, le=500),
    user: dict = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> SignalsResponse:
    stmt = (
        select(LeadSignal, Lead)
        .join(Lead, Lead.id == LeadSignal.lead_id)
        .where(Lead.tenant_id == user["tenant_id"])
        .limit(limit)
    )
    if lead_id:
        stmt = stmt.where(LeadSignal.lead_id == lead_id)

    rows = session.execute(stmt).all()
    weights = scoring_service._adaptive_weights(session, user["tenant_id"], model_name)
    signals = [
        SignalRecord(
            lead_id=signal.lead_id,
            signal_name=signal.signal_name,
            value=signal.value,
            weighted_value=signal.weighted_value,
            source_column=signal.source_column,
        )
        for signal, _lead in rows
    ]
    return SignalsResponse(count=len(signals), signals=signals, weights=weights)
