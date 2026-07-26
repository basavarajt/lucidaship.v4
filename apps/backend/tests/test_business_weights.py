import pandas as pd

from app.services.business_weights import BusinessWeightingService
from app.services.ranking_engine import SignalInfo, SignalType


def test_business_weights_boost_priority_columns():
    service = BusinessWeightingService()
    signal_matrix = pd.DataFrame(
        {
            "job_title_frequency": [0.4, 0.7],
            "company_size_absolute": [0.2, 0.9],
            "generic_signal": [0.5, 0.5],
        }
    )
    signal_info = {
        "job_title_frequency": SignalInfo(name="job_title_frequency", signal_type=SignalType.CATEGORICAL_FREQUENCY, source_column="job_title"),
        "company_size_absolute": SignalInfo(name="company_size_absolute", signal_type=SignalType.NUMERIC_ABSOLUTE, source_column="company_size"),
        "generic_signal": SignalInfo(name="generic_signal", signal_type=SignalType.NUMERIC_ABSOLUTE, source_column="revenue"),
    }

    weighted, _ = service.apply(signal_matrix, signal_info)

    assert weighted["job_title_frequency"].iloc[0] > signal_matrix["job_title_frequency"].iloc[0]
    assert weighted["company_size_absolute"].iloc[0] > signal_matrix["company_size_absolute"].iloc[0]
    assert weighted["generic_signal"].iloc[0] == signal_matrix["generic_signal"].iloc[0]

