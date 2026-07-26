import asyncio
import os
import json
import pandas as pd
from app.services import model_storage
from app.api.scoring import _route_and_score_rows, translate_scoring_results

def test():
    # Find the tenant ID and model
    tenant_ids = os.listdir("model_artifacts")
    if not tenant_ids:
        print("No models found")
        return
    tenant_id = tenant_ids[0]
    
    try:
        model = model_storage.load_model(tenant_id, "Ensemble-01")
        if not model:
            print("Model Ensemble-01 not found")
            return
            
        print("Model loaded successfully")
        
        # Create dummy df with all the columns the model expects
        expected_cols = model.analyzer.df.columns if hasattr(model, 'analyzer') else []
        df_dict = {col: [0] for col in expected_cols}
        df = pd.DataFrame(df_dict)
        
        print("Scoring...")
        results = _route_and_score_rows(tenant_id, "Ensemble-01", model, df)
        print("Scored successfully, enriching...")
        enriched = translate_scoring_results(results)
        print("Done!")
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test()
