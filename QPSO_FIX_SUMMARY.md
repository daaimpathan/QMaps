# QPSO diagnosis and current benchmark

## Implementation issue fixed

The previous `algorithms/qpso.py` had instance-specific beta arithmetic that did not implement the project's documented contraction schedule. On C101, the beta was clamped at 1.0 through the run; RC201 also began at the clamp and contracted too slowly. For large instances, the initial random keys were correlated and quantum updates were clipped to `[0, 1]`, which can collapse distinct keys to ties.

QPSO now uses the specified schedule `beta(t) = 1 - 0.5 * t / max_iter`, independent random-key starts, the mean of personal bests at each iteration, an updated global best, and unclipped real-valued keys. `argsort` only depends on key order, so values outside `[0, 1]` remain valid. The benchmark uses 30 particles, 300 iterations maximum, a five-second time limit, and fixed seeds `0..29`.

## Historical dashboard cohort

The dashboard's saved `benchmark_full_20260925_160246.csv` reports 30 feasible runs per algorithm. Recomputed from its paired rows:

| Instance | QPSO mean | PSO mean | QPSO gap vs PSO | Wilcoxon p | Cohen's d |
| --- | ---: | ---: | ---: | ---: | ---: |
| RC201 | 2538.31 | 2514.56 | +0.94% | 0.2129 | 0.36 |
| C101 | 4361.29 | 4328.08 | +0.77% | 0.0732 | 0.52 |

Neither historical comparison is significant at 0.05. The CSV predates later optimizer and route-evaluator edits, so it is historical context rather than a valid before/after comparison with the current code.

## Same-code paired rerun

The current PSO and canonical QPSO were run on the current instances with the same 30 seeds and budget. All runs were feasible.

| Instance | QPSO mean | PSO mean | QPSO gap vs PSO | Wilcoxon p | Cohen's d | Seeds favoring PSO |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| RC201 | 2424.36 | 1896.38 | +27.84% | 6.15e-8 | 2.75 | 29 / 30 |
| C101 | 4405.49 | 3357.94 | +31.20% | 1.86e-9 | 7.77 | 30 / 30 |

Raw runs and convergence histories are in `results/qpso_correction_20260928_002809.csv`. The corrected implementation is faithful to the documented QPSO update, but QPSO still loses significantly to PSO on the current RC201 and C101 workloads. The benchmark UI reports this honestly and recommends PSO for these instances based on the paired rerun.

The remaining performance gap is not evidence that the canonical update is broken. A likely limitation is representational: `argsort` plus Prins split turns continuous updates into a discontinuous sequence objective. This explanation is consistent with the results but was not isolated by a causal ablation. Any additional discrete neighborhood or local-search step should be named and benchmarked as a distinct QPSO hybrid, with the same evaluation budget and paired seeds; it should not be presented as plain QPSO.
