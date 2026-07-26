# Verify ML Model + Firebase Auth

This runbook verifies that Lucida's protected ML endpoints work locally and in production.

## Prerequisites

- Python 3.11 is installed.
- Backend dependencies are installed in `apps/backend/.venv`.
- For production, get the current Cloud Run URL from Google Cloud Console for project `lucidaanalytics-d28e1`.
- For production, get a Firebase ID token from a dedicated test user. Use a second test user token to verify tenant isolation.

## Local Verification

From `apps/backend`:

```powershell
.\.venv\Scripts\python.exe scripts\preflight.py
.\.venv\Scripts\python.exe -m pytest tests\test_adaptive_scorer.py tests\test_scoring_alignment.py tests\test_schema_preprocessing.py tests\test_upload_quantization.py tests\test_e2e_ranking.py
$env:ENVIRONMENT='development'
$env:SQLITE_DB_PATH='.local\verify_ml_auth.db'
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

In a second terminal:

```powershell
.\.venv\Scripts\python.exe scripts\verify_ml_auth.py --base-url http://127.0.0.1:8000
```

Expected result: health succeeds, local auth bypass reaches protected endpoints, async training completes, and scoring returns ranked enriched leads.

## Production Verification

Use the Cloud Run URL from Google Cloud Console. Do not rely on stale checked-in `run.app` URLs.

Recommended Cloud Run shape for the ML backend:

```powershell
gcloud run deploy lucida-backend `
  --source apps/backend `
  --region us-central1 `
  --project lucidaanalytics-d28e1 `
  --env-vars-file apps/backend/cloudrun.env.yaml `
  --memory 2Gi `
  --cpu 2 `
  --timeout 300 `
  --allow-unauthenticated
```

Keep your persistent database credentials configured as Cloud Run secrets or environment variables (set `DATABASE_URL`). If `GCS_BUCKET_NAME` is set, the Cloud Run service account must be able to read and write objects in that bucket.

```powershell
$env:LUCIDA_BACKEND_URL='https://CURRENT-CLOUD-RUN-URL'
$env:LUCIDA_FIREBASE_ID_TOKEN='PRIMARY_TEST_USER_ID_TOKEN'
$env:LUCIDA_FIREBASE_ID_TOKEN_B='SECOND_TEST_USER_ID_TOKEN'

.\.venv\Scripts\python.exe scripts\verify_ml_auth.py `
  --base-url $env:LUCIDA_BACKEND_URL `
  --token $env:LUCIDA_FIREBASE_ID_TOKEN `
  --token-b $env:LUCIDA_FIREBASE_ID_TOKEN_B `
  --expect-auth
```

Expected result: unauthenticated protected routes return `401`, authenticated `/auth/me` returns user and tenant fields, async training and scoring succeed, and the second user gets `403` for the first user's job.

## Frontend Build Checks

From `apps/frontend`:

```powershell
Copy-Item .env.production.example .env.production
# Fill in the Firebase Web App values and confirm VITE_API_URL is the Cloud Run URL.
npm run build:production
npm run build -- --mode noenv
firebase deploy --only hosting
```

The normal production build must pass using `.env.production`. The `noenv` build must fail at Vite config load with missing `VITE_FIREBASE_*` variables.

## Production GCS Check

If `GCS_BUCKET_NAME` is set on Cloud Run:

- Confirm the Cloud Run service account has bucket object read/write access.
- After production smoke training, verify a model artifact exists under the tenant/model path in the bucket.
- Restart or redeploy Cloud Run, then run the production smoke script again with the same `--model-name` if you want to prove lazy loading from GCS after a cold start.
