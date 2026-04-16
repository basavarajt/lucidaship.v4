# Performance Analysis: Multiple Dataset Analysis Bottlenecks

## Current Issues (O(n²) + O(m²) Complexity)

### 1. **Pairwise Dataset Analysis** 
- For N datasets, analyzing relationships is **O(N²)** combinations
- Each pair compares **ALL columns**: O(m²) where m = column count
- For 5 datasets with 50 columns each: **5×4/2 × 50×50 = 5,000 column-pair analyses**

### 2. **Expensive Value Set Computations**
```python
# In score_column_pair():
- _normalized_value_set(left)  # String conversion + normalization on ALL non-null values
- _normalized_value_set(right) # Repeated for every column pair
- _value_overlap() called twice (raw + normalized)
- _coverage_score() repeats value set extraction
```

### 3. **Profile Dataset Function**
- Calls `_column_profile()` for EVERY column
- Each profile does: `nunique()`, `dropna()`, `astype(str)`, type checking

## Recommended Optimizations

### Priority 1: Caching & Sampling
- Cache value sets per column (compute once, reuse)
- Use row sampling (10-20%) for large datasets to compute value overlap
- Pre-compute column statistics during ingestion

### Priority 2: Parallelization
- Parallelize column-pair analysis across multiple cores
- Process dataset pairs in parallel when N > 2

### Priority 3: Early Termination & Filtering
- Skip column pairs with name dissimilarity < 0.3 (likely false positives)
- Stop after finding top 3-5 candidates per dataset pair
- Reduce top_n parameter (currently 5, could be 3)

### Priority 4: Fast-Path Detection
- Detect simple cases early:
  - All datasets have identical column structure → concat, no analysis
  - Common ID column exists → use it directly without scoring
  - Single column difference → only analyze that column

## Expected Performance Gains

| Optimization | Speedup | Implementation |
|-------------|---------|-----------------|
| Value set caching | **2-3x** | Cache during _analysis_df() |
| Row sampling (20%) | **3-5x** | Use 20% random sample for overlap |
| Column filtering (skip low similarity) | **4-6x** | Pre-screen by name similarity |
| Parallelization (4 cores) | **3-4x** | Use multiprocessing.Pool |
| Combined aggressive mode | **15-25x** | All above + reduce top_n to 2 |

## Implementation Priority

1. **Quick win**: Value set caching + row sampling (2-3 hours to implement, **5-8x faster**)
2. **Medium effort**: Parallelization (1-2 hours, **3-4x faster**)
3. **Full optimization**: Fast-path detection + aggressive filtering (2-3 hours, **15-25x faster**)
