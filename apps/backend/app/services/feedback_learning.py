"""Adaptive feedback loop for lightweight feature-weight updates."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Feedback, Lead, LeadModel, LeadSignal
from app.services.business_weights import BusinessWeightingService


class FeedbackLearningService:
    """Stores conversion feedback and adjusts business-aware weights over time."""

    def __init__(self) -> None:
        self.weighting = BusinessWeightingService()

    def record_feedback(
        self,
        session: Session,
        *,
        tenant_id: str,
        lead_id: str,
        model_name: str,
        converted: bool,
        notes: str | None,
        metadata: dict,
    ) -> tuple[LeadModel, Feedback]:
        lead = session.get(Lead, lead_id)
        if lead is None or lead.tenant_id != tenant_id:
            raise ValueError(f"Lead '{lead_id}' was not found for this tenant.")

        model = self._get_or_create_model(session, tenant_id=tenant_id, model_name=model_name)
        feedback = Feedback(
            lead_id=lead_id,
            model_id=model.id,
            converted=converted,
            notes=notes,
            metadata_json=metadata,
        )
        session.add(feedback)
        session.flush()

        signals = session.scalars(select(LeadSignal).where(LeadSignal.lead_id == lead_id)).all()
        model.config = self._apply_adaptive_update(model.config or {}, signals, converted)
        model.updated_at = datetime.now(timezone.utc)
        session.add(model)
        session.flush()
        return model, feedback

    def _get_or_create_model(self, session: Session, *, tenant_id: str, model_name: str) -> LeadModel:
        stmt = select(LeadModel).where(LeadModel.tenant_id == tenant_id, LeadModel.name == model_name)
        model = session.scalars(stmt).first()
        if model:
            return model
        model = LeadModel(tenant_id=tenant_id, name=model_name, config={"adaptive_weights": {}})
        session.add(model)
        session.flush()
        return model

    def _apply_adaptive_update(self, config: dict, signals: list[LeadSignal], converted: bool) -> dict:
        adaptive_weights = dict((config or {}).get("adaptive_weights") or {})
        current = self.weighting.resolve_weights(adaptive_weights)
        priority_hits = self.weighting.extract_priority_hits(signal.source_column or signal.signal_name for signal in signals)

        direction = 1 if converted else -1
        learning_rate = 0.05 if converted else 0.03
        for column_name in priority_hits:
            priority_key = self.weighting.priority_key(column_name)
            if not priority_key:
                continue
            current_value = current[priority_key]
            current[priority_key] = current_value + (direction * learning_rate)

        config = dict(config or {})
        config["adaptive_weights"] = self.weighting.resolve_weights(current)
        config["last_feedback_update"] = datetime.now(timezone.utc).isoformat()
        return config
