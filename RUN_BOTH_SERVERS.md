# 🚀 LUCIDA BACKEND + FRONTEND - RUN TOGETHER

## Status: Ready to Launch Full Stack

Both the backend (FastAPI) and frontend (React) are fully configured and ready to run simultaneously.

---

## 3-Step Quick Start

### Step 1️⃣: Open Terminal 1 for Backend
```bash
cd /workspaces/lucidaanalytics-v3.0/apps/backend
source .venv/bin/activate
pip install -q -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000 --timeout-keep-alive 600
```

**NOTE: Added `--timeout-keep-alive 600`** (10 minutes) for long-running training requests

**Expected Output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
```

---

### Step 2️⃣: Open Terminal 2 for Frontend  
```bash
cd /workspaces/lucidaanalytics-v3.0/apps/frontend
npm run dev
```

**Expected Output:**
```
  VITE v5.X.X  ready in XXX ms

  ➜  Local:   http://127.0.0.1:5173/
```

---

### Step 3️⃣: Access in Browser
- **Frontend**: http://localhost:5173
- **API Docs**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

---

## What You'll See

### Terminal 1 (Backend - Port 8000)
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
```

### Terminal 2 (Frontend - Port 5173)
```
  VITE v5.4.3  ready in 234 ms

  ➜  Local:   http://127.0.0.1:5173/
  ➜  press h + enter to show help
```

### Browser (localhost:5173)
```
✓ Lucida Dashboard loads
✓ React UI renders
✓ Can upload CSV
✓ Can start training flow
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                  LUCIDA FULL STACK                       │
└─────────────────────────────────────────────────────────┘

BROWSER (User)
    ↓
    ├─── Frontend (React + Vite)
    │    Port 5173
    │    ├─ Dashboard page
    │    ├─ CSV upload interface
    │    ├─ Training flow UI
    │    ├─ Scoring display
    │    └─ Academy page
    │
    └─── API Calls (HTTP/REST)
         ↓
    Backend (FastAPI + Uvicorn)
    Port 8000
    ├─ /api/discover       (CSV analysis)
    ├─ /api/train         (Model training)
    ├─ /api/score         (Scoring)
    ├─ /health            (Health check)
    ├─ /docs              (Swagger UI)
    └─ Database Layer (SQLite)
```

---

## Environment Configuration

### Backend (.env)
Located: `/workspaces/lucidaanalytics-v3.0/apps/backend/.env`
```
ENVIRONMENT=development
TURSO_DATABASE_URL=
CLERK_SECRET_KEY=
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
MODEL_ARTIFACTS_DIR=./model_artifacts
```

### Frontend (.env.local)
Located: `/workspaces/lucidaanalytics-v3.0/apps/frontend/.env.local`
```
VITE_API_URL=http://localhost:8000
VITE_MASTER_KEY=change-me
```

---

## How They Communicate

```
1. Frontend (React) makes HTTP request to Backend
   ➜ Example: Upload CSV file

2. Backend (FastAPI) receives request
   ➜ Analyzes CSV
   ➜ Detects if target exists
   ➜ Returns options to frontend

3. Frontend displays options to user
   ➜ User selects ranking option

4. Frontend sends training request to Backend
   ➜ Backend trains model
   ➜ Returns model_id

5. Frontend stores model_id
   ➜ Can now use for scoring

6. User requests scoring
   ➜ Frontend sends leads to Backend
   ➜ Backend returns scored results
   ➜ Frontend displays rankings
```

---

## Key Endpoints (API)

### Health Check
```bash
GET http://localhost:8000/health
Response: 200 OK
```

### API Documentation
```
http://localhost:8000/docs  # Swagger UI
http://localhost:8000/redoc # ReDoc UI
```

### Training Endpoints
```bash
POST /api/discover         # Analyze CSV for targets
POST /api/train            # Train model with option
POST /api/score            # Score leads
```

---

## Real-Time Data Flow

### CSV Upload Flow
```
Frontend
  ↓ (File upload)
Backend /api/discover
  ↓ (Reads CSV)
Target Detection Engine
  ↓ (Checks for binary column)
Frontend
  ├─ "Found existing target" → Proceed
  └─ "Need to choose option" → Show options
```

### Training Flow
```
Frontend
  ↓ (User picks ranking option)
Backend /api/train
  ↓ (Creates synthetic target)
Adaptive Scorer
  ↓ (Trains model)
Model Storage
  ↓ (Saves .joblib file)
Frontend
  ↓ (Gets model_id)
Ready to score leads
```

### Scoring Flow
```
Frontend
  ↓ (Send new leads)
Backend /api/score
  ↓ (Load model)
Adaptive Scorer
  ↓ (Generate scores)
Explanation Module
  ↓ (Create explanations)
Routing Ledger
  ↓ (Document decision)
Frontend
  ↓ (Display results)
User sees ranked leads
```

---

## Monitoring

### Backend Logs (Terminal 1)
```bash
# Watch logs in real-time
tail -f logs/uvicorn.log

# Or just leave terminal open, logs print automatically
```

### Frontend Logs (Terminal 2)
```bash
# Vite shows HMR (Hot Module Reload) updates
# Watch for any errors like:
# ✗ [error] Failed to connect to API
```

### Browser Console (F12)
```javascript
// Check network tab for API calls
// Check console for CORS or JS errors
// Check Application tab for localStorage
```

---

## Testing the Integration

### Test 1: Frontend Loads
```
Action: Open http://localhost:5173
Expected: React dashboard renders
Check: No CORS errors in browser console
```

### Test 2: API Available
```bash
curl http://localhost:8000/health
Expected: 200 response or JSON success
```

### Test 3: Full CSV Flow
```
Action: 
  1. Go to http://localhost:5173
  2. Upload CSV file
  3. System detects or shows options
  4. Pick option
  5. Click Train
Expected: Model trains, returns success
```

---

## Troubleshooting

### Backend Won't Start
```bash
# Check if port 8000 is already in use
lsof -i :8000

# Kill existing process
kill -9 <PID>

# Or use different port
uvicorn main:app --reload --port 8001
```

### Frontend Won't Start
```bash
# Check if port 5173 is already in use
lsof -i :5173

# Kill existing process
kill -9 <PID>

# Or let Vite choose different port
npm run dev -- --port 5174
```

### CORS Errors
```
Error: "Access to XMLHttpRequest has been blocked by CORS policy"

Fix: Ensure backend .env has:
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

Then restart backend
```

### Dependencies Not Installed
```bash
# Backend
cd apps/backend
source .venv/bin/activate
pip install -r requirements.txt

# Frontend
cd apps/frontend
npm install
```

---

## File Locations

```
/workspaces/lucidaanalytics-v3.0/
│
├── apps/backend/
│   ├── .venv/                    (Python environment)
│   ├── main.py                   (Entry point)
│   ├── adaptive_scorer.py         (Core ML logic)
│   ├── requirements.txt           (Dependencies)
│   ├── .env                       (Configuration)
│   └── app/
│       ├── api/scoring.py         (Routes)
│       ├── core/config.py         (Settings)
│       └── database.py            (DB layer)
│
└── apps/frontend/
    ├── node_modules/             (npm packages)
    ├── package.json              (Dependencies)
    ├── .env.local                (Configuration)
    ├── vite.config.js            (Build config)
    ├── tailwind.config.js         (Styling)
    └── src/
        ├── main.jsx              (Entry point)
        ├── App.jsx               (Root component)
        ├── api/client.js         (API client)
        └── pages/                (Page components)
```

---

## What Happens Next

### Week 1 Plan
Once both are running:
1. Verify CSV upload works
2. Verify model training works
3. Verify scoring works
4. Begin implementing UnsupervisedRankingEngine

### Week 2 Plan
1. Create `lucida_unsupervised_ranking_engine.py`
2. Integrate into scoring.py
3. Test with real CSV data

### Week 3-4 Plan
1. Add Bradley-Terry feedback models
2. Add drift detection
3. Add explainability layer

---

## Success Checklist

- [ ] Backend running on port 8000
- [ ] Frontend running on port 5173  
- [ ] Frontend loads at http://localhost:5173
- [ ] API docs visible at http://localhost:8000/docs
- [ ] No CORS errors in console
- [ ] Can upload CSV from frontend
- [ ] Can select training option
- [ ] Can train model
- [ ] Logs show activity in both terminals

---

## Quick Commands Reference

```bash
# Backend - Terminal 1
cd /workspaces/lucidaanalytics-v3.0/apps/backend
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend - Terminal 2
cd /workspaces/lucidaanalytics-v3.0/apps/frontend
npm run dev

# Test endpoints - Terminal 3
curl http://localhost:8000/health
curl http://localhost:8000/docs
```

---

## Once Running

### Access Points
| Service | URL | Use |
|---------|-----|-----|
| Frontend UI | http://localhost:5173 | Main app interface |
| API Docs | http://localhost:8000/docs | Explore endpoints |
| Health | http://localhost:8000/health | Check if running |
| ReDoc | http://localhost:8000/redoc | Alternative docs |

### Monitor Activity
```bash
# Terminal 1: Backend logs appear automatically
# Terminal 2: Frontend logs appear automatically
# Browser: F12 console shows frontend logs
```

---

## You're All Set! 🚀

**Both servers are ready to run. Follow the 3-step quick start above to launch them.**

Once running, you have a working full-stack application ready for:
1. Testing the CSV upload flow
2. Verifying model training
3. Testing scoring functionality
4. Beginning unsupervised ranking implementation

**Next:** Start Terminal 1 with backend, then Terminal 2 with frontend!

