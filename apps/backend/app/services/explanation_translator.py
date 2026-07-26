"""
Feature Name Translator Service
Converts technical ML feature names and SHAP values into salesperson-friendly language.
"""

from typing import Dict, List, Any, Optional
import hashlib
import json
import logging
import re

import httpx

from app.core.config import get_settings


logger = logging.getLogger(__name__)


class ExplanationTranslator:
    """Translates technical feature names to plain English explanations."""
    
    def __init__(self):
        self.settings = get_settings()
        # Feature name patterns and their translations
        self.feature_patterns = {
            # Engagement metrics
            r"engagement.*score": {
                "positive": "Strong recent engagement",
                "negative": "Low engagement history",
                "neutral": "Moderate engagement"
            },
            r"email.*open": {
                "positive": "Actively opens emails",
                "negative": "Rarely opens emails",
                "neutral": "Occasional email opens"
            },
            r"email.*click": {
                "positive": "Clicks through emails frequently",
                "negative": "Doesn't click email links",
                "neutral": "Some email clicks"
            },
            r"reply.*count|replied.*times": {
                "positive": "Replied {value} times recently",
                "negative": "No recent replies",
                "neutral": "Replied {value} times"
            },
            r"last.*interaction|recent.*activity": {
                "positive": "Very recent activity",
                "negative": "Inactive for a while",
                "neutral": "Some recent activity"
            },
            
            # Deal/Pipeline metrics
            r"deal.*age|days.*in.*pipeline": {
                "positive": "Fresh opportunity",
                "negative": "Deal going cold — act fast",
                "neutral": "Standard deal timeline"
            },
            r"deal.*value|deal.*size|revenue": {
                "positive": "High-value opportunity",
                "negative": "Small deal size",
                "neutral": "Mid-size deal"
            },
            r"stage|pipeline.*stage": {
                "positive": "Advanced in sales process",
                "negative": "Early stage",
                "neutral": "Mid-stage opportunity"
            },
            
            # Company/Firmographic
            r"company.*size|employee.*count|headcount": {
                "positive": "Perfect company size",
                "negative": "Outside target size",
                "neutral": "Acceptable company size"
            },
            r"industry|vertical|sector": {
                "positive": "Ideal industry fit",
                "negative": "Industry mismatch",
                "neutral": "Industry fit"
            },
            r"revenue|arr|annual.*revenue": {
                "positive": "Strong revenue profile",
                "negative": "Below revenue threshold",
                "neutral": "Moderate revenue"
            },
            r"location|region|geography|country": {
                "positive": "Target market location",
                "negative": "Outside target region",
                "neutral": "Location fit"
            },
            
            # Behavioral/Intent
            r"website.*visit|page.*view": {
                "positive": "Actively browsing website",
                "negative": "No website visits",
                "neutral": "Visited website"
            },
            r"demo.*request|trial.*signup": {
                "positive": "Requested demo/trial",
                "negative": "No demo interest shown",
                "neutral": "Demo interest"
            },
            r"download|content.*download": {
                "positive": "Downloaded resources",
                "negative": "No content downloads",
                "neutral": "Some downloads"
            },
            r"meeting.*scheduled|calendar.*invite": {
                "positive": "Meeting scheduled",
                "negative": "Declined meetings",
                "neutral": "Meeting proposed"
            },
            
            # Contact Quality
            r"title|job.*title|role": {
                "positive": "Decision-maker role",
                "negative": "Not a decision-maker",
                "neutral": "Relevant role"
            },
            r"seniority|level": {
                "positive": "Senior-level contact",
                "negative": "Junior contact",
                "neutral": "Mid-level contact"
            },
            r"budget|authority": {
                "positive": "Has budget authority",
                "negative": "No budget authority",
                "neutral": "Some budget influence"
            },
            
            # Previous relationship
            r"past.*customer|previous.*purchase|churned": {
                "positive": "Former customer — win-back opportunity",
                "negative": "Previously churned",
                "neutral": "Past customer"
            },
            r"referral|referred.*by": {
                "positive": "Came from referral",
                "negative": "Cold outreach",
                "neutral": "Referral connection"
            },
            
            # Timing/Urgency
            r"contract.*expir|renewal.*date": {
                "positive": "Contract expiring soon",
                "negative": "Just renewed elsewhere",
                "neutral": "Contract timing"
            },
            r"intent.*signal|buying.*signal": {
                "positive": "Strong buying signals",
                "negative": "No buying signals",
                "neutral": "Some interest signals"
            },
            
            # Generic fallbacks
            r"score$": {
                "positive": "High score",
                "negative": "Low score",
                "neutral": "Score factor"
            },
            r"count$": {
                "positive": "High activity count",
                "negative": "Low activity count",
                "neutral": "Activity count"
            }
        }
    
    def translate_feature(self, feature_name: str, contribution: float, value: Any = None) -> str:
        """Translate a single feature to plain English."""
        feature_lower = feature_name.lower()
        
        # Determine sentiment
        if contribution > 0.05:
            sentiment = "positive"
        elif contribution < -0.05:
            sentiment = "negative"
        else:
            sentiment = "neutral"
        
        # Match against patterns
        for pattern, translations in self.feature_patterns.items():
            if re.search(pattern, feature_lower):
                translation = translations.get(sentiment, translations.get("neutral"))
                
                # Template substitution if value provided
                if value is not None and "{value}" in translation:
                    translation = translation.replace("{value}", str(value))
                
                return translation
        
        # Fallback: prettify the feature name
        return self._prettify_feature_name(feature_name, sentiment)
    
    def _prettify_feature_name(self, feature_name: str, sentiment: str) -> str:
        """Convert snake_case or camelCase to readable text."""
        cleaned = re.sub(r'^(is_|has_|num_|count_|total_)', '', feature_name)
        cleaned = re.sub(r'(_score|_count|_rate)$', '', cleaned)
        
        words = re.split(r'[_\s]+', cleaned)
        readable = ' '.join(word.capitalize() for word in words)
        
        if sentiment == "positive":
            return f"Good {readable}"
        elif sentiment == "negative":
            return f"Low {readable}"
        else:
            return readable
    
    def translate_rationale(
        self,
        top_positive: List[Dict[str, Any]],
        top_negative: List[Dict[str, Any]],
        max_items: int = 3
    ) -> Dict[str, Any]:
        """Translate SHAP rationale into plain English."""
        positive_drivers = []
        negative_drivers = []
        
        # Translate positive drivers
        for item in top_positive[:max_items]:
            label = item.get('label', '')
            contribution = item.get('contribution', 0)
            value = item.get('value')
            
            translated = self.translate_feature(label, contribution, value)
            positive_drivers.append({
                "text": translated,
                "original": label,
                "contribution": contribution,
                "sentiment": "positive"
            })
        
        # Translate negative drivers
        for item in top_negative[:max_items]:
            label = item.get('label', '')
            contribution = item.get('contribution', 0)
            value = item.get('value')
            
            translated = self.translate_feature(label, contribution, value)
            negative_drivers.append({
                "text": translated,
                "original": label,
                "contribution": contribution,
                "sentiment": "negative"
            })
        
        # Generate summary sentence
        summary = self._generate_summary(positive_drivers, negative_drivers)
        
        return {
            "positive_drivers": positive_drivers,
            "negative_drivers": negative_drivers,
            "summary": summary,
            "all_drivers": positive_drivers + negative_drivers
        }
    
    def _generate_summary(self, positive: List[Dict], negative: List[Dict]) -> str:
        """Generate a conversational summary sentence."""
        if not positive and not negative:
            return "Score based on overall profile"
        
        if positive and not negative:
            driver_text = ", ".join([d["text"] for d in positive[:2]])
            return f"Strong candidate because of {driver_text}"
        
        if negative and not positive:
            driver_text = ", ".join([d["text"] for d in negative[:2]])
            return f"Lower score due to {driver_text}"
        
        pos_text = positive[0]["text"] if positive else ""
        neg_text = negative[0]["text"] if negative else ""
        
        return f"Strong on {pos_text}, but {neg_text}"
    
    def recommend_action(self, score: float, drivers: List[Dict[str, Any]]) -> str:
        """Recommend best action based on score and drivers."""
        driver_texts = " ".join([d.get("text", "").lower() for d in drivers])
        
        # High urgency signals
        if any(keyword in driver_texts for keyword in ["going cold", "act fast", "expiring", "scheduled"]):
            return "call"
        
        # High score logic
        if score >= 80:
            if any(keyword in driver_texts for keyword in ["engagement", "replied", "active", "demo"]):
                return "call"
            return "email"
        
        # Medium score
        if score >= 55:
            return "email"
        
        # Low score
        return "nurture"
    
    def get_action_priority(self, score: float) -> str:
        """Map score to action priority."""
        if score >= 80:
            return "high"
        elif score >= 55:
            return "medium"
        else:
            return "low"
    
    def enrich_scoring_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Enrich a scoring result with sales-friendly fields."""
        score = result.get("score", 0)
        rationale = result.get("rationale", {})
        
        top_positive = rationale.get("top_positive", [])
        top_negative = rationale.get("top_negative", [])
        
        # Translate rationale
        translated = self.translate_rationale(top_positive, top_negative)
        
        # Get recommendations
        action = self.recommend_action(score, translated["all_drivers"])
        priority = self.get_action_priority(score)
        
        # Determine score band
        if score >= 80:
            band = "hot"
            band_label = "Hot Lead"
        elif score >= 55:
            band = "warm"
            band_label = "Warm Lead"
        else:
            band = "cold"
            band_label = "Cold Lead"
        
        # Add enriched fields - SHOW PERCENTAGE
        result["display_score"] = round(score, 1)
        result["score_percentage"] = f"{round(score)}%"
        result["action_priority"] = priority
        result["recommended_action"] = action
        result["score_band"] = band
        result["score_band_label"] = band_label
        result["plain_english"] = translated
        result["llm_explanation"] = self.generate_rank_explanation(result, translated)
        result["explanation_label"] = "Phi-3 Mini Intelligence"
        result["explanation_source"] = result.get("llm_explanation_source", "template_fallback")
        result["rationale_summary"] = result["llm_explanation"]
        result["plain_english"]["summary"] = result["llm_explanation"]
        
        return result

    def generate_rank_explanation(self, result: Dict[str, Any], translated: Dict[str, Any]) -> str:
        """Generate a human-sounding explanation for why this row ranked where it did."""
        context = self._build_llm_context(result, translated)
        llm_explanation = None
        if result.get("llm_explanation_source") != "template_fallback":
            llm_explanation = self._generate_with_llm(context)
        if llm_explanation:
            result["llm_explanation_source"] = "phi3_mini"
            return llm_explanation

        result["llm_explanation_source"] = "template_fallback"
        return self._generate_human_fallback(context)

    def _build_llm_context(self, result: Dict[str, Any], translated: Dict[str, Any]) -> Dict[str, Any]:
        positive = [item["text"] for item in translated.get("positive_drivers", [])[:3]]
        negative = [item["text"] for item in translated.get("negative_drivers", [])[:3]]
        routing = result.get("routing") or {}
        matched_segment = routing.get("matched_segment") or {}
        rank_movement = result.get("rank_movement") or {}
        data = result.get("data") or {}

        return {
            "score": round(float(result.get("score", 0.0)), 2),
            "score_band": result.get("score_band"),
            "top_positive": positive,
            "top_negative": negative,
            "top_drivers": result.get("top_drivers", [])[:3],
            "row_snapshot": self._row_snapshot(data),
            "route_type": routing.get("route_type", "base"),
            "used_model": routing.get("used_model"),
            "route_reason": routing.get("reason"),
            "matched_segment": matched_segment,
            "rank_movement": rank_movement,
        }

    def _generate_with_llm(self, context: Dict[str, Any]) -> Optional[str]:
        if not self.settings.LLM_EXPLANATIONS_ENABLED:
            return None
        if self.settings.LLM_EXPLANATION_PROVIDER.lower() != "ollama":
            return None
        endpoint = (self.settings.LLM_EXPLANATION_ENDPOINT or "").strip()
        if not endpoint:
            return None

        prompt = self._build_llm_prompt(context)
        try:
            with httpx.Client(timeout=self.settings.LLM_EXPLANATION_TIMEOUT_SECONDS) as client:
                response = client.post(
                    endpoint,
                    json={
                        "model": self.settings.LLM_EXPLANATION_MODEL,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.85,
                            "num_predict": 90,
                        },
                    },
                )
                response.raise_for_status()
                payload = response.json()
        except Exception as exc:
            logger.debug("LLM explanation fallback triggered: %s", exc)
            return None

        text = str(payload.get("response", "")).strip()
        return self._clean_llm_output(text)

    def _build_llm_prompt(self, context: Dict[str, Any]) -> str:
        return (
            "You are writing one concise, natural explanation for why a lead ranked where it did.\n"
            "Write exactly 1-2 sentences in plain business English.\n"
            "Be specific, human, and non-repetitive.\n"
            "Mention what pushed the lead up or down.\n"
            "Do not mention SHAP, features, AI, or the model.\n"
            "Do not use bullet points.\n"
            f"Context: {json.dumps(context, default=str)}"
        )

    def _clean_llm_output(self, text: str) -> Optional[str]:
        if not text:
            return None
        cleaned = " ".join(text.replace("\n", " ").split())
        cleaned = cleaned.strip(" -")
        if len(cleaned) < 20:
            return None
        return cleaned[:400]

    def _generate_human_fallback(self, context: Dict[str, Any]) -> str:
        fingerprint = hashlib.md5(json.dumps(context, sort_keys=True, default=str).encode("utf-8")).hexdigest()
        variant = int(fingerprint[:2], 16) % 4
        score = float(context.get("score", 0.0))
        positives = context.get("top_positive", [])
        negatives = context.get("top_negative", [])
        route_type = context.get("route_type", "base")
        matched_segment = context.get("matched_segment", {})

        positive_text = self._join_fragments(positives[:2])
        negative_text = self._join_fragments(negatives[:2])
        route_text = self._route_text(route_type, matched_segment)

        if score >= 80:
            openings = [
                "This lead ranked near the top because",
                "This record scored higher than most because",
                "It rose into a strong position because",
                "This profile climbed the ranking because",
            ]
        elif score >= 55:
            openings = [
                "This lead landed in the middle of the ranking because",
                "It stayed competitive, but not elite, because",
                "This record shows mixed strength because",
                "It ranked in the workable range because",
            ]
        else:
            openings = [
                "This lead ranked lower because",
                "It fell toward the bottom because",
                "This record lost momentum in the ranking because",
                "It scored behind stronger leads because",
            ]

        opening = openings[variant]

        if positives and negatives:
            sentence = f"{opening} {positive_text}, but {negative_text.lower()}."
        elif positives:
            sentence = f"{opening} {positive_text}."
        elif negatives:
            sentence = f"{opening} {negative_text.lower()}."
        else:
            sentence = f"{opening} the profile shows only limited standout signals."

        if route_text:
            closers = [
                f"{route_text} shaped the final position.",
                f"{route_text} influenced the final ranking.",
                f"{route_text} helped determine where it landed.",
                f"{route_text} was part of the final decision.",
            ]
            sentence = f"{sentence} {closers[(variant + 1) % len(closers)]}"

        return sentence

    def _join_fragments(self, items: List[str]) -> str:
        cleaned = [item.strip() for item in items if item and item.strip()]
        if not cleaned:
            return ""
        if len(cleaned) == 1:
            return cleaned[0]
        return f"{cleaned[0]} and {cleaned[1]}"

    def _route_text(self, route_type: str, matched_segment: Dict[str, Any]) -> str:
        if route_type != "segment":
            return ""
        dimension = matched_segment.get("dimension")
        value = matched_segment.get("value")
        if dimension and value is not None:
            return f"The segment-specific path for {dimension}={value}"
        return "The segment-specific scoring path"

    def _row_snapshot(self, data: Dict[str, Any]) -> Dict[str, Any]:
        snapshot = {}
        ignored_tokens = ("id", "uuid", "created", "updated")
        for key, value in data.items():
            key_text = str(key).lower()
            if any(token in key_text for token in ignored_tokens):
                continue
            if value is None or value == "":
                continue
            snapshot[str(key)] = value
            if len(snapshot) >= 6:
                break
        return snapshot


# Singleton instance
_translator = ExplanationTranslator()


def translate_scoring_results(results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Translate a batch of scoring results."""
    llm_enabled = _translator.settings.LLM_EXPLANATIONS_ENABLED
    max_rows = _translator.settings.LLM_EXPLANATION_MAX_ROWS
    translated = []
    for index, result in enumerate(results):
        # Skip LLM entirely when disabled OR beyond max rows
        if not llm_enabled or index >= max_rows:
            result["llm_explanation_source"] = "template_fallback"
        translated.append(_translator.enrich_scoring_result(result))
    return translated


def get_translator() -> ExplanationTranslator:
    """Get the singleton translator instance."""
    return _translator
