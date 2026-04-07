# Runbook

## Local boot
1. Start backend (`uvicorn main:app --reload` in `apps/backend`)
2. Start frontend (`npm run dev` in `apps/frontend`)
3. Open `http://localhost:5173`
4. Optional deploy preflight: `python3 scripts/preflight.py` in `apps/backend`

## Health checks
- Backend health: `GET /health`
- Backend docs: `/docs`

## Common issues
- `MODEL_NOT_FOUND`: train a model before scoring.
- `NO_SCORES_FOUND`: run scoring before uploading feedback, so the system has stored score snapshots to compare against.
- `NO_FEEDBACK_MATCHES`: make sure the feedback CSV contains the same lead fields used at scoring time, plus the actual outcome column.
- `INSUFFICIENT_FEEDBACK`: the feedback-aware retrain endpoint currently needs at least 10 matched feedback rows.
- CORS errors: verify `CORS_ORIGINS` in backend `.env`.
- Access key error: set `VITE_MASTER_KEY` in `apps/frontend/.env.local`.

## Production notes
- Set `ENVIRONMENT=production`
- Set `CLERK_SECRET_KEY` in production or the backend will now fail fast at startup
- Set explicit CORS origins (no wildcard)
- Configure Clerk keys if using JWT auth
- Use persistent storage for model artifacts and DB
- Prefer modern cloud CPUs for the backend ML stack; some older local x86 machines cannot import the pinned NumPy stack
