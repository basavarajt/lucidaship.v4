# 🚀 LUCIDA FULL STACK STARTUP GUIDE

## Status: ✅ Ready to Run

Both frontend and backend are configured and ready to start. Follow these steps to run the complete Lucida system.

---

## Quick Start (5 minutes)

### Terminal 1: Backend (FastAPI)
```bash
cd /workspaces/lucidaanalytics-v3.0/apps/backend

# Activate virtual environment
source .venv/bin/activate

# Install dependencies (if needed)
pip install -q -r requirements.txt

# Start backend server on port 8000
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Expected output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
```

**API Health Check:**
```bash
curl http://localhost:8000/health
```

---

### Terminal 2: Frontend (React + Vite)
```bash
cd /workspaces/lucidaanalytics-v3.0/apps/frontend

# Start development server on port 5173
npm run dev
```

**Expected output:**
```
  VITE v4.X.X  ready in XXX ms

  ➜  Local:   http://127.0.0.1:5173/
  ➜  press h to show help
```

---

## Accessing the Application

### Frontend (React UI)
- **URL:** http://localhost:5173
- **Port:** 5173
- **Status:** Will connect to backend at http://localhost:8000
- **Client JS:** `/src/api/client.js` handles all API calls

### Backend (FastAPI)
- **URL:** http://localhost:8000
- **Port:** 8000
- **API Docs:** http://localhost:8000/docs (Swagger UI)
- **Database:** SQLite local DB (`lucida_local.db`)

---

## Configuration

### Frontend Environment
**File:** `/apps/frontend/.env.local`
```
VITE_API_URL=http://localhost:8000
VITE_MASTER_KEY=change-me
```

### Backend Environment
**File:** `/apps/backend/.env`
```
ENVIRONMENT=development
TURSO_DATABASE_URL=  (empty for SQLite)
CLERK_SECRET_KEY=    (empty for dev)
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
MODEL_ARTIFACTS_DIR=./model_artifacts
```

---

## Troubleshooting

### Frontend won't connect to backend
**Symptom:** React app loads but API calls fail
**Check:** Backend is running on port 8000
```bash
# In another terminal:
curl http://localhost:8000/health
# Should return 200 OK
```

### Port already in use
**Symptom:** "Address already in use"
**Solution:** 
```bash
# Find process on port 8000
lsof -i :8000

# Find process on port 5173
lsof -i :5173

# Kill the process
kill -9 <PID>
```

### Dependencies not installed
**Frontend:**
```bash
cd /workspaces/lucidaanalytics-v3.0/apps/frontend
npm install
```

**Backend:**
```bash
cd /workspaces/lucidaanalytics-v3.0/apps/backend
source .venv/bin/activate
pip install -r requirements.txt
```

---

## Full Stack Architecture

```
FRONTEND (React + Vite)
├─ Port: 5173
├─ Handler: App.jsx
├─ API Client: src/api/client.js
├─ Pages: src/pages/
│  ├─ Dashboard.jsx
│  ├─ Academy.jsx
│  ├─ Login.jsx
│  └─ Register.jsx
└─ Styles: Tailwind CSS + PostCSS

          ↓ HTTP/REST (axios)
          
BACKEND (FastAPI + Uvicorn)
├─ Port: 8000
├─ Entry: main.py
├─ Routes: app/api/scoring.py
├─ Core: app/core/
│  ├─ config.py (settings)
│  ├─ auth.py (Clerk JWT)
│  └─ responses.py (response templates)
├─ Services: app/services/
│  ├─ model_storage.py (joblib models)
│  └─ explanation_translator.py (scoring output)
├─ Core Logic: adaptive_scorer.py (UniversalAdaptiveScorer)
└─ Database: SQLite (lucida_local.db)
```

---

## What You Can Do

### After Startup
1. **Access Dashboard:** http://localhost:5173
2. **View API Docs:** http://localhost:8000/docs
3. **Upload CSV:** Use dashboard to upload leads
4. **Train Model:** Select ranking option, train
5. **Score Leads:** Get rankings + explanations

### Using the API Directly
```bash
# Discover target (check for binary column)
curl -X POST http://localhost:8000/api/discover \
  -F "file=@leads.csv"

# Train model with option
curl -X POST http://localhost:8000/api/train \
  -F "file=@leads.csv" \
  -F "option_id=1"

# Score new leads
curl -X POST http://localhost:8000/api/score \
  -H "Content-Type: application/json" \
  -d '{
    "leads": [
      {"name": "Alice", "emails_sent": 15, "calls": 5},
      {"name": "Bob", "emails_sent": 3, "calls": 1}
    ]
  }'
```

---

## Development Commands

### Frontend
```bash
cd /workspaces/lucidaanalytics-v3.0/apps/frontend

# Development server
npm run dev

# Production build
npm run build

# Lint code
npm run lint

# Preview production build
npm run preview
```

### Backend
```bash
cd /workspaces/lucidaanalytics-v3.0/apps/backend

# Activate environment
source .venv/bin/activate

# Run tests
python -m pytest tests/ -v

# Run with auto-reload
uvicorn main:app --reload

# Production (gunicorn)
gunicorn main:app -w 2 -k uvicorn.workers.UvicornWorker
```

---

## Next: Implementing Unsupervised Ranking

Once both frontend and backend are running successfully, we can:

1. **Create UnsupervisedRankingEngine class** (Week 1)
   - Copy from `IMPLEMENTATION_CODE_SKELETON.md`
   - Test in Python REPL

2. **Integrate with scoring.py** (Week 2)
   - Import new engine
   - Use in `/api/train` endpoint
   - Use in `/api/score` endpoint

3. **Enhance routing ledger** (Week 3)
   - Add signal decomposition
   - Add explainability data
   - Update response structure

4. **Update frontend UI** (Week 4)
   - Display ranking scores + confidence
   - Show signal decomposition
   - Show routing reason

5. **File patent** (Week 16)
   - Specification ready
   - Claims ready
   - USPTO filing

---

## Codespaces-Specific

### Port Forwarding
If running in Codespaces:
1. Frontend tab will auto-show on port 5173
2. Backend tab will show on port 8000
3. Both accessible via web interface

### Terminal Limits
- 3 terminal windows available
- Window 1: Backend process
- Window 2: Frontend process
- Window 3: CLI commands

### Viewing Logs
```bash
# In same terminal, use Cmd+^C to stop server
# Then view logs with tail
tail -f ~/.pm2/logs/*

# Or use separate terminal window
```

---

## Success Checklist

- [ ] Backend running on http://localhost:8000
- [ ] Frontend running on http://localhost:5173
- [ ] API docs visible at http://localhost:8000/docs
- [ ] Frontend loads without CORS errors
- [ ] Can upload CSV from dashboard
- [ ] Can train model
- [ ] Can score leads
- [ ] Routing ledger shows results

---

## Performance Expectations

| Component | Expected | Target |
|-----------|----------|--------|
| Frontend load | <2s | <3s |
| API response | <500ms | <1s |
| Model training | <30s | <60s |
| Score batch (100 rows) | <1s | <2s |
| Ranking computation | <1ms/row | <2ms/row |

---

## Next Steps

**After verifying both are running:**

1. Upload test CSV from `/workspaces/lucidaanalytics-v3.0/sample_data/` (if exists)
2. Follow dashboard flow to train model
3. Score some leads
4. Note any errors or performance issues
5. Begin UnsupervisedRankingEngine implementation (Week 1 of roadmap)

---

**Status:** ✅ System ready to run  
**Estimated Time:** 5 minutes to full startup  
**Next Phase:** Implementation of unsupervised ranking (16 weeks)

