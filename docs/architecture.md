# Architecture

## Backend
- FastAPI app entrypoint: `apps/backend/main.py`
- Routers:
  - `app/api/auth.py`
  - `app/api/scoring.py`
  - `app/api/models_api.py`
- DB layer: `app/database.py`
- Auth layer: `app/core/auth.py`
- Model persistence: `app/services/model_storage.py`
- Adaptive model engine: `adaptive_scorer.py`
- Feedback intelligence: scored lead snapshots plus persisted `feedback_events`
- Model intelligence: feedback-readiness summary and recent feedback timeline via `models_api.py`
- Segment intelligence: hotspot detection for drifting cohorts based on stored feedback outcomes

## Frontend
- React + Vite app in `apps/frontend`
- API client in `src/api/client.js`
- Pages in `src/pages`

## Data flow
1. User uploads CSV from dashboard
2. Frontend posts multipart file(s) to backend
3. Backend trains/scores using `UniversalAdaptiveScorer`
4. Results returned and displayed/exported in UI
5. Outcome CSVs can be uploaded later to match real results against stored score snapshots
