# Target Discovery System — Quick Start

**Status:** ✅ Ready to integrate into your codebase

---

## 📦 What You Got

### 1. **Target Discovery Engine** (`target_discovery_engine.py`)
- `TargetDiscoveryEngine` class — detects real targets OR generates options
- `load_leads_with_discovery()` — wrapper for your existing pipeline
- Full working demo (run it: `python target_discovery_engine.py`)

### 2. **Interactive Frontend** (`target_discovery_ui.html`)
- Client uploads CSV
- Sees ranking options if no target found
- Picks one → proceeds to training
- Works standalone or with your backend

### 3. **Backend Integration Guide** (`fastapi_integration_guide.py`)
- `/api/discovery/detect` — check if target exists
- `/api/discovery/create-target` — create synthetic target
- `/api/train` — full pipeline with discovery
- Copy-paste ready for FastAPI/Flask

### 4. **Code Examples** (`CODE_EXAMPLES.py`)
- Jupyter/Colab pattern
- FastAPI endpoints
- Updated `load_leads()` function
- React/Next.js frontend component
- Retrain pattern
- Error handling patterns

### 5. **Documentation**
- `TARGET_DISCOVERY_INTEGRATION.md` — how to integrate
- `ARCHITECTURE.txt` — visual flow
- This file — quick reference

---

## 🚀 Quick Start (5 minutes)

### Step 1: Test the Demo
```bash
cd /home/claude
python target_discovery_engine.py
```
✅ You'll see a sample CSV and how it creates targets

### Step 2: Copy to Your Project
```bash
cp /home/claude/target_discovery_engine.py /your/project/
```

### Step 3: Update Your `load_leads()`
See `CODE_EXAMPLES.py` for the exact pattern.

### Step 4: Test Locally
```python
from target_discovery_engine import TargetDiscoveryEngine

df = pd.read_csv('your_leads.csv')
engine = TargetDiscoveryEngine(df)
exists, col, _ = engine.detect_real_target()

if not exists:
    options = engine.suggest_ranking_options()
    # Show to user
    df, info = engine.create_synthetic_target(option_id=1)
```

---

## 🎯 The Core Promise

**Before (your current setup):**
```
❌ Client uploads CSV without a target
❌ Model fails — can't find label column
❌ You manually ask: "Which column is the outcome?"
❌ They get frustrated
```

**After (with target discovery):**
```
✅ Client uploads CSV
✅ System auto-detects target OR shows 3-5 options
✅ Client clicks one option
✅ Model trains automatically
✅ Zero manual configuration
```

---

## 🔄 Integration Paths

### Path A: Local Development (Jupyter/Colab)
```python
from target_discovery_engine import TargetDiscoveryEngine

df = pd.read_csv('leads.csv')
engine = TargetDiscoveryEngine(df)

# Run discovery
exists, col, _ = engine.detect_real_target()

if not exists:
    options = engine.suggest_ranking_options()
    # Show options to user somehow
    df, info = engine.create_synthetic_target(user_choice)

# Your existing pipeline
df_clean, roles = load_leads(df)
# ... rest unchanged
```
**Time: 10 minutes**

### Path B: FastAPI Backend
```python
@app.post("/api/discover")
async def discover(file: UploadFile):
    df = pd.read_csv(...)
    engine = TargetDiscoveryEngine(df)
    exists, col, _ = engine.detect_real_target()
    
    if exists:
        return {"status": "target_found"}
    else:
        options = engine.suggest_ranking_options()
        return {"status": "needs_choice", "options": options}

@app.post("/api/train")
async def train(file: UploadFile, option_id: int):
    df = pd.read_csv(...)
    engine = TargetDiscoveryEngine(df)
    df, info = engine.create_synthetic_target(option_id)
    
    # Your existing training code
    # ... unchanged
```
**Time: 30 minutes**

### Path C: Full Stack (React Frontend + FastAPI + Vercel)
1. Deploy `target_discovery_ui.html` to Vercel
2. Add backend endpoints (Path B)
3. Wire React component to backend
**Time: 1-2 hours**

---

## ✅ What Doesn't Change

Your existing code stays **exactly the same**:
- ✅ `detect_roles()`
- ✅ `build_engagement_score()`
- ✅ `build_velocity_score()`
- ✅ `encode_categoricals()`
- ✅ `embed_text_columns()`
- ✅ Model training
- ✅ Scoring API

The target discovery is a **pure pre-processor** that runs before everything else.

---

## 🎓 How It Works (Under the Hood)

### If target exists:
```
CSV has a column named "Status" with 2 values ("Won", "Lost")
    ↓
detect_real_target() recognizes it
    ↓
Return that column, proceed normally
```

### If target doesn't exist:
```
CSV has no obvious target column
    ↓
suggest_ranking_options() analyzes:
  - Numeric columns? → "Rank by high [column]"
  - Date columns? → "Rank by recency"
  - Categorical? → "Rank by segment"
    ↓
Show options to client
    ↓
Client picks: "Rank by deal_value"
    ↓
create_synthetic_target():
  - Top 50% of deal_value → __target__ = 1
  - Bottom 50% of deal_value → __target__ = 0
    ↓
DataFrame ready for pipeline
```

---

## 📊 Example: How Options Are Generated

Given this CSV:
```
name,emails_sent,calls_made,deal_value,industry,created_at,status
Alice,15,5,50000,SaaS,2024-01-15,open
Bob,3,1,5000,Retail,2024-02-01,open
...
```

System suggests:
```
[1] 📈 High emails_sent
    → Rank leads by emails_sent — higher is ranked first

[2] 📈 High calls_made
    → Rank leads by calls_made — higher is ranked first

[3] 📈 High deal_value
    → Rank by highest deal values — best revenue leads

[4] ⚡ Composite Score
    → Mix of all numeric signals — balanced ranking

[5] ⏱️ Recent Activity
    → Rank by most recently active leads
```

Client picks #3 → System ranks by deal_value, creates target.

---

## 🐛 Debugging

### "Options list is empty"
→ Your CSV might only have text columns
→ Add at least one numeric column

### "Target distribution is 100/0"
→ All leads are ranked the same
→ Check the ranking column has variety
→ Example: `df['deal_value'].describe()`

### "Pipeline breaks after discovery"
→ Verify `__target__` column exists: `assert '__target__' in df.columns`
→ Check value counts: `df['__target__'].value_counts()`

### "Integration tests fail"
→ Ensure you're passing the df WITH `__target__` to `load_leads()`
→ See CODE_EXAMPLES.py for exact usage

---

## 📈 Metrics to Track

Once you integrate:
- **Time to value:** Reduce from "manual config" to "< 1 minute"
- **Customer onboarding:** Track how many pick an option vs. abandon
- **Model quality:** ROC-AUC on synthetic vs. real targets
- **Retrain frequency:** Monthly? Weekly? As outcomes come in

---

## 🎁 Bonus: Retraining

When customers send you outcomes (won/lost), retrain their model:

```python
def retrain_customer_model(customer_id, new_outcomes_csv):
    # Load existing training data
    existing = pd.read_csv(f'models/{customer_id}/training.csv')
    
    # Append new outcomes
    new = pd.read_csv(new_outcomes_csv)
    combined = pd.concat([existing, new])
    
    # Re-run full pipeline (discovery handles schema changes)
    engine = TargetDiscoveryEngine(combined)
    combined, _ = engine.create_synthetic_target(option_id)
    
    # Retrain
    model = train_universal_model(combined, ...)
    
    # Save
    joblib.dump(model, f'models/{customer_id}/model_v2.pkl')
```

---

## 📞 Files You Got

| File | Purpose |
|------|---------|
| `target_discovery_engine.py` | Core class — copy to your project |
| `target_discovery_ui.html` | Interactive frontend for clients |
| `fastapi_integration_guide.py` | Backend endpoint examples |
| `CODE_EXAMPLES.py` | Copy-paste patterns for all use cases |
| `TARGET_DISCOVERY_INTEGRATION.md` | Integration guide (read this) |
| `ARCHITECTURE.txt` | Visual flow diagram |
| This file | Quick reference |

All in: `/home/claude/` and `/mnt/user-data/outputs/`

---

## 🚀 Next Steps

### This Week
- [ ] Copy `target_discovery_engine.py` to your repo
- [ ] Run the demo locally
- [ ] Update your `load_leads()` function

### Next Week
- [ ] Add `/api/discover` endpoint to FastAPI
- [ ] Test with 3 real CSVs from customers
- [ ] Wire frontend to backend

### Month 1
- [ ] Deploy to production
- [ ] Onboard first customer
- [ ] Collect feedback on options

### Month 2
- [ ] Retrain model with first outcomes
- [ ] Refine option generation based on customer data
- [ ] Add analytics

---

## 💡 Key Insight

This system **removes the single biggest friction point** in lead scoring:

**Before:** "What column should we predict?"
**After:** Client picks from 3-5 smart options. Done.

It's not just a technical layer — it's a **product feature** that makes your offering accessible to non-technical users.

---

**You're ready. Start with the demo, then integrate. Questions? Check CODE_EXAMPLES.py.**

✨ Good luck! 🚀
