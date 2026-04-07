# Target Discovery Engine — Integration Guide

**TL;DR:** Add 1 layer before your existing pipeline. Everything else stays the same.

---

## 🎯 The Idea

Your current flow:
```
load_leads() → features → training → scoring
```

New flow (zero disruption):
```
detect_target() 
  ├─ Found? → proceed normally
  └─ Not found? → show client options → create synthetic → proceed normally
      ↓
load_leads() → features → training → scoring [UNCHANGED]
```

---

## 🔧 Integration Paths

### Path 1: Use in Jupyter / Colab (Prototyping)

```python
from target_discovery_engine import TargetDiscoveryEngine

# Load CSV
df = pd.read_csv('leads.csv')

# Run discovery
engine = TargetDiscoveryEngine(df)
exists, target_col, reason = engine.detect_real_target()

if not exists:
    # Show options to user
    options = engine.suggest_ranking_options()
    print("Choose an option:")
    for opt in options:
        print(f"  [{opt['option_id']}] {opt['icon']} {opt['label']}")
    
    # User picks (e.g., option 1)
    user_choice = 1
    df_with_target, info = engine.create_synthetic_target(user_choice)
    print(info)
else:
    df_with_target = df
    print(f"Using existing target: {target_col}")

# Now run your existing pipeline
df_clean, roles = load_leads_from_df(df_with_target)  # Modify load_leads to accept df
# ... rest of training
```

---

### Path 2: Use in FastAPI Backend (Production)

**New endpoint:**
```python
@app.post("/api/discover")
async def discover_target(file: UploadFile = File(...)):
    df = pd.read_csv(file.file)
    engine = TargetDiscoveryEngine(df)
    exists, col, _ = engine.detect_real_target()
    
    if exists:
        return {"status": "target_found", "column": col}
    else:
        options = engine.suggest_ranking_options()
        return {"status": "needs_choice", "options": options}

@app.post("/api/train")
async def train_with_choice(file: UploadFile, option_id: int):
    df = pd.read_csv(file.file)
    engine = TargetDiscoveryEngine(df)
    df_with_target, info = engine.create_synthetic_target(option_id)
    
    # Run your EXISTING training pipeline
    df_clean, roles = load_leads(df_with_target)
    # ... everything else unchanged
```

---

### Path 3: Use in Next.js Frontend (Vercel)

```javascript
// /pages/api/discover.js

export default async function handler(req, res) {
  const formData = new FormData();
  formData.append('file', req.files.csv);
  
  // Call your backend discovery endpoint
  const response = await fetch('http://your-api.railway.app/api/discover', {
    method: 'POST',
    body: formData
  });
  
  const { status, options } = await response.json();
  
  if (status === 'needs_choice') {
    // Show options to user
    res.json({ options });
  } else {
    // Target found, proceed to training
    res.json({ ready: true });
  }
}

// User picks option → call /api/train
```

---

## 📝 Modify `load_leads()` to Accept Pre-Processed DataFrame

Currently `load_leads()` reads a CSV. To integrate target discovery, make it accept both:

```python
def load_leads(filepath_or_df):
    """
    Accept both:
    - filepath (string) → read CSV, run discovery
    - dataframe with __target__ → skip discovery, proceed normally
    """
    
    # Check if input is filepath or dataframe
    if isinstance(filepath_or_df, str):
        df = pd.read_csv(filepath_or_df, low_memory=False)
        
        # NEW: Run discovery
        engine = TargetDiscoveryEngine(df)
        exists, col, _ = engine.detect_real_target()
        
        if not exists:
            # In production, this would return options to UI
            # For now, default to composite score
            df, _ = engine.create_synthetic_target(option_id=2)
    else:
        df = filepath_or_df
    
    # EXISTING: Detect roles
    roles = detect_roles(df)
    
    # If no __target__, try to find it
    if '__target__' not in df.columns:
        find_target(df)
    
    # EXISTING: Rest of the function
    # ... drop columns, fill nulls, parse dates, etc.
    
    return df, roles
```

---

## ✅ What Doesn't Change

- ✅ `detect_roles()` — Same
- ✅ Feature engineering — Same
- ✅ Training pipeline — Same
- ✅ Model saving/loading — Same
- ✅ Scoring API — Same

---

## 🚀 Deployment Checklist

- [ ] Copy `target_discovery_engine.py` to your repo
- [ ] Test locally: run the `if __name__ == '__main__'` demo
- [ ] Modify `load_leads()` to use `TargetDiscoveryEngine`
- [ ] Add `/api/discover` endpoint (FastAPI or Flask)
- [ ] Add `/api/train` endpoint with option_id parameter
- [ ] Update frontend to show options before training
- [ ] Deploy to Railway/Vercel

---

## 🐛 Debugging

**Issue:** "No options generated"
→ Check numeric/date columns: `df.select_dtypes(include=['number']).columns`

**Issue:** "Synthetic target always 0 or 1"
→ Check `create_synthetic_target()` logic for your data type

**Issue:** "Pipeline breaks after discovery"
→ Verify `__target__` column exists in `df` before calling `load_leads()`

---

## 📊 Example: Full Training Flow

```python
import pandas as pd
from target_discovery_engine import TargetDiscoveryEngine
from your_backend import load_leads, train_universal_model

# 1. Load CSV
df = pd.read_csv('leads.csv')

# 2. Target discovery
engine = TargetDiscoveryEngine(df)
exists, col, _ = engine.detect_real_target()

if not exists:
    print("Options:")
    options = engine.suggest_ranking_options()
    for opt in options:
        print(f"  [{opt['option_id']}] {opt['label']}")
    
    user_choice = int(input("Pick option: "))
    df, info = engine.create_synthetic_target(user_choice)
    print(f"\n✓ {info['explanation']}")
else:
    print(f"✓ Found target: {col}")

# 3. Run existing pipeline (unchanged)
df_clean, roles = load_leads(df)
X, X_scaled, y, feat_names, scaler = build_feature_matrix(df_clean)

# 4. Train (unchanged)
model = train_universal_model(X, X_scaled, y, feat_names, scaler, roles)

# 5. Score (unchanged)
scores = model['stack'].predict_proba(X)[:, 1]
```

---

## 🎓 Key Principle

**The target discovery is a PRE-PROCESSOR.** It runs before your pipeline touches the data. By the time `load_leads()` is called, `__target__` already exists — the rest of the code has no idea discovery happened.

This is why zero changes are needed to the pipeline. ✨

---

## 📞 Support

- `TargetDiscoveryEngine` class → `/home/claude/target_discovery_engine.py`
- Interactive UI → `/mnt/user-data/outputs/target_discovery_ui.html`
- FastAPI example → `/home/claude/fastapi_integration_guide.py`
- This guide → You're reading it now 📖
