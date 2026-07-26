"""Rule-based explanation engine built from scoring rationale and weighted signals."""

from __future__ import annotations

from typing import Any


class ExplanationEngine:
    """Generates API-friendly explanations for scored leads."""

    def build_explanations(
        self,
        lead_id: str,
        rationale: dict[str, Any],
        priority_matches: dict[str, float],
    ) -> dict[str, Any]:
        explanations = []

        for item in rationale.get("top_positive", [])[:3]:
            impact = min(abs(float(item.get("contribution", 0.0))) * 100, 99.0)
            source_column = item.get("source_column")
            factor = source_column or item.get("label", "unknown_factor")
            detail = item.get("label")
            boost_multiplier = priority_matches.get(source_column or "", 1.0)
            if boost_multiplier > 1.0:
                detail = f"{detail} boosted by business weight x{boost_multiplier:.2f}"
            explanations.append(
                {
                    "factor": factor,
                    "impact": f"+{round(impact, 1)}%",
                    "direction": "positive",
                    "source_column": source_column,
                    "detail": detail,
                }
            )

        for item in rationale.get("top_negative", [])[:2]:
            impact = min(abs(float(item.get("contribution", 0.0))) * 100, 99.0)
            explanations.append(
                {
                    "factor": item.get("source_column") or item.get("label", "unknown_factor"),
                    "impact": f"-{round(impact, 1)}%",
                    "direction": "negative",
                    "source_column": item.get("source_column"),
                    "detail": item.get("label"),
                }
            )

        return {
            "lead_id": lead_id,
            "explanations": explanations,
            "summary": rationale.get("summary"),
        }

