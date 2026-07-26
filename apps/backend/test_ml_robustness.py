import pandas as pd
import numpy as np
import json
import logging
from adaptive_scorer import UniversalAdaptiveScorer

# Configure basic logging
logging.basicConfig(level=logging.INFO)

print("=== STARTING ML ROBUSTNESS TESTS ===")

# --- Scenario 1: Standard Clean CRM Data ---
print("\n[Scenario 1] Testing with standard, clean CRM data...")
clean_data = pd.DataFrame({
    "lead_id": range(1, 101),
    "company_size": np.random.randint(1, 1000, 100),
    "annual_revenue": np.random.uniform(50000, 5000000, 100),
    "website_visits": np.random.randint(0, 50, 100),
    "email_opens": np.random.randint(0, 10, 100),
    "is_converted": np.random.choice([0, 1], 100, p=[0.7, 0.3])
})

scorer1 = UniversalAdaptiveScorer()
result1 = scorer1.train(clean_data, target_col="is_converted")
print(f"-> Train Success! Accuracy: {result1['metrics']['accuracy']:.2f}, ROC AUC: {result1['metrics']['roc_auc']:.2f}")

# --- Scenario 2: Messy Data (Missing values, messy text) ---
print("\n[Scenario 2] Testing with messy data (missing values, noisy text columns)...")
messy_data = clean_data.copy()
# Introduce NaN values
messy_data.loc[10:20, "company_size"] = np.nan
messy_data.loc[40:50, "website_visits"] = np.nan
# Add useless text columns
messy_data["sales_rep_notes"] = ["Followed up" if i % 2 == 0 else "Left voicemail" for i in range(100)]
messy_data["random_id_string"] = ["ID-" + str(i) for i in range(100)]

scorer2 = UniversalAdaptiveScorer()
result2 = scorer2.train(messy_data, target_col="is_converted")
print(f"-> Train Success! Accuracy: {result2['metrics']['accuracy']:.2f}, ROC AUC: {result2['metrics']['roc_auc']:.2f}")

# --- Scenario 3: Scoring New Leads with Missing Columns ---
print("\n[Scenario 3] Scoring new leads that are missing columns from training...")
# Create a new dataframe to score, but forget to include 'email_opens'
new_leads = pd.DataFrame({
    "lead_id": [101, 102, 103],
    "company_size": [50, np.nan, 500],
    "annual_revenue": [100000, 200000, np.nan],
    "website_visits": [5, 0, 10],
    # 'email_opens' is missing!
})

try:
    scores = scorer2.score(new_leads)
    print("-> Scoring Success! Handled missing column gracefully.")
    print(scores[['lead_id', 'conversion_probability']].head())
except Exception as e:
    print(f"-> Scoring FAILED: {e}")

print("\n=== TESTS COMPLETE ===")
