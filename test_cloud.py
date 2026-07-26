import httpx
import traceback

def test():
    url = "https://lucida-backend-201742003125.us-central1.run.app/score-csv?model_name=Ensemble-01&auto_select_model=false"
    
    # Create a tiny dummy CSV
    with open("dummy.csv", "w") as f:
        f.write("Company Name,Employee Count\nTest,10")
        
    try:
        with open("dummy.csv", "rb") as f:
            headers = {
                "Authorization": "Bearer invalid_token_123",
                "Origin": "https://lucidaanalytics.tech",
                "Content-Type": "multipart/form-data"
            }
            # We want to see the exact HTTP response (status code, headers, body)
            print(f"Sending POST to {url}...")
            res = httpx.post(url, files={"files": f}, headers=headers, timeout=60.0)
            print(f"Status: {res.status_code}")
            print(f"Headers: {res.headers}")
            print(f"Body: {res.text}")
    except Exception as e:
        print("Request failed with exception:")
        traceback.print_exc()

if __name__ == "__main__":
    test()
