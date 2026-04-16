# ⚡ Quick Reference: Async Training System

## Problem Solved ✅

| Before | After |
|--------|-------|
| `ERR_CONNECTION_RESET` after 15min | Unlimited training time |
| No progress feedback | Real-time 0-100% progress |
| One timeout = start over | Resilient to network issues |

---

## API Quick Reference

### 1️⃣ Start Training (Instant)
```bash
curl -X POST http://localhost:8000/train/async \
  -F "files=@data.csv" \
  -F "model_name=MyModel" \
  -F "target_column=Status" \
  -F "mode=supervised"

# Returns: {job_id: "a1b2c3d4"}
```

### 2️⃣ Check Progress (Poll Every 3-5 Seconds)
```bash
curl http://localhost:8000/train/status/a1b2c3d4

# Returns: {status: "processing", progress: 65%, current_step: "Training..."}
```

### 3️⃣ Get Results (When Done)
```bash
curl http://localhost:8000/train/a1b2c3d4/result

# Returns: {metrics: {accuracy: 0.82, roc_auc: 0.88, ...}}
```

---

## JavaScript (React)

```javascript
import { scoringApi } from './api/client.js';

// Start
const start = await scoringApi.trainAsync(modelName, files, targetCol, mode);
const jobId = start.data.job_id;

// Poll (every 3-5 seconds)
while (true) {
  const status = await scoringApi.getTrainingStatus(jobId);
  updateProgressBar(status.data.progress);
  
  if (status.data.status === 'completed') {
    const result = await scoringApi.getTrainingResult(jobId);
    showMetrics(result.data.result.metrics);
    break;
  }
  
  await sleep(3000);
}
```

---

## Deployment Checklist

- [ ] Files created: `job_queue.py`, `training_task.py`
- [ ] Files updated: `main.py`, `scoring.py`, `client.js`
- [ ] Backend restarted: `uvicorn main:app --reload`
- [ ] Test: `POST /train/async` returns job_id in <100ms
- [ ] Test: `GET /train/status/{job_id}` shows progress
- [ ] Test: `GET /train/{job_id}/result` returns metrics

---

## Production Settings

```env
# .env (optional)
JOB_QUEUE_MAX_WORKERS=10        # Concurrent jobs
JOB_RETENTION_HOURS=72          # Keep jobs for 3 days
UPLOAD_COMPRESSION_ENABLED=true # Keep TurboQuant on
```

---

## Monitoring

### Healthy System
- Training starts: `progress: 5%` (within 5 seconds)
- Training progressing: `progress: 15%, 35%, 72%...` (every 3-5 polls)
- Training complete: `status: completed`, `progress: 100%`

### Issues to Watch
- Job stuck at `progress: 5%` → Restart backend
- `Job not found` after 24h → Increase retention or retrain
- Multiple jobs stalled → Increase `MAX_WORKERS`

---

## vs. Old Sync System

| Feature | Sync (`/train`) | Async (`/train/async`) |
|---------|---|---|
| Timeout risk | ❌ Yes (60s) | ✅ No |
| Large datasets | ❌ Fails | ✅ Works |
| User feedback | ❌ None | ✅ Live progress |
| Backward compat | ✅ Still works | ✅ New best practice |

**Recommendation**: Use async for all new implementations.

---

## Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `"Job not found"` (404) | Job cleaned up | Retrain within 24h |
| `"Job still processing"` (202) | Querying too early | Wait for `status: "completed"` |
| Progress stuck at 5% | Backend issue | Restart: `Ctrl+C` + rerun uvicorn |
| Too many concurrent jobs | Queue full | Increase `MAX_WORKERS` in config |

---

## Expected Performance

- **10K rows**: 10-15 seconds
- **100K rows**: 60-120 seconds
- **500K rows**: 3-5 minutes
- **Plus network time**: Add 10-20% for overhead

---

## For Your Clients

Tell them:
- ✅ Submit training → See real-time progress → Get results
- ✅ No more "Your request timed out" messages
- ✅ Train on unlimited dataset sizes
- ✅ Network hiccup? Just retry, training continues

</ **Cheat Sheet for Developers**

Quick Test (Full Flow):

```bash
# 1. Start
JOB=$(curl -s -X POST http://localhost:8000/train/async \
  -F "files=@data.csv" \
  -F "model_name=Test" \
  -F "mode=supervised" | jq -r .data.job_id)

# 2. Poll until done
while true; do
  curl -s http://localhost:8000/train/status/$JOB | jq '.data | {status, progress, step: .current_step}'
  [ $(curl -s http://localhost:8000/train/status/$JOB | jq -r .data.status) = "completed" ] && break
  sleep 3
done

# 3. Get results
curl -s http://localhost:8000/train/$JOB/result | jq '.data.result.metrics'
```

---

**Still have questions?** See:
- 📖 `docs/ASYNC_TRAINING_API.md` - Full API docs
- 🚀 `PRODUCTION_DEPLOYMENT_GUIDE.md` - Deployment guide
- 💾 `apps/backend/app/services/job_queue.py` - Implementation details
