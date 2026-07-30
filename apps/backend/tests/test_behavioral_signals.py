import pandas as pd
from app.services.behavioral_signals import BehavioralSignalExtractor
from app.api.scoring import _blend_behavioral_score


def test_behavioral_score_blend_is_bounded_and_weighted():
    assert _blend_behavioral_score(10, 100, 0.15) == 23.5
    assert _blend_behavioral_score(80, 20, 0.15) == 71.0
    assert _blend_behavioral_score(80, None, 0.15) == 80.0
    assert _blend_behavioral_score(150, -20, 2) == 0.0

def test_behavioral_signal_extraction():
    extractor = BehavioralSignalExtractor()
    df = pd.DataFrame({
        "visited_pricing_page": [1, 0, 1],
        "job_title": ["VP Sales", "Intern", "Director"],
        "days_since_last_activity": [2, 30, 5],
        "unsubscribed": [0, 1, 0]
    })
    
    analysis = extractor.analyze(df)
    assert "visited_pricing_page" in analysis["detected_columns"].values()
    assert "job_title" in analysis["detected_columns"].values()
    
    # Test scoring a row (VP with recent activity and pricing visit)
    row = df.iloc[0]
    result = extractor.score_lead(row, df)
    
    assert result.has_behavioral_data
    assert result.intent_score > 0
    assert result.authority_score > 50
    assert result.friction_score < 50
    assert result.relationship_strength > 0
    assert len(result.top_signals) > 0
    
    # Test scoring a row (Intern with no recent activity and unsubscribed)
    row2 = df.iloc[1]
    result2 = extractor.score_lead(row2, df)
    
    assert result2.has_behavioral_data
    assert result2.intent_score == 0
    assert result2.authority_score == 0
    assert result2.friction_score > 50
    assert result2.relationship_strength < 50
