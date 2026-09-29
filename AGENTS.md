# AGENTS.md — QMaps Project Context

This file gives any Codex session complete context for this project. Read this fully before doing any work.

## PROJECT: Quantum-Inspired Intelligent Traffic Route Optimization

**Competition project (SIH-style hackathon).** We are implementing and rigorously benchmarking quantum-inspired metaheuristics for the Vehicle Routing Problem (VRP). This is a research-grade implementation, NOT a basic college project.

**Deadline: 4 days total. Day 1 starts today.**

---

## THE 6 ALGORITHMS WE'RE BUILDING

1. **A*** — classical shortest path baseline (Hart, Nilsson, Raphael 1968). Reference point only; solves single-pair shortest path, NOT multi-vehicle VRP.
2. **PSO** — classical Particle Swarm Optimization. Params: w=0.7, c1=1.5, c2=1.5, particles=30.
3. **QPSO** — Quantum-behaved PSO (Sun, Xu, Liu 2004, IEEE Trans. Evolutionary Computation). Params: beta_initial=0.8 (adaptive), particles=30.
4. **ACO** — classical Ant Colony Optimization. Params: alpha=1.0, beta=5.0, rho=0.1, ants=20.
5. **QACO** — Quantum-inspired ACO (Wang & Yu 2008). Quantum rotation gates replace pheromone. Params: alpha=1.0, beta=5.0, theta_initial=π/4, ants=20.
6. **QA-QPSO** — OUR HYBRID (primary innovation): Phase 1 QACO constructs routes → Phase 2 QPSO refines vehicle assignment/sequencing.

**Comparison structure:** A* (reference), PSO vs QPSO (quantum gain #1), ACO vs QACO (quantum gain #2), QA-QPSO (hybrid vs all).

---

## CORE MATH (VERIFIED FROM LITERATURE)

### PSO update:
```
v(t+1) = w*v(t) + c1*r1*(pbest - x) + c2*r2*(gbest - x)
x(t+1) = x(t) + v(t+1)
```

### QPSO update (NO velocity — direct position update):
```
p = φ*pbest + (1-φ)*gbest          # local attractor, φ ∈ (0,1) random
mbest = (1/N) * Σ pbest_i           # mean best position
u = random(0,1)
x(t+1) = p ± β * |mbest - x(t)| * ln(1/u)
```
- β = contraction-expansion coefficient. Adaptive: β(t) = 1.0 - 0.5*(t/max_iter)
- The ± randomness is what gives QPSO better exploration than PSO.

### ACO:
```
P_ij = (τ_ij^α * η_ij^β) / Σ(τ_ik^α * η_ik^β)    # ant decision
τ_ij(t+1) = (1-ρ)*τ_ij(t) + Δτ_ij                  # evaporation + deposit
```
- η_ij = 1/distance_ij (heuristic)

### QACO rotation gate:
```
|ψ> = cos(θ)|0> + sin(θ)|1>       # qubit state
θ(t+1) = θ(t) + Δθ                 # rotation update
```
- Quantum rotation angles replace pheromone values; smoother convergence, maintains path diversity.

---

## SOLUTION ENCODING (CRITICAL — HOW CONTINUOUS ALGORITHMS SOLVE DISCRETE VRP)

**Random-key encoding (Bean 1994):**
- Particle position = vector of N random reals (one per customer)
- Decode: argsort the vector → customer visit sequence
- Any real vector decodes to a valid permutation → no invalid solutions

**Prins split (Prins 2004):**
- Takes the customer sequence → splits into capacity-feasible routes
- Builds auxiliary graph, finds optimal split via shortest path
- GUARANTEES capacity feasibility from ANY sequence

**Constraint handling:** Penalty functions for violations (time window etc.). Prins split handles capacity automatically.

---

## DATASETS: SOLOMON VRPTW BENCHMARKS

- Solomon (1987), Operations Research 35(2):254-265. 56 instances, 100 customers each.
- Classes: C (clustered), R (random), RC (mixed) × Type 1 (tight windows) / Type 2 (loose)
- **We use: RC101 (25 cust), RC201 (50 cust), C101 (100 cust)**
- File format (7 cols): customer_number, x, y, demand, ready_time, due_date, service_time
- Row for customer 0 = depot. Header lines at top (~9 lines to skip).
- Vehicle capacity is in the header. Best-known solutions tracked on CVRPLIB / VRP-REP (verify at runtime; original Northeastern URL may have moved).

---

## BENCHMARKING PROTOCOL (NON-NEGOTIABLE FOR JUDGES)

- **30 independent runs** per algorithm per instance (different seeds: seed=run_id)
- Max 300 iterations OR 5-second timeout per run
- Record per run: final cost, convergence curve (gbest cost per iteration), iterations_to_best, wall-clock time, feasibility
- **Statistical tests** (per García et al. 2009, Journal of Heuristics; Demšar 2006, JMLR):
  - Shapiro-Wilk normality check (expect non-normal → non-parametric tests)
  - Wilcoxon signed-rank: QPSO vs PSO, QACO vs ACO, hybrid vs all
  - Friedman test: all 6 algorithms across instances (+ Nemenyi post-hoc if time)
  - Cohen's d effect size (0.2 small, 0.5 medium, 0.8 large)
  - Claim template: "QPSO significantly outperforms PSO (p=0.002, d=-0.92)"
- **Visualizations:** convergence curves (mean±std shaded), box plots, summary CSV, dynamic recovery plot (Day 4 if time)

**Experiment totals:** 3 instances × 6 algorithms × 30 runs = 540 static experiments (minimum viable: 1-2 instances × 4 algos × 20-30 runs)

---

## PROJECT STRUCTURE

```
QMaps/
├── AGENTS.md              ← this file
├── data/
│   └── instances/         ← RC101.txt, RC201.txt, C101.txt (Solomon format)
├── algorithms/
│   ├── __init__.py
│   ├── base.py            ← Optimizer ABC (optimize() returns cost, routes, convergence, time, feasible)
│   ├── astar.py
│   ├── pso.py
│   ├── qpso.py
│   ├── aco.py
│   └── qaco.py
├── vrp_loader.py          ← VRPInstance class (parse Solomon, distance matrix)
├── encoding.py            ← random-key decode + Prins split
├── benchmark/
│   └── runner.py          ← BenchmarkRunner (30 runs × algos, save pickle/CSV)
├── analysis/
│   ├── statistics.py      ← Wilcoxon, Friedman, Cohen's d, Shapiro-Wilk
│   └── plot.py            ← convergence, boxplots
├── results/               ← summary.csv, convergence.png, boxplot.png, tests.json
└── tests/
    └── test_algorithms.py
```

---

## 4-DAY EXECUTION PLAN

**Day 1 (TODAY):** Project setup, VRP loader, encoding + Prins split, PSO + QPSO implemented and tested, first convergence comparison on RC101.
**Day 2:** ACO + QACO + A*, unit tests, quick benchmark (5 runs each).
**Day 3:** Full static benchmark (30 runs), statistical tests, plots.
**Day 4:** Remaining results, dynamic traffic event test (inject road closure → re-optimize → recovery metrics), final report, presentation.

**Priority if behind:** A* + PSO + QPSO + ACO first. QACO next. Hybrid last. Convergence plot with p<0.05 beats everything.

---

## DEVELOPMENT RULES

1. **Correctness over optimization** — working algorithm beats fast broken one
2. **Fixed seeds** for reproducibility (seed=run_id convention)
3. **Test single runs constantly** — don't batch-test broken code
4. **NumPy vectorization** where possible (distance matrix lookups)
5. **No frontend** — judges score algorithms (80%) + benchmarking (15%); PNG plots + CSV + terminal demo are enough
6. Every algorithm's optimize() must return: `{cost, best_cost, routes, convergence, iterations_to_best, time, feasible}`
7. When claiming results, ALWAYS attach p-value + effect size

## KEY REFERENCES (VERIFIED)

1. Sun, Xu, Liu (2004) "A global search strategy of quantum-behaved particle swarm optimization" — IEEE Trans. Evol. Comput.
2. Wang & Yu (2008) "A quantum inspired ant colony algorithm for combinatorial optimization" — Int'l J. Intelligent Computing & Cybernetics
3. Bean (1994) "Genetic algorithms and random keys for sequencing and optimization" — EJOR
4. Prins (2004) "A simple and effective evolutionary algorithm for the vehicle routing problem"
5. Solomon (1987) "Algorithms for the VRP and Scheduling Problems with Time Window Constraints" — Operations Research 35(2)
6. García, Fernández, Luengo, Herrera (2009) — non-parametric tests for EC, Journal of Heuristics
7. Demšar (2006) "Statistical Comparisons of Classifiers over Multiple Data Sets" — JMLR 7:1-30

Full details: see `../RESEARCH_REPORT_Verified.md` in the parent folder (SIH26137).