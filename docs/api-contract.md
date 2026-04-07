# API Contract

Base URL: `http://localhost:8000`

## Public
- `GET /health`

## Auth
- `GET /auth/me`

## Scoring
- `POST /train`
  - multipart: `file` or `files`
  - query: `model_name`, optional `target_column`
  - returns: model analysis, target diagnostics, feature blueprint, metrics
- `POST /score`
  - multipart: `file` or `files`
  - query: `model_name`
  - returns: ranked results, rationale, score-time routing metadata, and optional rank movement against previous model version
- `POST /score-csv`
  - legacy alias of `/score`
- `POST /analyze`
  - multipart: `file`
- `POST /feedback`
  - multipart: `file`
  - query: `model_name`, optional `outcome_column`, optional `auto_retrain`, optional `feedback_weight`
  - returns: matched feedback metrics, retraining recommendation, auto-retrain policy result, and optional triggered retrain result
- `POST /retrain`
  - multipart: `file`
  - query: `model_name`
- `POST /retrain-from-feedback`
  - query: `model_name`, optional `feedback_weight`
  - returns: new model metrics trained from persisted `feedback_events`
- `POST /retrain-segment-feedback`
  - query: `model_name`, `segment_dimension`, `segment_value`, optional `feedback_weight`
  - returns: a new segment-specialized model version trained from feedback rows in that cohort

## Models
- `GET /models`
- `GET /models/{model_name}`
- `DELETE /models/{model_name}`

## Versioned ranking behavior
- Every training run now saves a versioned artifact path plus updates the latest model alias.
- If a model has at least two training runs, scoring compares the current output against the previous saved model version on the same uploaded rows.
- Each scored row may include `rank_movement` with `status`, `rank_delta`, `previous_rank`, and `score_delta`.

## Feedback loop behavior
- Every scored lead snapshot now stores a deterministic `lead_signature` so later outcome files can be matched back to prior predictions.
- Feedback ingestion computes post-score accuracy, precision, recall, and optional ROC AUC against actual outcomes.
- Matched outcome records are persisted as `feedback_events` for auditability and future retraining workflows.
- Feedback-aware retraining can now build a new model version directly from accumulated `feedback_events`, with configurable weighting of real-world outcomes.
- `GET /models` and `GET /models/{model_name}` now include feedback readiness and recent feedback timeline data to support retrain decisions.
- Feedback ingestion can now optionally auto-trigger retraining when policy thresholds are met for feedback volume and post-score performance drift.
- Model metadata endpoints now also expose `segment_hotspots`, which identify low-cardinality cohorts whose actual outcomes are drifting materially from predicted scores.
- Segment hotspots can now be turned into dedicated retrained model variants through `POST /retrain-segment-feedback`.
- During scoring, Lucida can now route matching rows through segment-specialized models and report that routing decision in each scored result.
- Routing metadata now includes a deterministic policy name, route reason, and candidate arbitration details when multiple specialized models could match.

## Response shape
All API routes return:
```json
{
  "success": true,
  "data": {},
  "error": null
}
```
or
```json
{
  "success": false,
  "data": null,
  "error": { "code": "...", "message": "..." }
}
```
