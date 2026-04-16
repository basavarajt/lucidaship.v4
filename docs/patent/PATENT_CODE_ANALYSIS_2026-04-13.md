# Lucida Patentability Analysis (Code-Grounded)

Date: 2026-04-13
Scope: Compare prior claim baseline in `docs/patent/lucida-routing-arbitration-invention-claims.pdf` to implemented backend behavior and identify filing-ready claim families.
Disclaimer: Product drafting support only, not legal advice.

## 1) Baseline vs Current Reality

Baseline document (PDF) focus:
- Adaptive routing between base and segment models
- Deterministic arbitration score
- Routing explanation ledger
- Feedback-driven retrain loop

Current code adds material implementation depth in three areas that are claim-worthy and were underrepresented in the PDF:
- Relationship-aware dataset merge planning with join-shape safety controls
- Upload-time numeric quantization with distortion thresholds and execution-mode fallback
- Version-aware rank movement comparison against prior model artifacts

## 2) Implemented Mechanisms with Evidence

### A. Segment Routing + Deterministic Arbitration (Strong, filing-ready)
Evidence:
- `apps/backend/app/api/scoring.py` `_get_segment_models_for_base`
- `apps/backend/app/api/scoring.py` `_route_priority`
- `apps/backend/app/api/scoring.py` `_route_and_score_rows`

Implemented details:
- Segment models are linked to a base model through metadata keys including `base_model_name`, `segment_dimension`, and `segment_value`.
- Matching segment candidates are ranked by a deterministic weighted formula:
  - feedback_rows * 1.0
  - roc_auc * 100
  - accuracy * 10
- Scoring output contains a routing ledger with policy id, reason, selected model, matched segment, and candidate details.

Patentability rationale:
- More specific than generic ensemble selection because it ties deterministic row routing, transparent arbitration output, and feedback-derived specialized variants.

### B. Feedback Loop with Row-Signature Matching (Strong, filing-ready)
Evidence:
- `apps/backend/app/api/scoring.py` `_row_signature`
- `apps/backend/app/api/scoring.py` `ingest_feedback`
- `apps/backend/app/api/scoring.py` `_execute_feedback_retrain`
- `apps/backend/app/api/scoring.py` `_execute_segment_feedback_retrain`

Implemented details:
- Scored rows are persisted with deterministic signatures.
- Uploaded outcome rows are normalized and re-signed for deterministic matching.
- Policy-driven auto-retrain trigger (`feedback_guardrail_v1`) uses matched volume and post-score metrics.
- Segment retraining creates model variants named from base model + segment key/value.

Patentability rationale:
- Concrete closed-loop operational architecture with explicit matching and policy thresholds, not just "retrain model".

### C. Relationship-Aware Merge Governance (Strong-medium, filing-ready)
Evidence:
- `apps/backend/app/services/dataset_relationships.py` `score_column_pair`
- `apps/backend/app/services/dataset_relationships.py` `analyze_dataset_pair`
- `apps/backend/app/services/dataset_relationships.py` `analyze_dataset_collection`
- `apps/backend/app/api/scoring.py` `merge_plan` and `_resolve_combined_dataset`

Implemented details:
- Candidate join keys scored by combined features: name similarity, normalized name similarity, overlap, normalized overlap, statistical similarity, and coverage.
- Confidence and coverage thresholds gate merge recommendations.
- Join cardinality classification includes one-to-one, one-to-many, many-to-one, many-to-many.
- Pipeline is conservative by design and explicitly rejects unsafe merge conditions.

Patentability rationale:
- Stronger than generic ETL merge because this is a policy-driven merge governance layer coupled to ML training/scoring safety.

### D. Guardrailed Upload Quantization (Strong-medium, filing-ready)
Evidence:
- `apps/backend/app/services/upload_quantization.py` `ingest_uploaded_dataset`
- `apps/backend/app/services/upload_quantization.py` `_compress_numeric_block`
- `apps/backend/app/api/scoring.py` `_validate_and_ingest_files` and `_compression_summary`

Implemented details:
- Protects identifier-like, datetime-like, binary, target, and non-numeric columns from quantization.
- Quantizes eligible numeric block with random sign/permutation transform and 8-bit quantization.
- Computes distortion metrics (`mse`, `inner_product_error`) and estimated memory savings.
- Chooses execution mode based on policy: full bypass, shadow mode, or compressed execution.

Patentability rationale:
- Specific guarded compression workflow with explicit quality gates and fallback behavior, tied to scoring reliability.

### E. Version-Aware Rank Movement Telemetry (Medium, dependent claims)
Evidence:
- `apps/backend/app/api/scoring.py` `_compare_against_previous_version`
- `apps/backend/app/services/model_storage.py` versioned artifact save/load (`model__timestamp.joblib`)

Implemented details:
- Re-scores current batch with previous artifact version.
- Emits per-row rank deltas and score deltas aligned by deterministic row signature.

Patentability rationale:
- Useful as dependent claim set and governance feature; likely less central than routing/feedback/merge/quantization sets.

## 3) What Is Less Patentable (or Better as Support)

- Generic supervised model training and retraining endpoints (`/train`, `/retrain`) without the routing/governance specifics.
- Generic multi-tenant storage and model CRUD.
- UI text/wording around explanations, by itself.

## 4) Recommended Filing Packages

Package 1 (primary):
- Routing arbitration + explanation ledger + feedback signature matching + segment retrain lifecycle.

Package 2 (parallel/continuation):
- Relationship-aware merge governance with confidence scoring and join-shape safety constraints.

Package 3 (parallel/continuation):
- Guardrailed upload quantization with protected-column policy and distortion-gated execution mode switching.

Package 4 (dependent enhancement):
- Version-aware rank movement telemetry.

## 5) Delta Against Prior PDF

Compared to `docs/patent/lucida-routing-arbitration-invention-claims.pdf`, the most important newly emphasized claimable deltas are:
- Merge governance as a distinct technical mechanism.
- Quantization guardrails and policy-based execution mode selection.
- Explicit version-to-version rank movement telemetry.

The prior PDF remains directionally correct for routing/arbitration, but it under-specifies these newly implemented mechanisms.

## 6) Suggested Next Attorney Packet

Provide counsel with:
- Updated claims doc: `docs/patent/lucida-routing-arbitration-invention-claims.html`
- This analysis memo: `docs/patent/PATENT_CODE_ANALYSIS_2026-04-13.md`
- Code excerpts from listed evidence sections.
- One architecture figure showing:
  - upload -> quantization guardrails -> merge governance -> model route arbitration -> score ledger -> feedback matching -> segment retrain.
