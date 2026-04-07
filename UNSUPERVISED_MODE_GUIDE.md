# Unsupervised Training Mode - User Guide

## What Changed?

You can now upload datasets **without a binary target column**. The system supports two training modes:

| **Mode** | **Requires Target** | **Use Case** | **Output** |
|----------|-------------------|------------|----------|
| **Supervised** (default) | Yes (binary column) | Classification: predict yes/no, won/lost, etc. | Classification metrics (accuracy, ROC AUC, precision, recall) |
| **Unsupervised** (new) | No | Ranking: prioritize leads without labels | Ranking scores (1-100 percentile per row) |

## When to Use Each Mode

### Supervised Mode
```
✓ You have a target: "converted", "won_deal", "churned", "contacted"
✓ You want: Probability that something will happen
✓ Example: 87% likely to convert, so call them first
```

### Unsupervised Mode
```
✓ You DON'T have a target column
✓ You want: Rank rows by quality/potential/fit
✓ Example: Score all leads 1-100 based on profile strength,
  even without knowing who converted before
```

## How to Train Without a Binary Target

### Step 1: Go to Dashboard → Train Tab

### Step 2: Upload CSV
- Click to upload your CSV (no target column needed)
- Multiple CSVs will auto-merge on shared ID columns

### Step 3: Select Training Mode
**NEW**: Radio button options appear:
- ✓ Supervised (default)
- ✓ **Unsupervised** ← Click this to skip target requirement

### Step 4: Execute Training

**If Supervised:**
- Must specify target column (or let system auto-detect)
- Rejects if target is ambiguous → error: "AMBIGUOUS_TARGET"
- Returns classification metrics

**If Unsupervised:**
- Target column field is **ignored**
- ✅ No error about missing target
- ✅ Ships immediately to ranking engine
- Returns ranking-ready model

## Example Workflows

### Scenario 1: Housing Dataset Without Labels

**Problem Before:**
```
Error: "Automatic target detection is not reliable for this CRM export.
Please provide target_column explicitly."
```

**Solution Now:**
1. Upload housing_london_yearly_variables.csv
2. Leave "Target Column" blank
3. Select "Unsupervised" mode
4. Click "EXECUTE TRAINING SEQUENCE"
5. ✅ Success! Model trained on all rows ranked by signal strength

### Scenario 2: B2B Lead List

**Dataset has:**
- Company size
- Annual revenue  
- Industry
- Website traffic
- No "contacted" or "converted" column

**Old approach:** 
- Can't train without binary target
- Error rejected upload

**New approach:**
1. Upload complete lead list
2. Select Unsupervised mode
3. System ranks by estimated lead quality
4. Sales team works top-ranked leads first
5. Feedback on actual conversions trains supervised model later

## API Usage

### cURL Example - Unsupervised Training

```bash
curl -X POST "http://localhost:8000/train?model_name=leads-v1&mode=unsupervised" \
  -F "file=@housing_data.csv" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### JavaScript/Frontend

```javascript
import { scoringApi } from './api/client';

// Train unsupervised (no target required)
const response = await scoringApi.train(
  'my-model', 
  [csvFile], 
  null,  // no target_column
  'unsupervised'  // mode parameter
);

// Response shows training_mode
console.log(response.data.training_mode); // "unsupervised"
console.log(response.data.message); // "...UNSUPERVISED RANKING (no target needed)"
```

## Response Structure

### Supervised Mode Response
```json
{
  "status": "success",
  "model_name": "leads-v1",
  "training_mode": "supervised",
  "message": "Trained on 1000 samples with 25 features",
  "metrics": {
    "accuracy": 0.87,
    "roc_auc": 0.91,
    "precision": 0.83,
    "recall": 0.79
  }
}
```

### Unsupervised Mode Response
```json
{
  "status": "success",
  "model_name": "leads-v1",
  "training_mode": "unsupervised",
  "message": "Trained on 1000 samples with 25 features - UNSUPERVISED RANKING (no target needed)",
  "analysis": {
    "training_mode": "unsupervised",
    "message": "Trained in UNSUPERVISED mode: ranks rows by multi-criteria signals (no binary target required)",
    "n_features": 25
  }
}
```

## Scoring Workflow After Training

### Both Modes Use `/score` Endpoint

```bash
# Score with unsupervised model
curl -X POST "http://localhost:8000/score?model_name=leads-v1" \
  -F "file=@new_leads.csv"
```

**Supervised score result:**
```json
{
  "score": 0.87,  // Probability (0-1)
  "profile_score": 87.0
}
```

**Unsupervised score result:**
```json
{
  "score": 0.92,  // Ranking score (0-1)
  "rank_percentile": 92  // Percentile (1-100)
}
```

## Transitioning to Supervised Model

### After collecting outcomes:
1. Upload CSV with both original features + outcome column
2. Switch back to Supervised mode
3. Re-train the model with actual target
4. System now provides class probabilities + confidence

**Timeline:**
- Week 1: Use unsupervised model to rank leads
- Week 2-X: Collect conversion data
- After 50+ outcomes: Re-train supervised model for better calibration

## FAQ

**Q: Can I switch modes on the same model?**
- A: Yes. Unsupervised → Supervised by uploading with target column. Just re-train with `mode=supervised`.

**Q: Does unsupervised mode require minimum rows?**
- A: Yes, still needs 10+ rows and 2+ columns (same validation).

**Q: Why does unsupervised mode show metrics?**
- A: Backend still trains internal classifier for feature extraction. That's implementation detail you don't need for ranking.

**Q: Can I use unsupervised scores for routing?**
- A: Yes! Same `/score` endpoint, same routing ledger for explainability.

**Q: What happens if I upload data with a  target column in unsupervised mode?**
- A: Target column is ignored. System ranks all rows regardless.

## Troubleshooting

### Error: "AMBIGUOUS_TARGET" when mode=unsupervised
- **Cause**: Mode parameter not passed correctly to backend
- **Fix**: Ensure `&mode=unsupervised` in URL or `mode='unsupervised'` in API call

### Model trained but scoring returns empty
- **Cause**: Scored data has different columns than training data
- **Fix**: Ensure scored CSV has same columns as training CSV

### Unsupervised model showing poor ranking
- **Cause**: No strong signals in data (e.g., all constant values)
- **Fix**: Add more feature columns with variation (e.g., company size, revenue, engagement metrics)

## Next Steps

- ✅ Upload dataset without binary target
- ✅ Select unsupervised mode
- ✅ Score leads without pre-existing labels
- ⏳ Week 1: Collect feedback from sales team
- ⏳ Week 2: Re-train in supervised mode with actual outcomes
- ⏳ Week 3+: Use probabilistic ranking with confidence intervals

---

**Need help?** Check the full documentation:
- Implementation guide: [IMPLEMENTATION_CODE_SKELETON.md](./binarycolumn/IMPLEMENTATION_CODE_SKELETON.md)
- Architecture: [ENHANCED_SYSTEM_ARCHITECTURE.md](./binarycolumn/ENHANCED_SYSTEM_ARCHITECTURE.md)
- API reference: [docs/api-contract.md](./docs/api-contract.md)
