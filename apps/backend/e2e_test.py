import asyncio
import time
import pandas as pd
from fastapi.testclient import TestClient
import json

from main import app, init_db
from app.core.auth import get_current_user

# Mock auth
app.dependency_overrides[get_current_user] = lambda: {"tenant_id": "test_tenant", "email": "test@lucida.com"}

client = TestClient(app)

def run_test():
    print("Initializing Database...")
    init_db()

    print("\n--- 1. Generating Training Data ---")
    train_df = pd.DataFrame({
        "Company": ["A", "B", "C", "D", "E"] * 20,
        "Employees": [10, 50, 200, 1000, 5000] * 20,
        "Revenue": [1e5, 5e5, 2e6, 1e7, 5e7] * 20,
        "Converted": [0, 0, 1, 1, 1] * 20
    })
    train_df.to_csv("test_train.csv", index=False)

    print("\n--- 2. Starting Async Training ---")
    with open("test_train.csv", "rb") as f:
        res = client.post(
            "/train/async?model_name=TestModel&target_column=Converted&mode=supervised",
            files={"file": ("test_train.csv", f, "text/csv")}
        )
    
    if res.status_code != 200:
        print("Training API Failed:", res.status_code, res.text)
        return
    
    data = res.json()
    job_id = data.get("job_id")
    print(f"Training Job ID: {job_id}")

    print("\n--- 3. Polling for Training Completion ---")
    completed = False
    for i in range(15):
        status_res = client.get(f"/train/status/{job_id}")
        if status_res.status_code != 200:
            print("Status API Failed:", status_res.status_code, status_res.text)
            return
        
        status_data = status_res.json()
        status = status_data.get("status")
        progress = status_data.get("progress")
        step = status_data.get("current_step")
        print(f"Poll {i+1}: Status={status}, Progress={progress}%, Step='{step}'")
        
        if status == "completed":
            completed = True
            break
        elif status == "failed":
            print("Training Failed:", status_data.get("error"))
            return
        
        time.sleep(1)

    if not completed:
        print("Training timed out.")
        return

    print("\n--- 4. Fetching Training Results ---")
    res_info = client.get(f"/train/{job_id}/result")
    print("Training metrics:", json.dumps(res_info.json().get("result", {}).get("metrics", {}), indent=2))

    print("\n--- 5. Generating Leads to Score ---")
    score_df = pd.DataFrame({
        "Company": ["X", "Y", "Z"],
        "Employees": [15, 250, 2000],
        "Revenue": [1.5e5, 3e6, 2e7]
    })
    score_df.to_csv("test_score.csv", index=False)

    print("\n--- 6. Scoring / Ranking Leads ---")
    with open("test_score.csv", "rb") as f:
        score_res = client.post(
            "/score-csv?model_name=TestModel&auto_select_model=false",
            files={"file": ("test_score.csv", f, "text/csv")}
        )
    
    if score_res.status_code != 200:
        print("Scoring API Failed:", score_res.status_code, score_res.text)
        return

    score_data = score_res.json()
    results = score_data.get("results", [])
    print(f"Successfully Scored {len(results)} Leads!")
    for idx, r in enumerate(results[:3]):
        print(f"Rank {idx+1}: Score={r.get('score')} | Data={r.get('data')}")

if __name__ == "__main__":
    run_test()
