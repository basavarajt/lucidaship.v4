"""Pydantic request and response schemas for the versioned API."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class LeadPayload(BaseModel):
    lead_id: str | None = None
    attributes: dict[str, Any] = Field(default_factory=dict)


class ScoreRequest(BaseModel):
    model_name: str = "default"
    leads: list[LeadPayload]
    use_cache: bool = True


class ExplanationItem(BaseModel):
    factor: str
    impact: str
    direction: str
    source_column: str | None = None
    detail: str | None = None


class ScoredLeadResponse(BaseModel):
    lead_id: str
    score: float
    rank: int
    model_name: str
    score_band: str
    explanation_summary: str | None = None
    explanations: list[ExplanationItem] = Field(default_factory=list)
    signal_count: int = 0
    component_scores: dict[str, float] = Field(default_factory=dict)


class ScoreResponse(BaseModel):
    model_name: str
    cached: bool = False
    results: list[ScoredLeadResponse]


class ExplainRequest(BaseModel):
    model_name: str = "default"
    leads: list[LeadPayload]


class ExplainResponse(BaseModel):
    model_name: str
    explanations: list[ScoredLeadResponse]


class FeedbackRequest(BaseModel):
    lead_id: str
    model_name: str = "default"
    converted: bool
    notes: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class FeedbackResponse(BaseModel):
    lead_id: str
    model_name: str
    converted: bool
    adaptive_weights: dict[str, float]
    updated_at: datetime


class DatasetUploadResponse(BaseModel):
    dataset_name: str
    rows_ingested: int
    leads_created: int
    columns: list[str]
    preview_ids: list[str] = Field(default_factory=list)


class SignalRecord(BaseModel):
    lead_id: str
    signal_name: str
    value: float
    weighted_value: float
    source_column: str | None = None


class SignalsResponse(BaseModel):
    count: int
    signals: list[SignalRecord]
    weights: dict[str, float]

