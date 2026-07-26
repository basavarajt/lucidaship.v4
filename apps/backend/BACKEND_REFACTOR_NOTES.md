# Backend Refactor Notes

## Purpose

This document summarizes the backend refactor and explains why each change was introduced. The goal of the work was to move the lead scoring system toward a production-ready architecture without rewriting the existing system blindly.

## High-Level Outcome

The backend now has a new versioned `v1` API layer, a structured persistence layer for leads/scores/signals/feedback/models, a business-aware scoring path, a lightweight feedback learning loop, and a rule-based explanation engine. The existing backend entrypoint still works with `uvicorn main:app`.

## Changes Made

### 1. Added a SQLAlchemy-backed data layer

Files:
- `app/db/session.py`
- `app/models/entities.py`
- `app/database.py`
- `requirements.txt`

What changed:
- Added SQLAlchemy engine and session management.
- Added ORM models for:
  - `leads`
  - `scores`
  - `signals`
  - `feedback`
  - `models`
- Kept the existing raw SQL/libSQL path in place.
- Added PostgreSQL-ready support through `DATABASE_URL`.

Why this was done:
- The previous persistence setup was centered around a few raw SQL tables that were tied closely to the older API flow.
- The new feature set needed clearer relationships between leads, scores, feedback, signals, and model configuration.
- SQLAlchemy gives a cleaner and more maintainable path for evolving the schema while still allowing local SQLite fallback and future PostgreSQL deployment.

### 2. Added versioned REST API routes under `/v1`

Files:
- `app/api/v1/routes.py`
- `app/models/schemas.py`
- `main.py`

What changed:
- Added:
  - `POST /v1/score`
  - `POST /v1/explain`
  - `POST /v1/feedback`
  - `POST /v1/dataset/upload`
  - `GET /v1/signals`
- Added Pydantic request/response schemas for these endpoints.
- Registered the new router in `main.py`.

Why this was done:
- The old API shape was functional but not cleanly versioned or grouped around product capabilities.
- A versioned API makes future backend evolution safer.
- Request/response schemas improve validation, readability, and client integration.

### 3. Added business-aware weighting

Files:
- `app/services/business_weights.py`
- `app/core/config.py`
- `.env.example`

What changed:
- Added configurable weighting boosts for:
  - `job_title`
  - `company_size`
  - `recent_activity`
- Added environment/config settings for these weights.
- Added bounds for adaptive weight adjustment.

Why this was done:
- Pure scoring logic can miss business priorities that sales teams care about.
- This layer keeps the existing scoring logic but adds a controlled business bias on top of extracted signals.
- Making weights configurable avoids hardcoding one scoring policy forever.

### 4. Added a new scoring orchestration service

Files:
- `app/services/lead_scoring.py`
- `app/services/cache.py`

What changed:
- Added a service that coordinates:
  - scoring input preparation
  - signal extraction
  - business-aware weighting
  - explanation generation
  - persistence
  - caching
- Added TTL-based in-memory caching for repeated scoring and signal extraction.

Why this was done:
- The older backend had too much scoring behavior concentrated in a large API module.
- Production systems need the core scoring flow to live in services, not directly inside routers.
- Caching reduces repeated work and improves latency for repeated scoring requests.

### 5. Added a rule-based explanation engine

Files:
- `app/services/explanation_engine.py`

What changed:
- Added a service that turns rationale output into structured product-facing explanations like:
  - factor
  - impact
  - direction
  - source column
- Explanations are produced without requiring an LLM.

Why this was done:
- Explanations are a core product feature, not a debug-only detail.
- The system already had useful rationale data from the model path, but it was not exposed as a clean explanation API shape.
- A rule-based approach is faster, deterministic, cheaper, and easier to operate in production.

### 6. Added a feedback learning loop

Files:
- `app/services/feedback_learning.py`
- `app/api/v1/routes.py`

What changed:
- Added feedback persistence through `POST /v1/feedback`.
- Added lightweight adaptive logic that adjusts business-priority weights over time based on conversions.
- Stored the updated adaptive weights in the model config record.

Why this was done:
- The product needed a learning loop without introducing heavy retraining infrastructure.
- This approach gives the system a simple adaptive behavior while staying operationally lightweight.
- It creates a path for later evolution into more advanced learning if needed.

### 7. Updated the ranking engine to support signal reuse

Files:
- `app/services/ranking_engine.py`

What changed:
- Updated the ranking engine so it can reuse precomputed signal matrices when a higher-level service already prepared them.

Why this was done:
- Recomputing signals repeatedly is wasteful.
- This supports the new performance goal of avoiding unnecessary recalculation.
- It helps the scoring service apply business weighting before ranking without forcing duplicate extraction work.

### 8. Added focused tests for new backend behavior

Files:
- `tests/test_business_weights.py`
- `tests/test_explanation_engine.py`

What changed:
- Added tests for business-priority weight boosting.
- Added tests for explanation formatting and positive/negative impact rendering.

Why this was done:
- The new logic introduces product behavior that should be locked down with tests.
- These tests cover the most important new backend features added in this refactor.

## Design Decisions

### Kept the legacy API

Why:
- The request was to improve the system intelligently, not rewrite everything.
- Leaving the older routes in place reduces migration risk while the new `v1` architecture is adopted.

### Used lightweight adaptation instead of heavy ML retraining

Why:
- The requirement explicitly asked for simple adaptive logic.
- Weight adjustment is much easier to operate than a full online training loop.

### Used deterministic explanations

Why:
- The requirement allowed a rule-based explanation engine.
- Deterministic explanations are faster, cheaper, and easier to test.

### Kept SQLite fallback while enabling PostgreSQL-style architecture

Why:
- Local development should remain easy.
- Production architecture still needed a clean relational model and a real database path.

## Configuration Added

New settings added in config and `.env.example`:
- `DATABASE_URL`
- `SCORE_CACHE_TTL_SECONDS`
- `SIGNAL_CACHE_TTL_SECONDS`
- `BUSINESS_WEIGHT_JOB_TITLE`
- `BUSINESS_WEIGHT_COMPANY_SIZE`
- `BUSINESS_WEIGHT_RECENT_ACTIVITY`
- `ADAPTIVE_WEIGHT_MIN`
- `ADAPTIVE_WEIGHT_MAX`

## Important Note

The refactor was implemented additively. That means:
- existing backend startup remains in place
- old routes were not removed
- new production-style modules were introduced alongside the legacy flow

This was intentional to reduce risk and preserve current behavior while improving architecture.

## Follow-Up Recommendation

The next clean-up step should be migrating selected logic from the large legacy `app/api/scoring.py` module into the new service layer so both old and new API paths share more of the same production logic.
