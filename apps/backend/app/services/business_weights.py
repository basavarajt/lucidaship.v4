"""Business-aware weighting rules and adaptive weight management."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import numpy as np
import pandas as pd

from app.core.config import get_settings


settings = get_settings()


@dataclass
class WeightedSignalView:
    name: str
    source_column: str | None
    raw_value: float
    weighted_value: float
    applied_weight: float


class BusinessWeightingService:
    """Applies business-priority bias to extracted lead signals."""

    def __init__(self) -> None:
        self.default_weights = {
            "job_title": settings.BUSINESS_WEIGHT_JOB_TITLE,
            "company_size": settings.BUSINESS_WEIGHT_COMPANY_SIZE,
            "recent_activity": settings.BUSINESS_WEIGHT_RECENT_ACTIVITY,
        }

    def resolve_weights(self, adaptive_weights: dict[str, float] | None = None) -> dict[str, float]:
        weights = dict(self.default_weights)
        for key, value in (adaptive_weights or {}).items():
            if key in weights:
                weights[key] = float(np.clip(value, settings.ADAPTIVE_WEIGHT_MIN, settings.ADAPTIVE_WEIGHT_MAX))
        return weights

    def apply(
        self,
        signal_matrix: pd.DataFrame,
        signal_info: dict,
        adaptive_weights: dict[str, float] | None = None,
    ) -> tuple[pd.DataFrame, list[WeightedSignalView]]:
        weights = self.resolve_weights(adaptive_weights)
        weighted = signal_matrix.copy()
        applied_views: list[WeightedSignalView] = []

        for column in weighted.columns:
            info = signal_info.get(column)
            source_column = getattr(info, "source_column", None)
            multiplier = self._weight_for_signal(column, source_column, weights)
            if multiplier == 1.0:
                continue
            weighted[column] = weighted[column] * multiplier
            applied_views.append(
                WeightedSignalView(
                    name=column,
                    source_column=source_column,
                    raw_value=float(signal_matrix[column].mean()),
                    weighted_value=float(weighted[column].mean()),
                    applied_weight=multiplier,
                )
            )

        return weighted.clip(lower=0.0), applied_views

    def extract_priority_hits(
        self,
        columns: Iterable[str],
        adaptive_weights: dict[str, float] | None = None,
    ) -> dict[str, float]:
        weights = self.resolve_weights(adaptive_weights)
        matches: dict[str, float] = {}
        for column in columns:
            priority_key = self.priority_key(column)
            if priority_key:
                matches[str(column)] = weights[priority_key]
        return matches

    def priority_key(self, column: str | None) -> str | None:
        if not column:
            return None
        lowered = column.lower()
        if "title" in lowered or "role" in lowered:
            return "job_title"
        if "company_size" in lowered or "employee" in lowered or "headcount" in lowered:
            return "company_size"
        if "recent" in lowered or "activity" in lowered or "engagement" in lowered or "last_interaction" in lowered:
            return "recent_activity"
        return None

    def _weight_for_signal(self, signal_name: str, source_column: str | None, weights: dict[str, float]) -> float:
        for candidate in (source_column, signal_name):
            priority_key = self.priority_key(candidate)
            if priority_key:
                return weights[priority_key]
        return 1.0
