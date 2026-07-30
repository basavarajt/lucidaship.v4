import pandas as pd
import pytest

from adaptive_scorer import AdaptiveFeatureEngineering, DataAnalyzer, UniversalAdaptiveScorer


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
    assert "lift_at_20_percent" in training_result["metrics"]
    assert "expected_calibration_error" in training_result["metrics"]
    assert "recommended_threshold" in training_result["metrics"]
    assert training_result["metrics"]["model_family"] in {"xgboost", "gradient_boosting", "random_forest"}
    assert 0.0 <= training_result["metrics"]["recommended_threshold"] <= 1.0
    assert isinstance(training_result["metrics"]["candidate_models"], list)
    assert len(training_result["metrics"]["candidate_models"]) >= 1
    assert "imbalance_strategy" in training_result["metrics"]

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


def test_auto_target_detect_handles_binary_values_with_nulls_whitespace_and_mixed_types():
    df_train = pd.DataFrame(
        {
            "lead_id": [f"id-{i}" for i in range(20)],
            "interactions": [1, 2, 3, 4, 5] * 4,
            "segment": ["A", "B", "C", "A", "B"] * 4,
            "outcome": [
                "1", 1, " 1 ", "0", 0, " 0 ", None, "null", "N/A", "",
                "1", 1, "0", 0, "1", "0", " 1", " 0", "1", "0",
            ],
        }
    )

    scorer = UniversalAdaptiveScorer()
    training_result = scorer.train(df_train, client_id="binary-normalization-test")

    assert training_result["analysis"]["target_column"] == "outcome"


def test_training_requires_real_outcome_when_no_target_is_present():
    df_train = pd.DataFrame(
        {
            "lead_id": [f"id-{i}" for i in range(40)],
            "revenue": [float(i * 10 + (i % 3)) for i in range(40)],
            "sessions": [float((i % 9) + 1) for i in range(40)],
            "segment": [f"seg-{i % 4}" for i in range(40)],
        }
    )

    scorer = UniversalAdaptiveScorer()
    with pytest.raises(ValueError, match="No genuine binary outcome column"):
        scorer.train(df_train, client_id="missing-outcome-test")


def test_text_notes_are_selected_only_when_they_have_outcome_signal():
    rows = 40
    df = pd.DataFrame(
        {
            "converted": [i % 2 for i in range(rows)],
            "crm_notes": [
                f"asked for pricing and ready to buy case {i}" if i % 2
                else f"not interested, no budget case {i}"
                for i in range(rows)
            ],
            "irrelevant_notes": [f"generic follow up {i % 3}" for i in range(rows)],
        }
    )

    analyzer = DataAnalyzer(df)
    analyzer.infer_column_types()
    analyzer.auto_detect_target()
    importance = analyzer.compute_feature_importance()

    assert analyzer.column_types["crm_notes"] == "text"
    assert importance["crm_notes"] > 0
    assert "crm_notes" in analyzer.filter_relevant_columns()

    engineer = AdaptiveFeatureEngineering(df, analyzer)
    features = engineer.build_features()
    assert any(name.startswith("crm_notes_") for name in features.columns)


def test_training_removes_exact_duplicates_before_the_holdout_split():
    base = pd.DataFrame(
        {
            "lead_id": [f"id-{i}" for i in range(20)],
            "interactions": [(i % 2) * 10 + (i % 3) for i in range(20)],
            "converted": [i % 2 for i in range(20)],
        }
    )
    df = pd.concat([base, base.iloc[[0, 1]]], ignore_index=True)

    scorer = UniversalAdaptiveScorer()
    result = scorer.train(df, client_id="dedup-test")

    deduplication = result["analysis"]["deduplication"]
    assert deduplication["exact_duplicates_removed"] == 2
    assert deduplication["rows_after"] == 20
