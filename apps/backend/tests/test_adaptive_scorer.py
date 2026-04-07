import pandas as pd

from adaptive_scorer import UniversalAdaptiveScorer


def test_training_and_scoring_emit_diagnostics_and_rationale():
    df_train = pd.DataFrame(
        {
            "lead_id": [f"id-{i}" for i in range(24)],
            "interactions": [2, 3, 5, 7, 1, 9, 11, 4, 6, 8, 10, 12, 3, 5, 7, 9, 2, 4, 6, 8, 10, 12, 14, 16],
            "segment": ["A", "A", "B", "B", "A", "B", "B", "A", "C", "C", "B", "C", "A", "B", "C", "C", "A", "B", "C", "A", "B", "C", "B", "C"],
            "last_contact_date": pd.date_range("2026-01-01", periods=24, freq="D").astype(str),
            "converted": [0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 1, 1],
        }
    )

    scorer = UniversalAdaptiveScorer()
    training_result = scorer.train(df_train, client_id="test-model")

    assert training_result["analysis"]["target_column"] == "converted"
    assert "target_diagnostics" in training_result["analysis"]
    assert training_result["analysis"]["feature_blueprint"]["n_engineered_features"] > 0
    assert "precision" in training_result["metrics"]
    assert "recall" in training_result["metrics"]

    df_score = pd.DataFrame(
        {
            "lead_id": ["new-1", "new-2", "new-3"],
            "interactions": [15, 2, 9],
            "segment": ["C", "A", "B"],
            "last_contact_date": ["2026-02-10", "2026-01-05", "2026-02-03"],
        }
    )

    results = scorer.score(df_score)

    assert len(results) == 3
    assert results[0]["score"] >= results[-1]["score"]
    assert "rationale" in results[0]
    assert "rationale_summary" in results[0]
    assert "score_band" in results[0]
    assert "ranking_version" in results[0]
