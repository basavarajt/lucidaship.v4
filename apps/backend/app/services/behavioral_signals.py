"""
Behavioral Intelligence Layer — sales-psychology signal extraction.

Rule-based (no training required), auto-detects relevant columns by keyword
pattern, and produces a 0-100 score per behavioral dimension plus a composite
"relationship_strength" score. Mirrors the EngagementScorer pattern in
adaptive_scorer.py so it composes cleanly with the rest of the scoring pipeline.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
import logging
import numpy as np
import pandas as pd
import httpx
import json

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Column-name keyword patterns per behavioral dimension.
INTENT_PATTERNS = ["pricing", "demo", "quote", "trial", "download",
                    "technical", "spec", "roi"]
AUTHORITY_PATTERNS = ["title", "role", "seniority", "department"]
TRUST_PATTERNS = ["meeting", "stakeholders", "attendees", "repeat", "duration"]
URGENCY_PATTERNS = ["timeline", "budget", "quarter", "deadline", "implementation"]
FRICTION_PATTERNS = ["missed", "reschedule", "no_show", "bounced", "unsubscribed", "ghost"]

AUTHORITY_TITLE_WEIGHTS = {
    "ceo": 1.0, "founder": 1.0, "owner": 1.0, "c-level": 1.0, "chief": 1.0,
    "vp": 0.85, "vice president": 0.85, "head of": 0.8,
    "director": 0.7, "manager": 0.5, "lead": 0.4,
    "coordinator": 0.2,
}

@dataclass
class BehavioralSignalResult:
    intent_score: Optional[float] = None
    authority_score: Optional[float] = None
    trust_score: Optional[float] = None
    urgency_score: Optional[float] = None
    momentum_score: Optional[float] = None
    friction_score: Optional[float] = None
    relationship_strength: Optional[float] = None
    detected_columns: Dict[str, str] = field(default_factory=dict)
    top_signals: List[str] = field(default_factory=list)
    note_tags: List[str] = field(default_factory=list)
    has_behavioral_data: bool = False


class BehavioralSignalExtractor:
    """Derives sales-psychology signals from arbitrary CRM columns."""

    def __init__(self):
        self.settings = get_settings()
        self.detected_columns: Dict[str, List[str]] = {
            "intent": [],
            "authority": [],
            "trust": [],
            "urgency": [],
            "friction": [],
            "activity_timestamps": [],
            "notes": []
        }
        
        self.composite_weights = {
            "intent_score": self.settings.BEHAVIORAL_WEIGHT_INTENT,
            "authority_score": self.settings.BEHAVIORAL_WEIGHT_AUTHORITY,
            "trust_score": self.settings.BEHAVIORAL_WEIGHT_TRUST,
            "urgency_score": self.settings.BEHAVIORAL_WEIGHT_URGENCY,
            "momentum_score": self.settings.BEHAVIORAL_WEIGHT_MOMENTUM,
            "friction_score": self.settings.BEHAVIORAL_WEIGHT_FRICTION,
        }

    def _normalize_column_name(self, col: str) -> str:
        return col.lower().replace('_', ' ').replace('-', ' ')

    def detect_columns(self, df: pd.DataFrame) -> Dict[str, List[str]]:
        self.detected_columns = {k: [] for k in self.detected_columns.keys()}
        
        for col in df.columns:
            col_normalized = self._normalize_column_name(col)
            
            # Detect intent
            if any(p in col_normalized for p in INTENT_PATTERNS):
                self.detected_columns["intent"].append(col)
            
            # Detect authority
            elif any(p in col_normalized for p in AUTHORITY_PATTERNS):
                if pd.api.types.is_string_dtype(df[col]):
                    self.detected_columns["authority"].append(col)
                    
            # Detect trust
            elif any(p in col_normalized for p in TRUST_PATTERNS):
                self.detected_columns["trust"].append(col)
                
            # Detect urgency
            elif any(p in col_normalized for p in URGENCY_PATTERNS):
                self.detected_columns["urgency"].append(col)
                
            # Detect friction
            elif any(p in col_normalized for p in FRICTION_PATTERNS):
                self.detected_columns["friction"].append(col)
            
            # Detect timestamps (for momentum)
            if 'date' in col_normalized or 'time' in col_normalized or 'updated' in col_normalized or 'created' in col_normalized:
                if pd.api.types.is_datetime64_any_dtype(df[col]) or (pd.api.types.is_string_dtype(df[col]) and df[col].astype(str).str.contains(r'\d{4}-\d{2}-\d{2}').any()):
                    self.detected_columns["activity_timestamps"].append(col)
                    
            # Detect notes (for NLP)
            if 'note' in col_normalized or 'description' in col_normalized or 'comment' in col_normalized:
                if pd.api.types.is_string_dtype(df[col]):
                    sample = df[col].dropna().astype(str)
                    if not sample.empty and sample.str.len().mean() > 20:
                        self.detected_columns["notes"].append(col)
                        
        return self.detected_columns

    def _parse_numeric(self, val: Any) -> float:
        if pd.isna(val):
            return 0.0
        if isinstance(val, bool):
            return 1.0 if val else 0.0
        try:
            return float(val)
        except (ValueError, TypeError):
            pass
        if isinstance(val, str):
            val_lower = val.lower().strip()
            if val_lower in ('yes', 'true', 'y', '1', 'checked'):
                return 1.0
            if val_lower in ('no', 'false', 'n', '0', 'unchecked'):
                return 0.0
        return 0.0

    def _score_intent(self, row: pd.Series) -> Optional[float]:
        cols = self.detected_columns.get("intent", [])
        if not cols:
            return None
        score = sum(self._parse_numeric(row.get(c)) for c in cols)
        return min(100.0, score * 20.0)

    def _score_authority(self, row: pd.Series) -> Optional[float]:
        cols = self.detected_columns.get("authority", [])
        if not cols:
            return None
        
        best_score = 0.0
        for col in cols:
            val = str(row.get(col, '')).lower()
            if pd.isna(val) or val == 'nan':
                continue
            for title, weight in AUTHORITY_TITLE_WEIGHTS.items():
                if title in val:
                    best_score = max(best_score, weight * 100.0)
        
        return best_score

    def _score_trust(self, row: pd.Series) -> Optional[float]:
        cols = self.detected_columns.get("trust", [])
        if not cols:
            return None
        score = sum(self._parse_numeric(row.get(c)) for c in cols)
        return min(100.0, score * 25.0)

    def _score_urgency(self, row: pd.Series, nlp_tags: List[str]) -> Optional[float]:
        cols = self.detected_columns.get("urgency", [])
        score = 0.0
        has_data = False
        
        if cols:
            has_data = True
            score += sum(self._parse_numeric(row.get(c)) for c in cols) * 20.0
            
        urgency_tags = {'budget_approved': 30, 'timeline_this_quarter': 30, 'competitor_mentioned': 20, 'champion_identified': 20}
        for tag in nlp_tags:
            if tag in urgency_tags:
                has_data = True
                score += urgency_tags[tag]
                
        if not has_data:
            return None
        return min(100.0, score)

    def _score_friction(self, row: pd.Series, nlp_tags: List[str]) -> Optional[float]:
        cols = self.detected_columns.get("friction", [])
        score = 0.0
        has_data = False
        
        if cols:
            has_data = True
            for col in cols:
                column_name = self._normalize_column_name(col)
                # Losing contact is materially more predictive of friction than a
                # routine reschedule, so retain that distinction in the score.
                multiplier = 75.0 if any(term in column_name for term in ("unsubscribed", "bounced", "ghost")) else 25.0
                score += self._parse_numeric(row.get(col)) * multiplier
            
        friction_tags = {'needs_legal_review': 20, 'ghosting_risk': 40, 'price_objection': 30}
        for tag in nlp_tags:
            if tag in friction_tags:
                has_data = True
                score += friction_tags[tag]
                
        if not has_data:
            return None
        return min(100.0, score)

    def _score_momentum(self, row: pd.Series, df_context: Optional[pd.DataFrame]) -> Optional[float]:
        cols = self.detected_columns.get("activity_timestamps", [])
        if not cols:
            return None
            
        timestamps = []
        for c in cols:
            val = row.get(c)
            if not pd.isna(val):
                try:
                    ts = pd.to_datetime(val)
                    timestamps.append(ts)
                except:
                    pass
                    
        if not timestamps:
            return None
            
        timestamps.sort(reverse=True)
        most_recent = timestamps[0]
        
        try:
            today = pd.Timestamp.today()
            if most_recent.tzinfo is not None:
                today = today.tz_localize(most_recent.tzinfo)
            days_ago = (today - most_recent).days
            recency_score = max(0.0, 100.0 - (days_ago * (100.0/90.0)))
            
            if len(timestamps) > 1:
                return min(100.0, recency_score * 1.2)
            return recency_score
        except:
            return None

    def _extract_nlp_tags(self, row: pd.Series) -> List[str]:
        if not self.settings.BEHAVIORAL_SIGNALS_ENABLED or not self.settings.BEHAVIORAL_NOTES_NLP_ENABLED:
            return []
            
        cols = self.detected_columns.get("notes", [])
        if not cols:
            return []
            
        note_texts = []
        for c in cols:
            val = row.get(c)
            if not pd.isna(val) and isinstance(val, str) and len(val.strip()) > 5:
                note_texts.append(val.strip())
                
        if not note_texts:
            return []
            
        combined_notes = " ".join(note_texts)[:1000]
        
        endpoint = (self.settings.LLM_EXPLANATION_ENDPOINT or "").strip()
        if not endpoint:
            return []
            
        prompt = (
            "Extract up to 3 short tags from this sales note that indicate buyer psychology. "
            "Choose only from: budget_approved, competitor_mentioned, needs_legal_review, "
            "timeline_this_quarter, ghosting_risk, champion_identified, price_objection. "
            "Return a JSON array of matching tags only, no explanation.\\n"
            f'Note: "{combined_notes}"'
        )
        
        try:
            with httpx.Client(timeout=5) as client:
                response = client.post(
                    endpoint,
                    json={
                        "model": self.settings.LLM_EXPLANATION_MODEL,
                        "prompt": prompt,
                        "stream": False,
                        "format": "json"
                    }
                )
                response.raise_for_status()
                payload = response.json()
                text = str(payload.get("response", "")).strip()
                tags = json.loads(text)
                if isinstance(tags, list):
                    return [t for t in tags if isinstance(t, str)]
        except Exception as e:
            logger.debug(f"NLP tag extraction failed: {e}")
            
        return []

    def score_lead(self, row: pd.Series, df_context: Optional[pd.DataFrame] = None) -> BehavioralSignalResult:
        if not any(self.detected_columns.values()):
            return BehavioralSignalResult()

        nlp_tags = self._extract_nlp_tags(row)

        intent = self._score_intent(row)
        authority = self._score_authority(row)
        trust = self._score_trust(row)
        urgency = self._score_urgency(row, nlp_tags)
        friction = self._score_friction(row, nlp_tags)
        momentum = self._score_momentum(row, df_context)

        scores = {
            "intent_score": intent,
            "authority_score": authority,
            "trust_score": trust,
            "urgency_score": urgency,
            "momentum_score": momentum,
            "friction_score": friction
        }
        
        base_score = 0.0
        has_data = False
        
        for name, score in scores.items():
            if score is not None:
                has_data = True
                w = self.composite_weights.get(name, 0.0)
                if w > 0:
                    base_score += score * w
                elif w < 0:
                    base_score -= score * abs(w)
                    
        relationship_strength = None
        if has_data:
            pos_weights = sum(w for n, w in self.composite_weights.items() if w > 0 and scores.get(n) is not None)
            neg_weights = sum(abs(w) for n, w in self.composite_weights.items() if w < 0 and scores.get(n) is not None)
            
            max_p = 100.0 * pos_weights
            min_p = -100.0 * neg_weights
            
            if max_p > min_p:
                normalized = ((base_score - min_p) / (max_p - min_p)) * 100.0
            else:
                normalized = 50.0
                
            relationship_strength = max(0.0, min(100.0, normalized))

        top_signals = []
        if intent and intent >= 50: top_signals.append("High Intent")
        if authority and authority >= 70: top_signals.append("Decision Maker")
        if urgency and urgency >= 50: top_signals.append("High Urgency")
        if momentum and momentum >= 70: top_signals.append("Strong Momentum")
        if friction and friction >= 50: top_signals.append("High Friction")

        return BehavioralSignalResult(
            intent_score=intent,
            authority_score=authority,
            trust_score=trust,
            urgency_score=urgency,
            momentum_score=momentum,
            friction_score=friction,
            relationship_strength=relationship_strength,
            detected_columns={k: v[0] for k, v in self.detected_columns.items() if v},
            top_signals=top_signals,
            note_tags=nlp_tags,
            has_behavioral_data=has_data
        )

    def score_dataframe(self, df: pd.DataFrame) -> List[BehavioralSignalResult]:
        self.detect_columns(df)
        return [self.score_lead(row, df) for _, row in df.iterrows()]

    def analyze(self, df: pd.DataFrame) -> Dict:
        detected = self.detect_columns(df)
        flat_detected = {k: v[0] if v else None for k, v in detected.items()}
        found = [k for k, v in flat_detected.items() if v is not None]
        
        return {
            "detected_columns": flat_detected,
            "signals_found": found,
            "signals_missing": [k for k, v in flat_detected.items() if v is None],
            "coverage": (len(found) / len(flat_detected) * 100) if flat_detected else 0.0
        }
