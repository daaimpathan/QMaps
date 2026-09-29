# QMaps Complete Requirements Checklist

**Project:** Quantum-Inspired Intelligent Traffic Route Optimization
**Competition:** SIH Hackathon
**Time Remaining:** ~2-3 days

---

## 1. ALGORITHMS

### 1.1 Completed Algorithms
| Algorithm | Status | File |
|-----------|--------|------|
| PSO | ✅ Done | `algorithms/pso.py` |
| QPSO | ✅ Done | `algorithms/qpso.py` |
| ACO | ✅ Done | `algorithms/aco.py` |
| QACO | ✅ Done | `algorithms/qaco.py` |
| A* (baseline) | ✅ Done | `algorithms/astar.py` |

### 1.2 Pending Algorithm
| Algorithm | Status | Description |
|-----------|--------|-------------|
| **QA-QPSO** | ❌ TODO | Hybrid: QACO (Phase 1) → QPSO (Phase 2) |

**QA-QPSO Implementation Details:**
```
Phase 1: QACO constructs initial routes
  - Run QACO for 100-150 iterations
  - Output: customer permutation + initial vehicle routes
  - Pass to Phase 2 as warm start

Phase 2: QPSO refines solution
  - Initialize particles around QACO best solution
  - Run QPSO for remaining 150-200 iterations
  - Optimize vehicle assignment and customer sequencing

Expected improvement: 5-15% better than standalone QACO/QPSO
```

---

## 2. VRP VARIANTS (Multiple Problem Types)

### 2.1 CVRP — Capacitated Vehicle Routing Problem
**Status:** ✅ Partially implemented (capacity constraint in Prins split)

**What's needed:**
- Already works: vehicle capacity constraint enforced
- Add: explicit CVRP benchmark instances (use existing Solomon with capacity)
- Test: verify capacity feasibility on all routes

**Files to create/modify:**
- `algorithms/cvrp_solver.py` — wrapper for CVRP-specific logic
- `data/instances/cvrp/` — standard CVRP benchmarks (optional)

### 2.2 VRPTW — Vehicle Routing Problem with Time Windows
**Status:** ⚠️ Partially implemented

**What's needed:**
- Add time window constraint handling in cost evaluation
- Penalty for early arrival (waiting time)
- Penalty for late arrival (deadline violation)
- Soft vs hard time window support

**Implementation:**
```python
# In encoding.py, add to evaluate():
def time_window_penalty(routes, instance):
    penalty = 0.0
    for route in routes:
        current_time = 0
        for i, customer in enumerate(route):
            arrival = current_time + travel_time
            ready_time = instance.ready_time[customer]
            due_date = instance.due_date[customer]

            if arrival < ready_time:
                penalty += (ready_time - arrival) * WAITING_PENALTY
            elif arrival > due_date:
                penalty += (arrival - due_date) * LATENESS_PENALTY

            current_time = max(arrival, ready_time) + service_time
    return penalty
```

**Files to create/modify:**
- `encoding.py` — add `evaluate_with_timewindows()`
- `vrp_loader.py` — ensure ready_time, due_date, service_time loaded
- `tests/test_timewindows.py`

### 2.3 Dynamic Traffic / DVRP — Dynamic Vehicle Routing Problem
**Status:** ❌ Not implemented

**What's needed:**
- Real-time traffic events (road closures, congestion)
- Re-optimization on traffic changes
- Recovery metrics (how fast algorithm adapts)

**Implementation:**
```python
class DynamicTrafficEvent:
    type: str  # "road_closure", "congestion", "accident"
    edge: tuple  # (from_node, to_node)
    start_time: int  # iteration when event occurs
    duration: int  # how many iterations it lasts
    severity: float  # 0.0-1.0 (speed reduction factor)

class DynamicVRP:
    def run_with_events(self, events):
        # Phase 1: Normal optimization (0-100 iterations)
        # Phase 2: Inject traffic event at iteration 100
        # Phase 3: Re-optimize and measure recovery

    def recovery_metrics(self):
        return {
            "recovery_time": iterations_to_recover,
            "cost_increase": max_cost_spike,
            "adaptation_score": final_cost / initial_cost
        }
```

**Files to create:**
- `algorithms/dynamic.py` — DynamicVRP base class
- `algorithms/dynamic_events.py` — Traffic event generator
- `benchmark/dynamic_benchmark.py` — Run dynamic experiments
- `results/dynamic_recovery.png` — Plot recovery curves

### 2.4 Optional Advanced Variants (If Time Permits)

| Variant | Description | Priority |
|---------|-------------|----------|
| MDVRP | Multi-Depot VRP | Low |
| VRPPD | Pickup and Delivery | Low |
| OVRP | Open VRP (vehicles don't return) | Low |
| EVRP | Electric Vehicle (charging stations) | Low |

---

## 3. BENCHMARKING

### 3.1 Static Benchmark (30 runs)
**Status:** ⚠️ Only 5 runs completed

**Requirements:**
- [ ] Run 30 independent runs per algorithm
- [ ] Use 3 instances: RC101 (25 cust), RC201 (50 cust), C101 (100 cust)
- [ ] Fixed seed convention: `seed = run_id` (0-29)
- [ ] Max 300 iterations OR 5-second timeout
- [ ] Save raw results to CSV

**Output:**
```
results/
├── benchmark_full_rc101.csv   # 30 runs × 6 algos = 180 rows
├── benchmark_full_rc201.csv
├── benchmark_full_c101.csv
└── benchmark_summary.csv      # Aggregated statistics
```

### 3.2 Statistical Tests
**Status:** ⚠️ Code exists, not fully run

**Required tests:**
- [ ] Shapiro-Wilk normality test (per algorithm per instance)
- [ ] Wilcoxon signed-rank (pairwise: QPSO vs PSO, QACO vs ACO, QA-QPSO vs all)
- [ ] Friedman test (all 6 algorithms together)
- [ ] Nemenyi post-hoc test (if Friedman significant)
- [ ] Cohen's d effect size (all pairwise comparisons)

**Output:**
```
results/
├── normality_tests.json
├── wilcoxon_tests.json
├── friedman_test.json
├── effect_sizes.csv
└── statistical_report.md
```

### 3.3 Dynamic Traffic Benchmark
**Status:** ❌ Not implemented

**Requirements:**
- [ ] Define 3-5 traffic scenarios (road closure, congestion spike)
- [ ] Run each algorithm with same event sequence
- [ ] Measure: recovery time, cost spike, adaptation score
- [ ] Plot: cost over iterations with event markers

**Output:**
```
results/
├── dynamic_benchmark.csv
├── dynamic_recovery_curves.png
└── dynamic_report.md
```

---

## 4. VISUALIZATIONS

### 4.1 Convergence Plots
- [x] Mean ± std convergence for all algorithms (RC101)
- [ ] Per-instance convergence (RC201, C101)
- [ ] Log-scale y-axis option for better visualization

### 4.2 Box Plots
- [ ] Cost distribution per algorithm (30 runs)
- [ ] Runtime distribution per algorithm
- [ ] Side-by-side comparison across instances

### 4.3 Statistical Visualizations
- [ ] Critical difference diagram (Nemenyi post-hoc)
- [ ] Heatmap of p-values (pairwise comparisons)
- [ ] Effect size heatmap

### 4.4 Route Visualization
- [ ] Plot best routes on 2D coordinate plane
- [ ] Color-code by vehicle/route
- [ ] Show depot and customers

### 4.5 Dynamic Visualization
- [ ] Convergence with event markers (vertical lines at events)
- [ ] Before/after route comparison

---

## 5. CODE STRUCTURE

### 5.1 Current Structure
```
QMaps/
├── algorithms/
│   ├── __init__.py
│   ├── base.py
│   ├── astar.py
│   ├── pso.py
│   ├── qpso.py
│   ├── aco.py
│   └── qaco.py
├── analysis/
│   ├── statistics.py
│   └── plot.py
├── benchmark/
│   └── quick_benchmark.py
├── data/
│   └── instances/
│       ├── RC101.csv
│       ├── RC201.csv
│       └── C101.csv
├── results/
├── tests/
├── encoding.py
└── vrp_loader.py
```

### 5.2 Files to Create
```
QMaps/
├── algorithms/
│   ├── qa_qpso.py              # ❌ Hybrid algorithm
│   ├── dynamic.py              # ❌ Dynamic VRP support
│   └── dynamic_events.py       # ❌ Traffic events
├── analysis/
│   ├── full_statistics.py      # ❌ Complete statistical suite
│   └── route_visualizer.py     # ❌ Route plotting
├── benchmark/
│   ├── full_benchmark.py       # ❌ 30-run benchmark
│   └── dynamic_benchmark.py    # ❌ Dynamic traffic tests
├── encoding.py                 # ⚠️ Add time window support
└── vrp_loader.py               # ⚠️ Verify all fields loaded
```

---

## 6. FINAL DELIVERABLES

### 6.1 Code Deliverables
- [ ] All 6 algorithms implemented and tested
- [ ] Support for CVRP, VRPTW, Dynamic VRP
- [ ] Full benchmark suite (30 runs)
- [ ] Statistical analysis pipeline
- [ ] Visualization scripts

### 6.2 Report Deliverables
- [ ] `RESULTS.md` — Summary of findings with p-values and effect sizes
- [ ] `CONVERGENCE_ANALYSIS.md` — Detailed convergence behavior
- [ ] `STATISTICAL_REPORT.md` — Full statistical test results
- [ ] `DYNAMIC_TRAFFIC_REPORT.md` — Dynamic VRP performance

### 6.3 Presentation Materials
- [ ] Summary slides (algorithm comparison)
- [ ] Key plots (convergence, box plots, route visualization)
- [ ] Statistical significance claims with evidence

---

## 7. PRIORITY ORDER (Recommended Execution)

### Day 2 (Today)
1. ✅ Implement QA-QPSO hybrid algorithm
2. ✅ Add time window constraint handling
3. ✅ Run full 30-run benchmark on all 3 instances

### Day 3
1. ✅ Complete statistical tests (Wilcoxon, Friedman, Cohen's d)
2. ✅ Generate all plots (convergence, box plots, heatmaps)
3. ✅ Implement dynamic traffic events

### Day 4
1. ✅ Run dynamic traffic benchmark
2. ✅ Create route visualization
3. ✅ Write final reports and presentation materials

---

## 8. SUCCESS CRITERIA

### Minimum Viable (Must Have)
- [ ] 5 algorithms + QA-QPSO hybrid working
- [ ] At least 1 significant comparison (p < 0.05) with effect size
- [ ] Convergence plot showing quantum advantage
- [ ] Basic statistical report

### Target (Should Have)
- [ ] Full 30-run benchmark on 2-3 instances
- [ ] All statistical tests completed
- [ ] Time window constraints working
- [ ] Dynamic traffic demonstration

### Stretch Goals (Nice to Have)
- [ ] Route visualization
- [ ] Multiple VRP variants (CVRP + VRPTW + DVRP)
- [ ] Critical difference diagram
- [ ] Comprehensive technical report

---

## 9. CLAIM TEMPLATES (For Presentation)

When presenting results, use these formats:

### Significant Result
> "QPSO significantly outperforms PSO on RC101 (mean cost: 947.2 vs 949.1, Wilcoxon p=0.003, Cohen's d=-0.87, large effect)."

### Non-Significant Result
> "QACO and ACO show no statistically significant difference on RC201 (p=0.23), suggesting quantum rotation provides marginal improvement on this instance class."

### Effect Size Interpretation
> "The Cohen's d of 0.92 indicates QPSO's advantage over PSO is practically meaningful, not just statistically detectable."

---

## 10. REFERENCES

1. Sun, Xu, Liu (2004) — QPSO original paper
2. Wang & Yu (2008) — QACO original paper
3. García et al. (2009) — Statistical tests for EC
4. Demšar (2006) — Friedman + Nemenyi procedures
5. Solomon (1987) — VRPTW benchmark instances

---

**Last Updated:** 2026-09-24
**Status:** Ready for implementation
