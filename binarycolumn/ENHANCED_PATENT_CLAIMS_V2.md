# ENHANCED PATENT CLAIMS FOR LUCIDA
## "Probabilistic Multi-Criteria Ranking with Adaptive Model Arbitration"

**Status:** Draft enhancement to existing US Patent (April 2026)  
**Strategy:** Expand claim scope to include unsupervised algorithms while retaining original routing invention  
**Patent Type:** Method + System claims (Utility Patent / Software Patent)

---

## EXECUTIVE SUMMARY: PATENT STRENGTHENING STRATEGY

### Current Patent Position
- **Existing Claims:** Adaptive routing, model arbitration, routing ledger, feedback-driven retraining
- **Scope:** System architecture and governance (reasonably defensible)
- **Weakness:** Could be challenged as obvious ensemble selection + ledger + retraining

### Enhanced Patent Position
- **NEW Claims:** Probabilistic multi-criteria ranking without labels, TOPSIS/AHP/Bradley-Terry
- **Scope:** Algorithm + Architecture + Explainability (much stronger)
- **Strength:** Combines multiple non-obvious mathematical approaches for unified solution

### Patent Expansion Map

```
EXISTING CLAIMS (Routed Adaptive Ranking)
    ↓
    + UNSUPERVISED RANKING (NEW, Claims D)
    + PROBABILISTIC MODELS (NEW, Claims E-F)
    + EXPLAINABILITY LAYER (NEW, Claims G)
    ↓
ENHANCED PATENT = Much harder to design-around
```

---

## CLAIM STRATEGY: BROAD → NARROW FUNNEL

### Breadth Claims (Easy to defend, capture competitors)
- Claims D-1, D-2: Unsupervised, multi-signal, auto-adaptive
- Claims E-15, E-16: Probabilistic confidence in routing

### Narrow Claims (Specific implementation, harder to challenge)
- Claims D-11, D-12, D-13: Exact algorithm (TOPSIS + AHP + Bradley-Terry)
- Claims F-17, F-18, F-19: Feedback-triggered Bradley-Terry retraining
- Claims G-20, G-21: Explainability decomposition

### Dependent Claims (Enable licensing)
- Claims D-2 through D-10
- Claims E-15 through E-19
- Claims F-20 through F-22

---

## INDEPENDENT CLAIMS (BROADEST)

```
CLAIM 1 (Method for Unsupervised Ranking)
─────────────────────────────────────────

A computer-implemented method for ranking records from tabular data without 
explicit target labels, comprising:

(a) receiving as input a dataset comprising a plurality of records, each record 
    having a plurality of attributes across multiple columns, the dataset 
    containing no labeled target variable;

(b) analyzing the dataset schema to identify attribute types (numeric, categorical, 
    temporal, composite);

(c) extracting, for each record, a multi-dimensional signal vector comprising 
    between 40 and 100 signals derived from:
    
    (i) numeric attributes: absolute values, z-scores, percentile ranks, distances 
        to optimal values;
    (ii) categorical attributes: entropy, frequency rank, cardinality indicators;
    (iii) temporal attributes: recency, velocity, trend indicators;
    (iv) composite attributes: cross-column interactions, ratios, aggregate statistics;

(d) normalizing all signals to a common [0, 1] scale using min-max scaling;

(e) applying a multi-criteria decision-making algorithm to generate a ranking score 
    for each record based on proximity to an ideal solution, the algorithm selected 
    from: TOPSIS (Technique for Order Preference by Similarity to Ideal Solution), 
    AHP (Analytic Hierarchy Process), or a probabilistic ranking model;

(f) generating for each record a ranking score in the range [0, 1];

(g) optionally generating confidence intervals or posterior distributions over the 
    ranking scores using probabilistic methods;

(h) outputting the ranking scores and optional confidence intervals, whereby records 
    are ranked without requiring any labeled outcomes or manual feature engineering.

Claim  1 is independent and self-contained. It is NOT limited to:
  - Any specific ensemble or base learner
  - Any particular model selection mechanism
  - Any particular dataset size or schema
  - The presence of supervision or labeled data
  
This breadth enables coverage of all "unsupervised multi-criteria ranking" approaches.


CLAIM 2 (System for Probabilistic Ranking + Routing)
────────────────────────────────────────────────────

A computer-implemented ranking and routing system, comprising:

(a) one or more processors and a memory storing executable instructions;

(b) a signal extraction module configured to:
    (i) receive a tabular dataset with arbitrary schema
    (ii) automatically infer column types without manual schema specification
    (iii) generate 40-100 signals per record across numeric, categorical, temporal, 
          and composite categories
    (iv) store min/max normalization parameters for inference;

(c) a multi-criteria decision maker configured to:
    (i) accept the signal vectors from step (b)
    (ii) compute TOPSIS-based ranking scores using distance to ideal/worst solutions
    (iii) optionally apply AHP weight correction via signal importance hierarchy
    (iv) combine scores using weighted ensemble (e.g., 0.6×TOPSIS + 0.4×AHP)
    (v) output ranking scores [0, 1] per record;

(d) a probabilistic uncertainty quantifier configured to:
    (i) accept ranking scores and signal vectors
    (ii) compute confidence intervals via bootstrap resampling OR posterior sampling
    (iii) output [lower, upper] confidence bounds for each ranking;

(e) a routing arbitration engine configured to:
    (i) match incoming records to segment definitions
    (ii) identify multiple candidate models (base + specialized)
    (iii) rank candidates by: accuracy on segment, feedback volume, probabilistic 
          confidence for this record (from step d)
    (iv) select the highest-priority candidate
    (v) generate a routing ledger containing:
        - selected model identifier
        - route decision reason
        - ranking score and confidence interval
        - signal importance decomposition
        - list of alternatives considered;

(f) a feedback loop module configured to:
    (i) receive outcome data linked to previously scored records
    (ii) detect concept drift by comparing recent vs historical performance
    (iii) identify segments with declining accuracy
    (iv) trigger automated retraining when thresholds are met
    (v) update probabilistic model parameters based on new outcomes.

System 2 provides an integrated solution for ranking, routing, and explaining 
decisions, operating on tabular data without labeled training data.


CLAIM 3 (Unsupervised Ranking with Arbitrary Schema Support)
─────────────────────────────────────────────────────────────

A method for generating comparative rankings of records across heterogeneous 
tabular datasets, comprising:

(a) receiving datasets with different column names, types, and structures;

(b) performing dataset-agnostic analysis:
    (i) detecting numeric columns by type inference
    (ii) detecting categorical columns by cardinality and uniqueness
    (iii) detecting temporal columns by date parsing and recency patterns
    (iv) extracting 40-100 signals WITHOUT human specification of features;

(c) computing ranking scores using mathematical foundations that do NOT require:
    - labeled training examples
    - manual feature engineering specifications
    - pre-specified segment definitions
    - domain-specific heuristics;

(d) generating rankings whereby rows are ordered by computed score without:
    - synthetic binary target creation
    - user-provided target variable
    - supervised learning machinery;

(e) enabling the system to rank records the FIRST time data is loaded, 
    without cold-start delay or labeling campaigns.

Claim 3 explicitly addresses the novelty of working across arbitrary schemas 
without synthetic targets.
```

---

## DEPENDENT CLAIMS: TOPSIS SPECIFICATION

```
CLAIM 11 (TOPSIS Method Specification)
──────────────────────────────────────

The method of claim 1, wherein step (e) specifically comprises:

(a) computing an ideal solution vector as the max value of each normalized signal;

(b) computing a worst solution vector as the min value of each normalized signal;

(c) for each record, computing the Euclidean distance to the ideal solution:
    D_ideal = sqrt( sum_i (signal_i - ideal_i)^2 );

(d) for each record, computing the Euclidean distance to the worst solution:
    D_worst = sqrt( sum_i (signal_i - worst_i)^2 );

(e) computing the TOPSIS score as:
    score = D_worst / (D_ideal + D_worst);

(f) the TOPSIS score naturally ranges [0, 1] where 0 = worst, 1 = ideal;

(g) the TOPSIS computation operates in O(n×m) time complexity where n = # records, 
    m = # signals (~50), enabling real-time scoring on datasets up to millions of rows.

Claim 11 provides specificity for examiners without limiting to a single algorithm.


CLAIM 12 (AHP Signal Importance)
─────────────────────────────────

The method of claim 1, wherein step (e) optionally comprises:

(a) identifying the top K signals by variance (e.g., K=10);

(b) constructing a pairwise comparison matrix M where M_ij represents the 
    relative importance of signal_i vs signal_j on ranking quality;

(c) computing eigenvalues and eigenvectors of the comparison matrix;

(d) extracting the principal eigenvector as the signal importance weights;

(e) validating consistency via the Consistency Ratio: 
    CR = (lambda_max - n) / ((n-1) * RI);
    
    where lambda_max is the maximum eigenvalue, n is matrix size, RI is random index.
    Accepting the weighting only if CR < 0.1;

(f) optionally re-weighting signals if CR exceeds threshold by soliciting expert 
    comparisons (semi-supervised fallback);

(g) using the validated AHP weights to compute a weighted TOPSIS score or to modulate 
    signal contributions in the final ranking output.

Claim 12 covers the AHP mathematical approach with validation.


CLAIM 13 (Probabilistic Confidence Intervals)
──────────────────────────────────────────────

The method of claim 1, wherein step (g) comprises:

(a) performing K-times bootstrap resampling of the signal matrix (K = 100-1000 samples);

(b) for each bootstrap sample, re-normalizing signals and recomputing the ranking score;

(c) collecting the distribution of bootstrap scores: [score_1, score_2, ..., score_K];

(d) computing empirical percentiles: 
    lower_bound = percentile_2.5(scores)
    upper_bound = percentile_97.5(scores);

(e) outputting confidence intervals [lower, upper] for each record's ranking score;

(f) marking records with wide confidence intervals (width > 0.3) as "low confidence" 
    for downstream routing decisions;

(g) optionally using Bayesian posterior sampling instead of bootstrap, where signal 
    distributions are modeled as Dirichlet or Normal distributions and posterior 
    means/credible intervals are computed.

Claim 13 covers uncertainty quantification methods.
```

---

## DEPENDENT CLAIMS: BRADLEY-TERRY FEEDBACK MODEL

```
CLAIM 14 (Bradley-Terry Probabilistic Ranking from Outcomes)
──────────────────────────────────────────────────────────────

The system of claim 2, wherein the feedback loop module additionally comprises a 
probabilistic ranking model configured to:

(a) receive pairwise outcome comparisons: {(row_i, outcome_i), (row_j, outcome_j)};

(b) for each outcome pair where outcome_i = converted and outcome_j = unconverted, 
    increment a "win" count for row_i;

(c) for each outcome where outcome_j = converted and outcome_i = unconverted, 
    increment a "win" count for row_j;

(d) compute Bradley-Terry parameters p_i for each row:
    
    p_i_hat = (win_count_i + 1) / (total_appearances_i + 2);
    [where +1 and +2 are regularization to avoid division by zero];

(e) treat p_i_hat as a probability distribution over "ranks" where p_i represents 
    the likelihood that row i would "win" in a random pairwise comparison;

(f) interpreting records with high p_i as having strong ranking signal (converted often),
    and low p_i as weak signal (unconverted often);

(g) optionally generating posterior samples from a Dirichlet(p_1 * alpha, ..., p_n * alpha) 
    distribution to quantify uncertainty in the estimates;

(h) using the posterior samples to update signal importances or re-weight the TOPSIS 
    algorithm for improved alignment with observed outcomes.

Claim 14 adds probabilistic rigor to feedback integration.


CLAIM 15 (Feedback-Triggered Retraining with Drift Detection)
───────────────────────────────────────────────────────────────

The system of claim 2, wherein the feedback loop module further comprises logic to:

(a) collect scored row snapshots: [timestamp_i, row_signature_i, predicted_rank_i, 
                                  signals_i, selected_model_i];

(b) later receive outcome data: [timestamp_j, row_signature_j, observed_outcome_j];

(c) match outcomes to scored snapshots using deterministic row signatures 
    (e.g., hash of primary key fields);

(d) for each segment (cohort definition), compute performance metrics:
    - ROC AUC on segment over past 7 days vs past 30 days
    - Precision@K (% of top-ranked that actually converted)
    - Recall@K (% of conversions in top-K);

(e) detect concept drift by computing the absolute difference in ROC AUC:
    drift_score = |AUC_recent - AUC_historical|;

(f) triggering automatic retraining when EITHER:
    (i) drift_score > 0.10 AND feedback_volume > 50 rows, OR
    (ii) drift_score > 0.20 AND feedback_volume > 20 rows, OR
    (iii) 7 days have passed since last retraining for this segment;

(g) performing statistical significance testing (e.g., chi-square) to confirm the 
    observed drift is not due to random variation (p < 0.05);

(h) upon retraining trigger: refit the probabilistic model on new feedback outcomes 
    for the drifting segment, extract updated signal importances, and deploy a new 
    version of the segment model;

(i) versioning all artifacts so that prior predictions can later be compared against 
    new model versions for audit and explanation purposes.

Claim 15 covers automated, statistically-grounded retraining.
```

---

## DEPENDENT CLAIMS: EXPLAINABILITY

```
CLAIM 16 (Multi-Criteria Explainability Decomposition)
─────────────────────────────────────────────────────────

The system of claim 2, wherein the routing arbitration engine additionally generates 
an explainability output comprising:

(a) for each record, computing the individual contribution of each signal to the 
    final ranking score:
    
    contribution_i = signal_i_normalized × signal_weight_i;

(b) normalizing contributions to a [-1, +1] scale:
    - +1 indicates maximum positive impact on ranking
    - 0 indicates neutral impact
    - -1 indicates maximum negative impact;

(c) rank-ordering signals by absolute contribution magnitude;

(d) identifying the top-3 signals with largest contributions;

(e) converting signal names and contributions into human-readable explanations:
    
    Example: "High profile_completeness (+0.18): This lead filled in 90% of profile 
             fields, strongly indicating engagement."
    
    Example: "Low recent_activity (-0.05): Last activity was 30 days ago, slightly 
             lowering ranking.";

(f) combining the multi-criteria decomposition WITH the routing ledger to generate 
    a complete explanation showing:
    - Which signals drove the unsupervised ranking
    - Which segment the record matched
    - Which model was selected for scoring
    - Why that model was preferred over alternatives;

(g) surfacing this explanation in a user-facing interface (e.g., dashboard, report) 
    so users can understand and audit ranking/routing decisions without ML expertise.

Claim 16 covers interpretability/explainability as a core system output.


CLAIM 17 (Natural Language Explanations from Signal Decomposition)
──────────────────────────────────────────────────────────────────

The method of claim 16, wherein the explanation is further generated using:

(a) defining a signal-to-description mapping that translates technical signal names 
    to business language:
    
    Examples:
    - "profile_completeness" → "Lead profile depth"
    - "recent_activity" → "Recent engagement"
    - "company_size_percentile" → "Company scale"
    - "industry_entropy" → "Industry popularity";

(b) for each top-3 signal contribution, generating a sentence describing the signal 
    and its impact:
    
    Template: "[Signal description] ([+/- contribution]): [Human-readable context]"
    
    Example: "Lead profile depth (+0.18): This lead has provided detailed company 
             information (90% profile complete), indicating serious intent.";

(c) concatenating the signal descriptions into a paragraph;

(d) optionally adding a recommendation based on the ranking and detected segments:
    
    Example: "This lead ranks highly and matches the 'Fortune 500' segment. 
             Consider routing to enterprise sales team.";

(e) enabling end-users to click through explanations to view the underlying signals 
    and metrics;

(f) providing an audit trail so that for any historical ranking decision, the original 
    explanation and underlying data can be audited for compliance.

Claim 17 enhances claim 16 by connecting signals to natural language.
```

---

## CONTINUITY CLAIMS: LINKING TO EXISTING ROUTING PATENT

```
CLAIM 18 (Integration with Adaptive Routing)
──────────────────────────────────────────────

The system of claims 1-17, when combined with a routing arbitration engine 
(as described in U.S. Patent/Application [X]), wherein:

(a) the unsupervised ranking scores from claim 1 are used to enrich the 
    routing ledger described in routing patent claim 6 (route explanation ledger);

(b) the confidence intervals from claim 13 are used by the routing engine to 
    determine model eligibility: a model is preferred for routing if its historical 
    accuracy on similar records EXCEEDS the uncertainty represented by the 
    confidence interval;

(c) the signal decomposition from claim 16 is combined with model selection rationale 
    to create a unified explanation: "This record ranks 0.87 (driven by profile 
    completeness and recent activity). It matches the SaaS segment, so we route to 
    the SaaS-specialized model which is 5% more accurate on this type of lead.";

(d) the probabilistic models from claim 14 and retraining logic from claim 15 feed 
    back into the ranking engine, so that routing decisions and outcome feedback 
    together drive both RANKING model updates AND routing policy updates.

Claim 18 bridges the unsupervised ranking innovation (new) to the adaptive routing 
invention (existing patent), creating a cohesive integrated system.
```

---

## CLAIM PROSECUTION STRATEGY

### For USPTO Examiners

1. **Overcome "Abstract Idea" Rejection** (likely for Claim 1)  
   - Response: "The claimed method is not an abstract mathematical algorithm, 
     but rather a specific systems implementation that transforms arbitrary tabular 
     data into ranked outputs without human supervision. The O(n×m) time complexity 
     and real-time scoring capability represent patent-eligible improvements to a 
     computer system."
   - Cite: Alice Corp, Mayo v Prometheus, Enfish LLC

2. **Overcome "Obvious" Rejection** (likely for general method)  
   - Response: "While TOPSIS (1981) and Bradley-Terry (1952) are individual prior 
     art algorithms, their combination in an integrated closed-loop system with:
     (a) automatic signal extraction from arbitrary schema,
     (b) real-time confident-aware routing,
     (c) outcome-driven feedback with significance testing, and
     (d) probabilistic confidence intervals
     represents a non-obvious synergy. No single prior art reference teaches this 
     combination."
   - Cite: Graham v. John Deere, KSR v Teleflex

3. **Overcome "Generic Computer" Rejection** (likely for system claims)  
   - Response: "The claimed system is not a generic computer. The signal extraction 
     module, TOPSIS aggregator, probabilistic quantifier, and routing arbitration 
     engine are specifically configured to solve a technical problem (ranking tabular 
     data without labels) in a non-obvious manner. The system components work together 
     in a specific way to achieve an improvement over prior art."
   - Cite: Enfish v Microsoft, Diamond v. Diehr

### Examiner Interview Talking Points

- **Lead with problem:** "Single-model lead scoring fails for heterogeneous data. 
  Our solution provides segment-specific routing WITH real-time confidence quantification."
- **Emphasize novelty:** "TOPSIS + AHP + Bradley-Terry + automatic drift detection 
  = new combination, not obvious."
- **Tie to routed adaptive invention:** "This invention extends the routing system 
  by making rankings themselves adaptive and explainable."
- **Address computer:" "The improvements are implemented in software but solve a 
  concrete technical problem in data ranking."

---

## DESIGN-AROUND DIFFICULTY ANALYSIS

**How hard would it be for competitors to design around these claims?**

| Claim | Element | Design-Around Difficulty |
|-------|---------|--------------------------|
| 1 | Unsupervised multi-criteria ranking | **HIGH** - requires all 3 algorithms or equivalent |
| 11 | TOPSIS specifically | **MEDIUM** - competitors could use alternative (e.g., SAW, ELECTRE) |
| 12 | AHP weighting + validation | **HIGH** - CR<0.1 consistency check is specific |
| 13 | Bootstrap confidence intervals | **MEDIUM** - Bayesian posteriors are different enough |
| 14 | Bradley-Terry feedback model | **HIGH** - specific probabilistic framework |
| 15 | Statistical drift detection | **HIGH** - specific significance testing requirement |
| 16 | Multi-criteria explainability | **HIGH** - unique combination of decomposition + ledger |
| 18 | Integration with routing | **VERY HIGH** - creates interdependence with routing patent |

**Overall:** Competitors would need to avoid MOST of these elements, which would 
disable the core unsupervised ranking capability. Strong patent position.

---

## LICENSING & COMMERCIAL POSITIONING

### Patent as Licensing Asset

1. **Direct licensing:** Possible licensing agreements for competitors or adjacent markets
2. **Cross-licensing:** Trade patent for access to competitor tech
3. **Defensive publication:** If not filed, publish to block competitors' patents
4. **Standards body:** Potential to contribute TOPSIS/AHP integration to IEEE or ISO standards

### Freedom to Operate (FTO) Risks

- **TOPSIS:** Published 1981, unlikely patent coverage (could check Google Patents)
- **AHP:** Published 1977, unlikely patent coverage
- **Bradley-Terry:** Published 1952 + 1974, expired or close to expired
- **Bootstrap:** Published 1979, likely expired
- **Lucida routing:** Own IP (existing patent)

**Conclusion:** Likely minimal FTO risk. New combination is Lucida's innovation.

---

## RECOMMENDED FILING STRATEGY

1. **File utility patent NOW** (before public disclosure beyond this team)
   - 12-month priority window
   - Include all independent claims (1-3) + dependent claims (11-18)
   - Cite TOPSIS, AHP, Bradley-Terry papers as prior art (shows non-obviousness)

2. **File continuation application** (in F TO) for follow-on innovations like:
   - Real-time multi-segment retraining
   - Federated feedback processing
   - Patent-defensive combination of ranking + explainability

3. **Publish white paper** (after patent filed) to build thought leadership
   - "Unsupervised Ranking for SaaS Platforms: A Multi-Criteria Approach"
   - Cite claims from patent
   - Drive technical credibility

---

## FINANCIAL IMPACT ESTIMATE

| Metric | Impact |
|--------|--------|
| **Patent Grant Value** | $50K-200K (defensive moat) |
| **Licensing Revenue Potential** | $500K-2M/year (competitors) |
| **M&A Premium from IP** | +15-30% valuation (strategic buyer) |
| **Product Differentiation** | Enables premium pricing tier |
| **Competitive Moat Length** | 20 years (patent life) |

---

**END OF ENHANCED PATENT CLAIMS DOCUMENT**

---

## NEXT STEPS

1. ✅ **File Provisional Patent** (within 30 days)
   - Use these claims as basis
   - Prepare detailed specification with code examples
   - Pay USPTO filing fee ($1,600)

2. ⏳ **12-Month Priority Window**
   - During priority period: develop product, validate with customers
   - Monitor competitor activity
   - Refine claims based on technical development

3. 📄 **File Non-Provisional (Utility) Patent**
   - Full specification, drawings, claims
   - $900 (small entity) or $1,800 (large entity)
   - Response to office actions (2-4 typical)

4. 🌍 **International Filing** (PCT)
   - Extends patent to ~150 countries
   - Decision point: is international market worth $5-10K?

**Timeline:** Provisional now → Utility in 12 months → Patent grant in 3-5 years

---

