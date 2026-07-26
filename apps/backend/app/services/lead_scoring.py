"""Versioned lead scoring service with caching, business weighting, and persistence."""

from __future__ import annotations

import hashlib
import json
import uuid
from dataclasses import dataclass
from typing import Any

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from adaptive_scorer import UniversalAdaptiveScorer
from app.api.scoring import trained_models
from app.models.entities import Lead, LeadModel, LeadScore, LeadSignal
from app.services.business_weights import BusinessWeightingService
from app.services.cache import TTLCache
from app.services.explanation_engine import ExplanationEngine
from app.services.ranking_engine import RankingEngine, SignalExtractor


@dataclass
class ScoringArtifacts:
    response_rows: list[dict[str, Any]]
    cached: bool
    adaptive_weights: dict[str, float]


class LeadScoringService:
    """Coordinates scoring, explanations, caching, and persistence."""

    def __init__(self, *, cache_ttl_seconds: int, signal_cache_ttl_seconds: int) -> None:
        self.score_cache = TTLCache(cache_ttl_seconds)
        self.signal_cache = TTLCache(signal_cache_ttl_seconds)
        self.weighting = BusinessWeightingService()
        self.explanations = ExplanationEngine()

    def score_leads(
        self,
        session: Session,
        *,
        tenant_id: str,
        model_name: str,
        leads: list[dict[str, Any]],
        use_cache: bool = True,
    ) -> ScoringArtifacts:
        cache_key = self._cache_key(tenant_id, model_name, leads)
        if use_cache:
            cached = self.score_cache.get(cache_key)
            if cached is not None:
                return ScoringArtifacts(response_rows=cached, cached=True, adaptive_weights=self._adaptive_weights(session, tenant_id, model_name))

        scoring_rows = [{key: value for key, value in lead.items() if key != "lead_id"} for lead in leads]
        df = pd.DataFrame(scoring_rows)
        if df.empty:
            return ScoringArtifacts(response_rows=[], cached=False, adaptive_weights=self._adaptive_weights(session, tenant_id, model_name))

        ml_results = self._ml_results(tenant_id, model_name, df)
        signal_matrix, signal_info = self._extract_signals(df)
        adaptive_weights = self._adaptive_weights(session, tenant_id, model_name)
        weighted_matrix, _ = self.weighting.apply(signal_matrix, signal_info, adaptive_weights)
        ranking = RankingEngine(df)
        ranking.signal_matrix = weighted_matrix
        ranking.signal_info = signal_info
        ranking_result = ranking.rank(top_n=len(df))

        persisted_rows = []
        for rank_position, (row_index, business_score_raw, lower_ci, upper_ci) in enumerate(ranking_result.rankings, start=1):
            source = dict(leads[row_index])
            ml_result = ml_results.get(row_index, {})
            ml_score = float(ml_result.get("score", business_score_raw * 100))
            business_score = float(round(business_score_raw * 100, 2))
            final_score = round((0.7 * ml_score) + (0.3 * business_score), 2)
            rationale = ml_result.get("rationale") or {"top_positive": [], "top_negative": [], "summary": "No rationale available."}
            priority_matches = self.weighting.extract_priority_hits(source.keys(), adaptive_weights)
            lead_id = str(source.get("lead_id") or uuid.uuid4())
            explanation = self.explanations.build_explanations(lead_id, rationale, priority_matches)
            component_scores = {
                "ml_score": round(ml_score, 2),
                "business_score": round(business_score, 2),
            }
            persisted_rows.append(
                self._persist_row(
                    session,
                    tenant_id=tenant_id,
                    model_name=model_name,
                    lead_id=lead_id,
                    source=source,
                    score=final_score,
                    rank=rank_position,
                    lower_ci=round(lower_ci * 100, 2),
                    upper_ci=round(upper_ci * 100, 2),
                    component_scores=component_scores,
                    explanation=explanation,
                    signal_matrix=signal_matrix,
                    weighted_matrix=weighted_matrix,
                    signal_info=signal_info,
                    row_index=row_index,
                )
            )

        persisted_rows.sort(key=lambda row: row["rank"])
        self.score_cache.set(cache_key, persisted_rows)
        return ScoringArtifacts(response_rows=persisted_rows, cached=False, adaptive_weights=adaptive_weights)

    def _ml_results(self, tenant_id: str, model_name: str, df: pd.DataFrame) -> dict[int, dict[str, Any]]:
        model = trained_models.get(tenant_id, {}).get(model_name)
        if not isinstance(model, UniversalAdaptiveScorer):
            return {}
        results = model.score(df)
        output: dict[int, dict[str, Any]] = {}
        for item in results:
            output[int(item["index"])] = item
        return output

    def _extract_signals(self, df: pd.DataFrame):
        cache_key = hashlib.sha256(df.to_json(date_format="iso", orient="records").encode("utf-8")).hexdigest()
        cached = self.signal_cache.get(cache_key)
        if cached is not None:
            return cached
        extractor = SignalExtractor(df)
        signal_matrix, signal_info = extractor.extract_all()
        self.signal_cache.set(cache_key, (signal_matrix, signal_info))
        return signal_matrix, signal_info

    def _adaptive_weights(self, session: Session, tenant_id: str, model_name: str) -> dict[str, float]:
        stmt = select(LeadModel).where(LeadModel.tenant_id == tenant_id, LeadModel.name == model_name)
        model = session.scalars(stmt).first()
        if not model:
            return self.weighting.resolve_weights({})
        return self.weighting.resolve_weights((model.config or {}).get("adaptive_weights"))

    def _persist_row(
        self,
        session: Session,
        *,
        tenant_id: str,
        model_name: str,
        lead_id: str,
        source: dict[str, Any],
        score: float,
        rank: int,
        lower_ci: float,
        upper_ci: float,
        component_scores: dict[str, float],
        explanation: dict[str, Any],
        signal_matrix: pd.DataFrame,
        weighted_matrix: pd.DataFrame,
        signal_info: dict,
        row_index: int,
    ) -> dict[str, Any]:
        model = self._get_or_create_model(session, tenant_id, model_name)
        signature = hashlib.sha256(json.dumps(source, sort_keys=True, default=str).encode("utf-8")).hexdigest()
        lead = session.get(Lead, lead_id)
        if not lead:
            lead = Lead(
                id=lead_id,
                tenant_id=tenant_id,
                external_id=str(source.get("lead_id")) if source.get("lead_id") else None,
                data=source,
                signature=signature,
            )
            session.add(lead)
            session.flush()
        else:
            lead.data = source
            lead.signature = signature

        score_record = LeadScore(
            lead_id=lead.id,
            model_id=model.id,
            score=score,
            rank=rank,
            confidence_lower=lower_ci,
            confidence_upper=upper_ci,
            component_scores=component_scores,
            explanation_summary=explanation.get("summary"),
        )
        session.add(score_record)

        for signal_name, value in weighted_matrix.iloc[row_index].items():
            info = signal_info.get(signal_name)
            signal_record = LeadSignal(
                lead_id=lead.id,
                signal_name=str(signal_name),
                source_column=getattr(info, "source_column", None),
                value=float(signal_matrix.iloc[row_index][signal_name]),
                weighted_value=float(value),
                metadata_json={"description": getattr(info, "description", None)},
            )
            session.add(signal_record)

        session.flush()
        return {
            "lead_id": lead.id,
            "score": score,
            "rank": rank,
            "model_name": model_name,
            "score_band": self._score_band(score),
            "explanation_summary": explanation.get("summary"),
            "explanations": explanation.get("explanations", []),
            "signal_count": int(weighted_matrix.shape[1]),
            "component_scores": component_scores,
        }

    def _get_or_create_model(self, session: Session, tenant_id: str, model_name: str) -> LeadModel:
        stmt = select(LeadModel).where(LeadModel.tenant_id == tenant_id, LeadModel.name == model_name)
        model = session.scalars(stmt).first()
        if model:
            return model
        model = LeadModel(tenant_id=tenant_id, name=model_name, config={"adaptive_weights": {}})
        session.add(model)
        session.flush()
        return model

    def _cache_key(self, tenant_id: str, model_name: str, leads: list[dict[str, Any]]) -> str:
        payload = json.dumps(leads, sort_keys=True, default=str)
        return hashlib.sha256(f"{tenant_id}:{model_name}:{payload}".encode("utf-8")).hexdigest()

    def _score_band(self, score: float) -> str:
        if score >= 80:
            return "hot"
        if score >= 55:
            return "warm"
        return "cold"
