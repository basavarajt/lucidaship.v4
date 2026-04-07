"""
COPY-PASTE CODE EXAMPLES
========================

Use these exact patterns in your codebase.
"""

# ============================================================================
# EXAMPLE 1: LOCAL TRAINING (Jupyter / Colab)
# ============================================================================

import pandas as pd
from target_discovery_engine import TargetDiscoveryEngine

# Load CSV
df = pd.read_csv('your_leads.csv')

# DISCOVERY STEP (NEW)
engine = TargetDiscoveryEngine(df)
exists, target_col, reason = engine.detect_real_target()

print(reason)

if not exists:
    # Show options
    options = engine.suggest_ranking_options()
    print("\nAvailable ranking options:\n")
    for opt in options:
        print(f"  [{opt['option_id']}] {opt['icon']} {opt['label']}")
        print(f"        → {opt['description']}\n")
    
    # User picks one
    choice = int(input("Enter option number: "))
    df, info = engine.create_synthetic_target(choice)
    print(f"\n✓ {info['explanation']}")
else:
    print(f"\n✓ Using existing target: {target_col}")

# YOUR EXISTING PIPELINE (unchanged)
# df_clean, roles = load_leads(df)
# ... feature engineering ...
# ... training ...


# ============================================================================
# EXAMPLE 2: FASTAPI BACKEND (Two-step flow)
# ============================================================================

from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
from target_discovery_engine import TargetDiscoveryEngine
import pandas as pd
import tempfile
import os
import io

app = FastAPI()

# Step 1: Client uploads CSV → get options (or proceed if target exists)
@app.post("/api/discover")
async def discover(file: UploadFile = File(...)):
    """
    Client uploads CSV.
    Backend returns either:
    - "target_found" → proceed to training
    - "needs_choice" → show options to client
    """

    # Validate file was provided
    if not file:
        return JSONResponse(
            {"error": "No file provided", "details": "Please upload a CSV file"},
            status_code=400
        )

    content = await file.read()
    if not content:
        return JSONResponse(
            {"error": "Empty file", "details": "CSV file is empty"},
            status_code=400
        )
    
    try:
        df = pd.read_csv(io.BytesIO(content))
    except pd.errors.ParserError as e:
        return JSONResponse(
            {"error": "CSV parsing failed", "details": str(e)},
            status_code=400
        )
    except Exception as e:
        return JSONResponse(
            {"error": "Invalid CSV file", "details": f"{type(e).__name__}: {str(e)}"},
            status_code=400
        )
    
    # Validate CSV is not empty
    if df.empty or len(df) == 0:
        return JSONResponse(
            {"error": "CSV is empty", "details": "No data rows found in CSV"},
            status_code=400
        )

    # Validate CSV has minimum structure
    if len(df.columns) < 2:
        return JSONResponse(
            {"error": "Insufficient columns", "details": "CSV must have at least 2 columns"},
            status_code=400
        )
    
    try:
        engine = TargetDiscoveryEngine(df)
        exists, col, reason = engine.detect_real_target()

        if exists:
            return JSONResponse({
                "status": "target_found",
                "target": col,
                "message": "Ready to train!",
                "reason": reason
            })
        else:
            options = engine.suggest_ranking_options()
            if not options:
                return JSONResponse(
                    {"error": "Could not analyze CSV structure", "details": "No suitable ranking options found"},
                    status_code=400
                )

            return JSONResponse({
                "status": "needs_choice",
                "row_count": len(df),
                "column_count": len(df.columns),
                "options": [
                    {
                        "option_id": opt['option_id'],
                        "label": opt['label'],
                        "description": opt['description'],
                        "icon": opt['icon']
                    }
                    for opt in options
                ]
            })
    except Exception as e:
        return JSONResponse(
            {"error": "Analysis failed", "details": str(e)},
            status_code=500
        )


# Step 2: Client picks option → proceed with training
@app.post("/api/train")
async def train(file: UploadFile = File(...), option_id: int = None):
    """
    Client uploads CSV + picks option_id.
    Backend creates target, trains model, returns model_id.
    """

    # Validate option_id is provided and valid
    if option_id is None:
        return JSONResponse(
            {"error": "option_id is required", "details": "Please select a ranking option"},
            status_code=400
        )
    
    if not isinstance(option_id, int) or option_id < 1:
        return JSONResponse(
            {"error": "Invalid option_id", "details": "option_id must be a positive integer"},
            status_code=400
        )

    # Validate file was provided
    if not file:
        return JSONResponse(
            {"error": "No file provided", "details": "Please upload a CSV file"},
            status_code=400
        )

    content = await file.read()
    if not content:
        return JSONResponse(
            {"error": "Empty file", "details": "CSV file is empty"},
            status_code=400
        )
    
    try:
        df = pd.read_csv(io.BytesIO(content))
    except pd.errors.ParserError as e:
        return JSONResponse(
            {"error": "CSV parsing failed", "details": str(e)},
            status_code=400
        )
    except Exception as e:
        return JSONResponse(
            {"error": "Invalid CSV file", "details": f"{type(e).__name__}: {str(e)}"},
            status_code=400
        )

    # Validate CSV is not empty
    if df.empty or len(df) == 0:
        return JSONResponse(
            {"error": "CSV is empty", "details": "No data rows found in CSV"},
            status_code=400
        )

    # Create target
    engine = TargetDiscoveryEngine(df)
    try:
        df, info = engine.create_synthetic_target(option_id)
        if '__target__' not in df.columns:
            raise ValueError("Failed to create target column")
    except ValueError as e:
        return JSONResponse(
            {"error": "Target creation failed", "details": str(e)},
            status_code=400
        )
    except Exception as e:
        return JSONResponse(
            {"error": "Unexpected error during target creation", "details": str(e)},
            status_code=500
        )

    # YOUR EXISTING TRAINING CODE HERE
    # df_clean, roles = load_leads(df)
    # X, X_scaled, y, feat_names, scaler = build_feature_matrix(df_clean)
    # model = train_models(X, X_scaled, y, feat_names, scaler)
    # model_id = save_model(model)

    return JSONResponse({
        "status": "trained",
        "model_id": "m_abc123",  # Your model ID
        "conversion_rate": float(df['__target__'].mean() * 100),
        "rows": len(df),
        "message": f"✓ {info}"
    })


# ============================================================================
# EXAMPLE 3: MODIFY YOUR load_leads() TO USE TARGET DISCOVERY
# ============================================================================

def load_leads(filepath_or_df, auto_create_target=True, option_id=None):
    """
    UPDATED load_leads to integrate target discovery.
    
    Usage:
    - load_leads('file.csv')                    # Auto-discover target
    - load_leads('file.csv', option_id=1)       # Use synthetic target
    - load_leads(df_with_target)                # Pass DataFrame
    """
    
    # Handle input type
    if isinstance(filepath_or_df, str):
        df = pd.read_csv(filepath_or_df, low_memory=False)
        
        # NEW: Run target discovery
        if auto_create_target:
            engine = TargetDiscoveryEngine(df)
            exists, col, _ = engine.detect_real_target()
            
            if not exists:
                if option_id is None:
                    # Production: would show UI options
                    # For now, default to composite
                    option_id = 2  # Composite score
                
                df, _ = engine.create_synthetic_target(option_id)
    else:
        df = filepath_or_df.copy()
    
    print(f"Loaded: {df.shape[0]} rows × {df.shape[1]} cols")
    
    # Ensure __target__ exists
    if '__target__' not in df.columns:
        raise ValueError("No target column found. Use target discovery first.")
    
    # EXISTING CODE (unchanged)
    roles = detect_roles(df)
    
    # Drop identity / all-unique columns
    drop_cols = roles['identity'] + [
        c for c in df.columns
        if df[c].nunique() == df.shape[0]
    ]
    df.drop(columns=[c for c in drop_cols if c in df.columns],
            inplace=True, errors='ignore')
    
    # Universal null handling
    for col in df.select_dtypes(include='number').columns:
        df[col].fillna(df[col].median(), inplace=True)
    for col in df.select_dtypes(include='object').columns:
        df[col].fillna('Unknown', inplace=True)
    
    # Parse date columns
    for col in roles['velocity']:
        if col in df.columns:
            try:
                df[col] = pd.to_datetime(df[col], errors='coerce')
            except:
                pass
    
    df.drop_duplicates(inplace=True)
    print(f"Clean shape: {df.shape}")
    print(f"Target distribution: {dict(df['__target__'].value_counts())}")
    
    return df, roles


# USAGE:
# Option 1: Auto-discover from CSV
# df, roles = load_leads('leads.csv')

# Option 2: Auto-discover with user choice
# df, roles = load_leads('leads.csv', option_id=1)

# Option 3: Pass DataFrame with __target__ already created
# df_with_target, _ = engine.create_synthetic_target(1)
# df, roles = load_leads(df_with_target)


# ============================================================================
# EXAMPLE 4: FRONTEND (React / Next.js)
# ============================================================================

"""
import React, { useState } from 'react'

export default function TargetDiscovery() {
  const [phase, setPhase] = useState('upload')  // upload, options, training
  const [csvFile, setCsvFile] = useState(null)
  const [options, setOptions] = useState([])
  const [selectedOption, setSelectedOption] = useState(null)

  async function handleUpload(file) {
    setPhase('discovering')
    
    const formData = new FormData()
    formData.append('file', file)
    
    const res = await fetch('/api/discover', {
      method: 'POST',
      body: formData
    })
    
    const data = await res.json()
    
    if (data.status === 'target_found') {
      // Proceed to training
      setPhase('training')
    } else if (data.status === 'needs_choice') {
      // Show options
      setOptions(data.options)
      setPhase('options')
    }
  }

  async function handleChoice(optionId) {
    setSelectedOption(optionId)
    setPhase('training')
    
    // Send to backend
    const formData = new FormData()
    formData.append('file', csvFile)
    formData.append('option_id', optionId)
    
    const res = await fetch('/api/train', {
      method: 'POST',
      body: formData
    })
    
    const { model_id, conversion_rate } = await res.json()
    
    // Show success
    setPhase('success')
  }

  return (
    <div>
      {phase === 'upload' && (
        <div>
          <h1>Upload Your Leads</h1>
          <input 
            type="file"
            accept=".csv"
            onChange={(e) => {
              setCsvFile(e.target.files[0])
              handleUpload(e.target.files[0])
            }}
          />
        </div>
      )}

      {phase === 'options' && (
        <div>
          <h1>How should we rank your leads?</h1>
          <div className="options-grid">
            {options.map(opt => (
              <div
                key={opt.option_id}
                className="option-card"
                onClick={() => handleChoice(opt.option_id)}
              >
                <div style={{ fontSize: '32px' }}>{opt.icon}</div>
                <h2>{opt.label}</h2>
                <p>{opt.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {phase === 'training' && <p>Training your model...</p>}
      
      {phase === 'success' && (
        <div>
          <h1>✓ Model Ready!</h1>
          <p>Your leads are now ranked and ready to score.</p>
        </div>
      )}
    </div>
  )
}
"""


# ============================================================================
# EXAMPLE 5: RETRAIN WITH NEW OUTCOMES
# ============================================================================

def retrain_with_new_data(model_id, new_csv_path, option_id=None):
    """
    Periodically retrain as new outcomes arrive.
    
    Example: Every week, append new "won/lost" labels to your training data.
    """
    
    # Load existing training data
    existing_df = pd.read_csv(f'models/{model_id}/training_data.csv')
    
    # Load new outcomes
    new_df = pd.read_csv(new_csv_path)
    
    # Combine
    combined = pd.concat([existing_df, new_df], ignore_index=True)
    
    # Re-run discovery (in case schema changed)
    engine = TargetDiscoveryEngine(combined)
    exists, col, _ = engine.detect_real_target()
    
    if not exists and option_id:
        combined, _ = engine.create_synthetic_target(option_id)
    
    # Re-run full training
    df_clean, roles = load_leads(combined)
    X, X_scaled, y, feat_names, scaler = build_feature_matrix(df_clean)
    
    # Retrain
    model = train_universal_model(X, X_scaled, y, feat_names, scaler, roles)
    
    # Save new version
    import joblib
    joblib.dump(model, f'models/{model_id}/model_v2.pkl')
    
    print(f"✓ Retrained on {len(combined)} leads")
    print(f"  Conversion rate: {df_clean['__target__'].mean()*100:.1f}%")


# ============================================================================
# EXAMPLE 6: HANDLING EDGE CASES
# ============================================================================

def safe_discovery(df, fallback_option=2):
    """
    Safe wrapper that never fails.
    """
    
    try:
        engine = TargetDiscoveryEngine(df)
        exists, col, _ = engine.detect_real_target()
        
        if exists:
            return df, 'existing'
        
        # Try to generate options
        options = engine.suggest_ranking_options()
        
        if not options:
            # Fallback: composite score
            df, _ = engine.create_synthetic_target(fallback_option)
            return df, 'fallback'
        
        # Use first option
        df, _ = engine.create_synthetic_target(options[0]['option_id'])
        return df, 'auto'
    
    except Exception as e:
        print(f"⚠️ Discovery failed: {e}")
        # Last resort: random split
        df['__target__'] = (pd.Series(range(len(df))).mod(2) == 0).astype(int)
        return df, 'random_fallback'


# Usage:
# df, source = safe_discovery(df)
# print(f"Target created using: {source}")
