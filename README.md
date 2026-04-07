# Lucida Monorepo

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

Cleaned, single-version repository for Lucida.

## Layout
- `apps/backend`: FastAPI + adaptive ML scoring API
- `apps/frontend`: React/Vite dashboard UI
- `docs`: architecture, API contract, and ops notes

## Runtime Baseline
- Python `3.11` or `3.12`
- Node.js `18+`
- npm `9+`

The backend ML stack is pinned to broadly compatible wheels so the project can run on typical developer laptops and cloud workspaces without depending on a newer CPU baseline.

## Quick Start

### 1) Backend
```bash
cd apps/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload
```
Backend runs at `http://localhost:8000`.

### 2) Frontend
```bash
cd apps/frontend
cp .env.example .env.local
npm install
npm run dev
```
Frontend runs at `http://localhost:5173`.

## Auth Mode
Current frontend uses a local access key (`VITE_MASTER_KEY`) for session gating.
Backend supports Clerk JWT when `CLERK_SECRET_KEY` is configured, and local dev bypass when it is not.

## Verify A Fresh Setup
```bash
cd apps/backend
python -m pytest -q
python scripts/preflight.py

cd ../frontend
npm run lint
npm run build
```

## Deployment
- Backend Docker deploy: `apps/backend/Dockerfile`
- Railway config: `apps/backend/railway.toml`
