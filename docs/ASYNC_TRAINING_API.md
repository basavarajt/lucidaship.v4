# 🚀 Async Training API - Production Documentation

## Problem Solved

Previously:
- ❌ Training requests timed out after ~60 seconds
- ❌ Clients saw `ERR_CONNECTION_RESET` after 10-15 minutes
- ❌ No feedback on what was happening
- ❌ No retry mechanism

Now:
- ✅ Request returns immediately with job_id
- ✅ Client polls for status while training runs
- ✅ Training runs indefinitely without timeout
- ✅ Full progress tracking (0-100%)
- ✅ Production-ready error handling

---

## API Flow

### 1️⃣ Start Training (Returns Immediately)

**Endpoint**: `POST /train/async`

```bash
curl -X POST http://localhost:8000/train/async \
  -F "files=@amazon.csv" \
  -F "model_name=EcommerceFashion" \
  -F "target_column=Status" \
  -F "mode=supervised"
```

**Response** (instant):
```json
{
  "job_id": "a1b2c3d4",
  "status": "queued",
  "model_name": "EcommerceFashion",
  "message": "Training queued. Poll /train/status/a1b2c3d4 for updates",
  "poll_url": "/train/status/a1b2c3d4",
  "result_url": "/train/a1b2c3d4/result"
}
```

✅ **Key Point**: Response comes back in <100ms. Training starts in background.

---

### 2️⃣ Poll for Progress (Every 2-5 seconds)

**Endpoint**: `GET /train/status/{job_id}`

```bash
curl http://localhost:8000/train/status/a1b2c3d4
```

**Response** (while processing):
```json
{
  "job_id": "a1b2c3d4",
  "status": "processing",
  "progress": 65,
  "current_step": "Training sklearn models...",
  "model_name": "EcommerceFashion",
  "elapsed_seconds": 245,
  "started_at": "2026-04-14T10:30:00"
}
```

**Possible statuses**:
- `queued` - Waiting to start (shouldn't be long)
- `processing` - Training in progress (most of the time here)
- `completed` - Success, call `/train/{job_id}/result`
- `failed` - Error occurred, check `error` field
- `cancelled` - User cancelled

---

### 3️⃣ Get Results (When Complete)

**Endpoint**: `GET /train/{job_id}/result`

```bash
curl http://localhost:8000/train/a1b2c3d4/result
```

**Response** (when status = "completed"):
```json
{
  "job_id": "a1b2c3d4",
  "status": "completed",
  "model_name": "EcommerceFashion",
  "result": {
    "success": true,
    "target_column": "Status",
    "mode": "supervised",
    "dataset": {
      "rows": 128975,
      "columns": 32
    },
    "metrics": {
      "accuracy": 0.82,
      "roc_auc": 0.88,
      "precision": 0.79,
      "recall": 0.81
    }
  },
  "completed_at": "2026-04-14T10:35:30"
}
```

---

## Reference: Job Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│ 1. POST /train/async → Returns job_id                      │
│    ✓ File uploaded, job created (instant)                  │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. GET /train/status/{job_id} → Check progress             │
│    ✓ Training running, 35% complete (polling)              │
│    ✓ Training running, 72% complete (polling)              │
└──────────────────┬──────────────────────────────────────────┘
                   │
        (repeat until status ≠ "processing")
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. GET /train/{job_id}/result → Final results              │
│    ✓ Model trained, accuracy = 82%                         │
│    ✓ Ready to score leads                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Example: Full Client Workflow (TypeScript)

```typescript
// Step 1: Start training
const uploadFormData = new FormData();
uploadFormData.append('files', csvFile);
uploadFormData.append('model_name', 'MyModel');
uploadFormData.append('target_column', 'Status');
uploadFormData.append('mode', 'supervised');

const startResponse = await fetch('/train/async', {
  method: 'POST',
  body: uploadFormData,
});

const { job_id } = await startResponse.json();
console.log('Training started. Job:', job_id);

// Step 2: Poll for progress
let isComplete = false;
while (!isComplete) {
  const statusResponse = await fetch(`/train/status/${job_id}`);
  const job = await statusResponse.json();
  
  console.log(`Progress: ${job.data.progress}% - ${job.data.current_step}`);
  
  if (job.data.status === 'completed') {
    isComplete = true;
    
    // Step 3: Get results
    const resultResponse = await fetch(`/train/${job_id}/result`);
    const { result } = await resultResponse.json();
    
    console.log('Training complete!', result.metrics);
  } else if (job.data.status === 'failed') {
    console.error('Training failed:', job.data.error);
    break;
  }
  
  // Wait 3 seconds before polling again
  await new Promise(r => setTimeout(r, 3000));
}
```

---

## Error Handling

### Timeout? (Network goes down)

Status code: `502, 504`

**Solution**: Keep polling with exponential backoff. Job continues in background.

```typescript
async function pollWithBackoff(jobId, maxRetries = 10) {
  let retries = 0;
  let delay = 1000; // Start with 1 second
  
  while (retries < maxRetries) {
    try {
      const response = await fetch(`/train/status/${jobId}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.warn('Network error, retrying...', e);
    }
    
    await new Promise(r => setTimeout(r, delay));
    delay = Math.min(delay * 1.5, 10000); // Max 10 seconds
    retries++;
  }
  
  throw new Error('Max retries exceeded');
}
```

### Training Failed? (Invalid data, etc.)

Status: `failed` with error message

**Solution**: User uploads different data, correct target column, try again

```typescript
if (job.status === 'failed') {
  alert(`Training failed: ${job.error}`);
  // Show upload form again
}
```

### Job Not Found?

Status code: `404`

**Solution**: Job was cleaned up (older than 24 hours). Retrain.

---

## Performance Expectations

### Training Time by Dataset Size

| Rows | Columns | Expected Time | Status Checks |
|------|---------|---------------|---------------|
| 10K  | 10      | 10-15s        | 3-5 polls     |
| 50K  | 20      | 30-45s        | 10-15 polls   |
| 128K | 32      | 60-120s       | 20-40 polls   |
| 500K | 50      | 3-5 min       | 60-100 polls  |

### Poll Recommendations

- **Initial poll delay**: 2-5 seconds (training hasn't started yet)
- **Ongoing poll interval**: 3-5 seconds (good balance)
- **Max poll wait time**: 2 hours (safety limit)

---

## List All Jobs

**Endpoint**: `GET /train/jobs?limit=50`

```bash
curl http://localhost:8000/train/jobs
```

**Response**:
```json
{
  "jobs": [
    {
      "job_id": "a1b2c3d4",
      "status": "completed",
      "model_name": "EcommerceFashion",
      "progress": 100,
      "created_at": "2026-04-14T10:30:00",
      "completed_at": "2026-04-14T10:35:30"
    },
    {
      "job_id": "x9y8z7w6",
      "status": "processing",
      "progress": 42,
      "current_step": "Feature selection..."
    }
  ],
  "count": 2
}
```

---

## Migration from Sync to Async

### Old (Synchronous - Timeout Risk):
```typescript
const response = await fetch('/train', {
  method: 'POST',
  body: formData,
  timeout: 60000 // ❌ Times out after 1 min
});
```

### New (Asynchronous - Production Ready):
```typescript
// Start (returns immediately)
const start = await fetch('/train/async', {
  method: 'POST',
  body: formData,
});

const { job_id } = await start.json();

// Poll (continues until done, never times out)
let status = 'processing';
while (status === 'processing') {
  const response = await fetch(`/train/status/${job_id}`);
  ({ status } = await response.json());
  
  if (status !== 'processing') {
    // Get final results
    const result = await fetch(`/train/${job_id}/result`);
    return result.json();
  }
  
  await new Promise(r => setTimeout(r, 3000));
}
```

**Benefits**:
- ✅ No timeout (can train for hours)
- ✅ User sees progress
- ✅ Network blips don't kill training
-✅ Multiple clients can coexist (3 concurrent jobs)

---

## Deployment Notes

### Production Environment Variables

```env
# Optional: For distributed deployments
JOB_QUEUE_BACKEND=redis  # or memory (default)
JOB_RETENTION_HOURS=72   # Clean up jobs older than this
MAX_CONCURRENT_JOBS=10   # Allow more concurrent training jobs
```

### Scaling

Current implementation uses **in-memory job queue** with threading.

For horizontal scaling to multiple servers:
1. Replace `JobQueue` with Redis backend
2. All servers share the same job store
3. Any server can execute background tasks

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Job never starts (stuck in `queued`) | Queue worker  thread died | Restart backend |
| Job disappears after 24h | Automatic cleanup | Keep polling before 24h or querylist before cleanup |
| `curl: (7) Failed to connect` | Backend down | `uvicorn main:app --reload` |
| Progress stuck at same % | Dataset too large for available RAM | Reduce dataset size or add more RAM |

---

## Summary

✅ **For clients**: Send CSV → Get job_id → Poll status → Download results  
✅ **For servers**: No more timeouts, training runs to completion  
✅ **For operations**: 24-hour job retention, automatic cleanup, thread-safe

You're now ready for production deployments with long-running training workflows!
