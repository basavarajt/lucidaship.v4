from app.services.explanation_translator import ExplanationTranslator


def test_enrich_scoring_result_replaces_summary_with_human_explanation():
    translator = ExplanationTranslator()
    translator.settings.LLM_EXPLANATIONS_ENABLED = False

    result = {
        "score": 84.5,
        "score_band": "high",
        "top_drivers": ["industry_fit", "email_open_count"],
        "rationale": {
            "top_positive": [
                {"label": "industry_fit", "contribution": 0.23, "value": "SaaS"},
                {"label": "email_open_count", "contribution": 0.18, "value": 12},
            ],
            "top_negative": [
                {"label": "deal_age_days", "contribution": -0.11, "value": 47},
            ],
        },
        "routing": {
            "route_type": "segment",
            "matched_segment": {"dimension": "industry", "value": "SaaS"},
        },
        "behavioral_signals": {
            "top_signals": ["high_intent_pricing", "authority_vp"]
        }
    }

    enriched = translator.enrich_scoring_result(result)

    assert enriched["llm_explanation"]
    assert enriched["rationale_summary"] == enriched["llm_explanation"]
    assert enriched["explanation_label"] == "Phi-3 Mini Intelligence"
    assert enriched["explanation_source"] == "template_fallback"
    assert "SaaS" in enriched["llm_explanation"] or "segment-specific" in enriched["llm_explanation"]
    assert "High Intent Pricing" in enriched["llm_explanation"]
    assert "Authority Vp" in enriched["llm_explanation"]
