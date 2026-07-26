import asyncio
import os
from fastapi.testclient import TestClient
from main import app
from app.core.auth import get_current_user
import pandas as pd

# Override auth dependency
app.dependency_overrides[get_current_user] = lambda: {"tenant_id": os.listdir("model_artifacts")[0]}

client = TestClient(app)

def test():
    # Make dummy csv
    df = pd.DataFrame({"Company Name": ["Test Co"], "Employee Count": [100]})
    df.to_csv("test.csv", index=False)
    
    with open("test.csv", "rb") as f:
        response = client.post(
            "/score-csv?model_name=Ensemble-01&auto_select_model=false",
            files={"file": ("test.csv", f, "text/csv")}
        )
    print(response.status_code)
    print(response.json())

if __name__ == "__main__":
    test()
