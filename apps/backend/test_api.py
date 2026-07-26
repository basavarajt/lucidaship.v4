import urllib.request
import urllib.error
import urllib.parse
import json
import uuid

# Dummy CSV
csv_data = b"Company Name,Employee Count,target\nTest Co,100,won\nAnother Co,200,lost\n"

boundary = uuid.uuid4().hex
body = (
    f"--{boundary}\r\n"
    f'Content-Disposition: form-data; name="file"; filename="test.csv"\r\n'
    f'Content-Type: text/csv\r\n\r\n'
).encode('utf-8') + csv_data + f"\r\n--{boundary}--\r\n".encode('utf-8')

url = "https://lucida-backend-201742003125.us-central1.run.app/score-csv?model_name=Ensemble-01&auto_select_model=false"
req = urllib.request.Request(url, data=body, method="POST")
req.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')

try:
    resp = urllib.request.urlopen(req)
    print("Success:", resp.read().decode())
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code)
    print("Body:", e.read().decode())
except Exception as e:
    print("Other Error:", e)
