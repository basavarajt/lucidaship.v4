from app.services.explanation_engine import ExplanationEngine


def test_explanation_engine_formats_positive_and_negative_impacts():
    engine = ExplanationEngine()
    explanation = engine.build_explanations(
        "lead-123",
        {
            "summary": "Boosted by recent activity; held back by company size",
            "top_positive": [
                {"label": "Recent activity", "source_column": "recent_activity", "contribution": 0.25},
            ],
            "top_negative": [
                {"label": "Company size", "source_column": "company_size", "contribution": -0.18},
            ],
        },
        {"recent_activity": 1.4},
    )

    assert explanation["lead_id"] == "lead-123"
    assert explanation["explanations"][0]["impact"].startswith("+")
    assert explanation["explanations"][1]["impact"].startswith("-")
    assert "business weight" in explanation["explanations"][0]["detail"]
