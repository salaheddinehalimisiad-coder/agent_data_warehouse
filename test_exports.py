
import requests

try:
    # Test MCD PDF
    resp = requests.get("http://localhost:8000/api/export-mcd-pdf")
    print(f"MCD PDF Status: {resp.status_code}")
    print(f"Content-Type: {resp.headers.get('Content-Type')}")
    if resp.status_code == 200:
        print("Success: MCD PDF endpoint is reachable and returns a response.")
    else:
        print(f"Error: {resp.text}")

    # Test KTR
    resp_ktr = requests.get("http://localhost:8000/api/export-ktr")
    print(f"KTR Status: {resp_ktr.status_code}")
except Exception as e:
    print(f"Connection Error: {e}")
