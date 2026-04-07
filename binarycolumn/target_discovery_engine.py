"""
TARGET DISCOVERY ENGINE
======================
Slides in BEFORE load_leads(). 
If no real binary target exists, gives client options to rank by.
Creates synthetic binary target automatically.
Rest of pipeline runs unchanged.
"""

import pandas as pd
import numpy as np
from typing import Tuple, Dict, List, Optional


class TargetDiscoveryEngine:
    """
    Flow:
    1. detect_real_target() → checks if binary target already exists
    2. If YES: return it, proceed normally
    3. If NO: suggest_ranking_options() → shows client 3-5 options
    4. Client picks one → create_synthetic_target() 
    5. DataFrame now has __target__ → ready for load_leads()
    """
    
    def __init__(self, df: pd.DataFrame, roles: Dict = None):
        self.df = df.copy()
        self.roles = roles or {}
        self.original_columns = list(df.columns)
    
    # ============================================================================
    # STEP 1: Does a real binary target already exist?
    # ============================================================================
    
    def detect_real_target(self) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Returns (exists: bool, target_col: str or None, reason: str)

        Real target = column that:
        - Is already named like 'target', 'won', 'converted', 'status', etc
        - Has exactly 2 unique values
        - Those values look like outcomes (e.g. 'Won'/'Lost', 'Yes'/'No', 1/0)
        """

        target_keywords = [
            'converted', 'won', 'closed', 'outcome', 'result',
            'deal_won', 'is_converted', 'status', 'purchased',
            'target', 'label', 'class'
        ]

        candidates = []

        for col in self.df.columns:
            # Skip columns with >50% null values (unreliable targets)
            null_ratio = self.df[col].isna().sum() / len(self.df)
            if null_ratio > 0.5:
                continue

            col_lower = col.lower().replace(' ', '_').replace('-', '_')

            # Check if name matches keywords
            score = sum(1 for kw in target_keywords if kw in col_lower)
            if score == 0:
                continue

            # Check cardinality
            unique_count = self.df[col].nunique()
            if unique_count != 2:
                continue

            # Check if values look like outcomes
            unique_vals = set(self.df[col].dropna().astype(str).str.lower().unique())

            outcome_patterns = {
                'won_lost': ['won', 'lost'],
                'yes_no': ['yes', 'no'],
                'true_false': ['true', 'false'],
                'converted_not': ['converted', 'not converted'],
                'binary': ['0', '1'],
                'positive_negative': ['positive', 'negative'],
                'success_failure': ['success', 'failure'],
            }

            matches_pattern = any(
                all(v in unique_vals for v in pattern)
                for pattern in outcome_patterns.values()
            )

            if matches_pattern:
                candidates.append((score, col))

        if candidates:
            candidates.sort(reverse=True)
            best_col = candidates[0][1]
            return (
                True,
                best_col,
                f"Found existing binary target: '{best_col}'"
            )

        return (False, None, "No binary target detected — show ranking options")
    
    # ============================================================================
    # STEP 2: What are the ranking options we can offer?
    # ============================================================================
    
    def suggest_ranking_options(self) -> List[Dict]:
        """
        Analyze the dataset and suggest 3-5 ranking metrics the client can choose.
        Returns list of { 'option_id', 'label', 'description', 'column_name', 'type' }
        """

        options = []
        option_counter = 1

        # --- NUMERIC COLUMNS: Rank by value ---
        numeric_cols = self.df.select_dtypes(include=['number']).columns.tolist()

        # Filter: exclude binary/low-cardinality + columns with no variation
        numeric_cols = [
            c for c in numeric_cols
            if self.df[c].nunique() > 2 and not self.df[c].isna().all()
        ]

        # Rank by highest average, revenue, price, count, etc.
        for col in numeric_cols[:3]:  # Top 3 numeric columns
            col_lower = col.lower()
            
            # Skip if column is empty after filtering
            col_data = self.df[col].dropna()
            if len(col_data) == 0:
                continue

            # Infer what this column represents
            if any(w in col_lower for w in ['price', 'cost', 'revenue', 'value', 'amount']):
                desc = f"Rank leads by {col} — higher values = better"
                label = f"High {col}"
            elif any(w in col_lower for w in ['count', 'num', 'quantity', 'score', 'rating']):
                desc = f"Rank leads by {col} — more activity = better"
                label = f"Active {col}"
            else:
                desc = f"Rank leads by {col} — higher is ranked first"
                label = f"High {col}"

            # Validate that column has actual variation (not all same value)
            if self.df[col].nunique() >= 2 and col_data.std() > 0:
                options.append({
                    'option_id': option_counter,
                    'label': label,
                    'description': desc,
                    'column_name': col,
                    'type': 'numeric_high',
                    'icon': '📈'
                })
                option_counter += 1

        # --- CATEGORICAL COLUMNS: Rank by frequency or custom grouping ---
        cat_cols = self.df.select_dtypes(include=['object']).columns.tolist()
        # Filter: exclude empty columns and those with too many categories
        cat_cols = [
            c for c in cat_cols 
            if 2 <= self.df[c].nunique() <= 20 and not self.df[c].isna().all()
        ]

        for col in cat_cols[:2]:  # Top 2 categorical columns
            col_lower = col.lower()
            
            # Skip if all values are null after filtering
            col_data = self.df[col].dropna()
            if len(col_data) == 0:
                continue

            # Check if this looks like a "quality" or "status" field
            if any(w in col_lower for w in ['tier', 'segment', 'type', 'category', 'source', 'industry']):
                desc = f"Rank by {col} — prioritize specific segments"
                label = f"Segment by {col}"

                options.append({
                    'option_id': option_counter,
                    'label': label,
                    'description': desc,
                    'column_name': col,
                    'type': 'categorical_segment',
                    'icon': '🏷️'
                })
                option_counter += 1

        # --- SPECIAL: Composite Score (if multiple numeric cols) ---
        if len(numeric_cols) >= 2:
            options.append({
                'option_id': option_counter,
                'label': 'Composite Score',
                'description': 'Rank by a weighted mix of all numeric signals',
                'column_name': None,  # Special case
                'type': 'composite',
                'icon': '⚡'
            })
            option_counter += 1

        # --- SPECIAL: Recency (if date columns exist) ---
        date_cols = self.df.select_dtypes(include=['datetime64']).columns.tolist()
        if date_cols:
            options.append({
                'option_id': option_counter,
                'label': 'Recent Activity',
                'description': 'Rank by most recently active leads',
                'column_name': date_cols[0],
                'type': 'recency',
                'icon': '⏱️'
            })
            option_counter += 1

        return options if options else self._default_options()
    
    def _default_options(self) -> List[Dict]:
        """Fallback if no clear patterns found."""
        return [
            {
                'option_id': 1,
                'label': 'Engagement Count',
                'description': 'Rank by most active leads',
                'column_name': None,
                'type': 'engagement_sum',
                'icon': '📊'
            },
            {
                'option_id': 2,
                'label': 'Profile Quality',
                'description': 'Rank by completeness & richness',
                'column_name': None,
                'type': 'profile_completeness',
                'icon': '⭐'
            },
            {
                'option_id': 3,
                'label': 'Random Split',
                'description': 'Simple 50/50 top vs bottom (for testing)',
                'column_name': None,
                'type': 'random_split',
                'icon': '🎲'
            }
        ]
    
    # ============================================================================
    # STEP 3: Client picks an option → Create synthetic binary target
    # ============================================================================
    
    def create_synthetic_target(
        self,
        option_id: int,
        ranking_column: Optional[str] = None
    ) -> Tuple[pd.DataFrame, str]:
        """
        Client has chosen option_id → create __target__ column.

        Top 50% get __target__ = 1 (high potential)
        Bottom 50% get __target__ = 0 (lower priority)

        Returns: (modified_df, explanation_string)
        """

        df = self.df.copy()
        explanation = ""

        # Numeric: rank by value
        if ranking_column and ranking_column in df.columns:
            if pd.api.types.is_numeric_dtype(df[ranking_column]):
                # Validate column has variation and is not all nulls
                col_data = df[ranking_column].dropna()
                if len(col_data) == 0 or col_data.nunique() < 2:
                    print(f"⚠️ Warning: {ranking_column} has no variation or all nulls, using default split")
                    df['__target__'] = (df.index < len(df) // 2).astype(int)
                    explanation = "Target created: no numeric variation found, using row order"
                elif col_data.std() == 0:
                    print(f"⚠️ Warning: {ranking_column} has no standard deviation, using default split")
                    df['__target__'] = (df.index < len(df) // 2).astype(int)
                    explanation = "Target created: all values are the same, using row order"
                else:
                    # Top 50% by this column
                    median = df[ranking_column].median()
                    if pd.isna(median):
                        print(f"⚠️ Warning: {ranking_column} median is null, using default split")
                        df['__target__'] = (df.index < len(df) // 2).astype(int)
                        explanation = "Target created: median is null, using row order"
                    else:
                        df['__target__'] = (df[ranking_column] >= median).astype(int)
                        explanation = (
                            f"Target created: leads with {ranking_column} >= {median:.2f} "
                            f"are ranked HIGH (50%)"
                        )

            elif pd.api.types.is_object_dtype(df[ranking_column]):
                # Categorical: mark specific values as 1
                col_data = df[ranking_column].dropna()
                unique_count = len(col_data.unique())
                
                if len(col_data) == 0 or unique_count < 2:
                    print(f"⚠️ Warning: {ranking_column} is empty or has no categorical variation, using default split")
                    df['__target__'] = (df.index < len(df) // 2).astype(int)
                    explanation = "Target created: no categorical variation found, using row order"
                else:
                    top_values = df[ranking_column].value_counts().head(
                        max(1, unique_count // 2)
                    ).index.tolist()
                    df['__target__'] = df[ranking_column].isin(top_values).astype(int)
                    explanation = (
                        f"Target created: leads with {ranking_column} in "
                        f"{top_values[:3]}{'...' if len(top_values) > 3 else ''} are ranked HIGH"
                    )

        # Composite score: weighted sum of numeric columns
        elif option_id == 2 or "composite" in str(option_id).lower():
            numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
            if numeric_cols:
                from sklearn.preprocessing import MinMaxScaler
                scaler = MinMaxScaler()
                scaled = scaler.fit_transform(df[numeric_cols])
                composite = scaled.mean(axis=1)
                median = np.median(composite)
                df['__target__'] = (composite >= median).astype(int)
                explanation = (
                    f"Target created: composite score from {len(numeric_cols)} "
                    f"numeric columns. Top 50% = HIGH"
                )
            else:
                raise ValueError("No numeric columns found for composite scoring")

        # Recency: most recent = 1
        elif "recency" in str(option_id).lower() or option_id == 4:
            date_cols = df.select_dtypes(include=['datetime64']).columns.tolist()
            if date_cols:
                latest_date = df[date_cols[0]].max()
                cutoff = latest_date - pd.Timedelta(days=90)  # Last 90 days
                df['__target__'] = (df[date_cols[0]] >= cutoff).astype(int)
                explanation = (
                    f"Target created: leads active in last 90 days = HIGH. "
                    f"(cutoff: {cutoff.date()})"
                )
            else:
                raise ValueError("No date columns found for recency scoring")

        # Default: random 50/50 split
        else:
            split_idx = len(df) // 2
            sorted_df = df.sample(frac=1, random_state=42).reset_index(drop=True)
            sorted_df['__target__'] = 0
            sorted_df.loc[:split_idx, '__target__'] = 1
            df = sorted_df
            explanation = "Target created: random 50/50 split for testing"

        # Ensure __target__ exists
        if '__target__' not in df.columns:
            df['__target__'] = 0
            explanation = "⚠️ Could not create target — defaulting to 0"

        print(f"\n✅ {explanation}")
        print(f"   Conversion rate: {df['__target__'].mean()*100:.1f}%")
        print(f"   Class distribution: {dict(df['__target__'].value_counts())}")

        return df, explanation
    
    # ============================================================================
    # MAIN FLOW: Run the full discovery + creation
    # ============================================================================
    
    def run_discovery(
        self,
        user_choice: Optional[int] = None
    ) -> Tuple[pd.DataFrame, Dict]:
        """
        Full flow:
        1. Check for existing binary target
        2. If found → return df with that target
        3. If not → suggest options, wait for user_choice
        4. If user_choice provided → create synthetic target
        5. Return df with __target__ ready for load_leads()
        """
        
        exists, col, reason = self.detect_real_target()
        
        print(f"\n{'='*70}")
        print("TARGET DISCOVERY")
        print(f"{'='*70}")
        print(reason)
        
        if exists:
            print(f"\n✅ Using existing target: '{col}'")
            print(f"   Distribution: {dict(self.df[col].value_counts())}")
            return self.df, {'source': 'existing', 'column': col}
        
        # No existing target — show options
        print(f"\n❌ No binary target found. Showing ranking options...\n")
        
        options = self.suggest_ranking_options()
        
        print(f"CLIENT CHOICES:\n")
        for opt in options:
            print(f"  [{opt['option_id']}] {opt['icon']} {opt['label']}")
            print(f"      → {opt['description']}\n")
        
        # If no choice provided, return options for UI to display
        if user_choice is None:
            return None, {
                'source': 'needs_choice',
                'options': options
            }
        
        # User chose an option → create synthetic target
        chosen = next((o for o in options if o['option_id'] == user_choice), None)
        
        if not chosen:
            print(f"⚠️ Invalid choice {user_choice}")
            return None, {'source': 'error', 'error': 'invalid_choice'}
        
        print(f"\n✅ User selected: {chosen['label']}")
        
        df_with_target, explanation = self.create_synthetic_target(
            user_choice,
            ranking_column=chosen['column_name']
        )
        
        return df_with_target, {
            'source': 'synthetic',
            'option_id': user_choice,
            'explanation': explanation
        }


# ============================================================================
# INTEGRATION WRAPPER: One function to replace the manual CSV load
# ============================================================================

def load_leads_with_discovery(
    filepath: str,
    roles: Dict = None,
    user_choice: Optional[int] = None
) -> Tuple[Optional[pd.DataFrame], Optional[Dict], Optional[Dict]]:
    """
    NEW: Drop-in replacement for simple load.

    Flow:
    1. Read CSV
    2. detect_roles() (EXISTING)
    3. Run target discovery
    4. If needs choice → return options to UI
    5. If choice provided → create target + proceed
    6. Return df ready for existing pipeline

    Returns:
    - (df, roles, discovery_info) if successful
    - (None, options_list, None) if needs user choice
    - (None, None, error_info) if error
    """

    try:
        # Load CSV
        df = pd.read_csv(filepath, low_memory=False)
        print(f"Loaded: {df.shape[0]} rows x {df.shape[1]} cols")

        # Existing role detection
        if roles is None:
            # Default roles structure if detect_roles not available
            roles = {
                'target': [], 'identity': [], 'engagement': [],
                'velocity': [], 'profile': [], 'other': []
            }

        # NEW: Target discovery
        engine = TargetDiscoveryEngine(df, roles)
        df_result, discovery_info = engine.run_discovery(user_choice)

        # Case 1: Has existing target → proceed
        if discovery_info.get('source') == 'existing':
            return df, roles, discovery_info

        # Case 2: Created synthetic target → proceed
        if discovery_info.get('source') == 'synthetic':
            return df_result, roles, discovery_info

        # Case 3: Needs user choice → return options to UI
        if discovery_info.get('source') == 'needs_choice':
            return None, discovery_info['options'], None

        # Case 4: Error
        return None, None, discovery_info

    except Exception as e:
        return None, None, {'error': str(e)}


if __name__ == '__main__':
    # DEMO
    print("="*70)
    print("TARGET DISCOVERY ENGINE - DEMO")
    print("="*70)
    
    # Create sample dataset WITHOUT a clear target
    sample_data = {
        'name': ['Alice', 'Bob', 'Charlie', 'David', 'Eve'],
        'email': ['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com', 'e@x.com'],
        'emails_sent': [15, 3, 22, 8, 11],
        'calls_made': [5, 1, 8, 2, 4],
        'deal_value': [50000, 5000, 75000, 10000, 25000],
        'industry': ['SaaS', 'Retail', 'SaaS', 'Finance', 'Tech'],
        'days_in_pipeline': [45, 10, 90, 20, 60],
    }
    df = pd.DataFrame(sample_data)
    
    print("\n📊 Sample CSV (no target column):\n")
    print(df.to_string(index=False))
    
    # Run discovery
    engine = TargetDiscoveryEngine(df)
    result_df, info = engine.run_discovery()
    
    # Show what happens if user picks option 1
    print("\n\n🎯 USER PICKS OPTION 1 (High engagement):\n")
    result_df, info = engine.run_discovery(user_choice=1)
    
    if result_df is not None:
        print("\n✅ DataFrame ready for pipeline:\n")
        print(result_df[['name', 'emails_sent', '__target__']].to_string(index=False))
