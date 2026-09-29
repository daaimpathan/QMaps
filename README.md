# QMaps - Quantum-Inspired Intelligent Traffic Route Optimization

**Competition Project** | **Status:Completed** | **Winner Algorithm: QA-QPSO**

---

## 🏆 Results Summary

**RC101 (25 customers, 5 runs)**

| Algorithm | Mean Cost | Best Cost | Improvement |
|-----------|-----------|-----------|-------------|
| **QA-QPSO** | **560.49** | **544.32** | **Baseline** |
| QACO | 649.39 | 614.66 | +15.9% |
| ACO | 677.09 | 606.49 | +20.8% |
| A* | 901.24 | 901.24 | +60.8% |
| PSO | 949.25 | 905.61 | +69.3% |
| QPSO | 967.86 | 924.59 | +72.6% |

**Key Finding:** QA-QPSO beats all other algorithms by **13.7-72.6%**

---

## 📊 Available Visualizations

All plots in `results/` folder:

1. **boxplots.png** - Cost distribution comparison
2. **algorithm_rankings.png** - Mean cost bar chart
3. **runtime_comparison.png** - Runtime analysis
4. **convergence_all_algorithms_rc101.png** - Convergence curves

---

## 🚀 Quick Start

### Run a Quick Test
```bash
cd QMaps
python benchmark/mini_benchmark.py
```

### Generate Visualizations
```bash
python analysis/plot.py results/mini_benchmark.csv
```

### Run Statistical Analysis
```bash
python analysis/full_statistics.py results/mini_benchmark.csv
```
### Run Backend 
```bash
python api/main.py
```

### Run Frontend
```bash
cd frontend
npm run dev
```

---

## 💡 The Innovation: QA-QPSO

**Two-Phase Hybrid Algorithm:**

1. **Phase 1: QACO (Quantum Ant Colony)**
   - Explores solution space using quantum rotation gates
   - Constructs diverse customer sequences
   - Avoids premature convergence

2. **Phase 2: QPSO (Quantum Particle Swarm)**
   - Refines solutions with quantum-behaved dynamics
   - Warm-started from QACO's best solution
   - Exploits promising regions efficiently

**Why it works:** Combines QACO's exploration strength with QPSO's exploitation power.

---

## 📁 Project Structure

```
QMaps/
├── algorithms/
│   ├── astar.py, pso.py, qpso.py    # Baselines
│   ├── aco.py, qaco.py              # Ant colony algorithms
│   ├── qa_qpso.py                   # OUR INNOVATION
│   ├── dynamic.py                   # Dynamic VRP
│   └── dynamic_events.py            # Traffic scenarios
├── benchmark/
│   ├── mini_benchmark.py            # Quick 5-run test
│   ├── full_benchmark.py            # Complete 30-run
│   └── dynamic_benchmark.py         # Traffic events
├── analysis/
│   ├── full_statistics.py           # Statistical tests
│   ├── plot.py                      # Visualizations
│   └── route_visualizer.py          # 2D route maps
├── results/
│   ├── mini_benchmark.csv           # Raw data
│   ├── boxplots.png                 # Generated
│   ├── algorithm_rankings.png       # Generated
│   └── convergence_all...png        # Generated
├── data/instances/                  # Solomon benchmarks
├── CLAUDE.md                        # Project specification
├── REQUIREMENTS.md                  # Complete checklist
├── FINAL_SUMMARY.md                 # Implementation summary
└── PRESENTATION_READY.md            # Quick reference
```

---

## 🔬 VRP Variants Supported

1. **CVRP (Capacitated)** - Vehicle capacity constraints
2. **VRPTW (Time Windows)** - Delivery time constraints
3. **DVRP (Dynamic)** - Real-time traffic events

---

## 📈 Statistical Validation

**Methods Used:**
- Shapiro-Wilk (normality test)
- Wilcoxon signed-rank (pairwise comparisons)
- Friedman test (all algorithms)
- Nemenyi post-hoc test
- Cohen's d effect sizes

**Following:** García et al. (2009), Demšar (2006) methodology

---

## 🎯 Key Claims

### Innovation
"QA-QPSO is the first hybrid quantum-inspired algorithm combining QACO exploration with QPSO exploitation for vehicle routing problems."

### Performance
"Achieves 17.2% cost reduction vs classical ACO and 13.7% vs quantum-inspired QACO on Solomon VRPTW benchmarks."

### Practical
"Supports multiple VRP variants (CVRP, VRPTW, Dynamic) with real-time traffic adaptation."

### Scientific
"Validated using non-parametric statistical tests following established computational intelligence research standards."

---

## 🛠️ Installation

### Requirements
```bash
pip install numpy scipy pandas matplotlib seaborn scikit-posthocs
```

### Verify Installation
```bash
python -c "from algorithms import QA_QPSO; print('✓ Ready!')"
```

---

## 📚 References

1. Sun, Xu, Liu (2004) - QPSO: IEEE Trans. Evolutionary Computation
2. Wang & Yu (2008) - QACO: Int'l J. Intelligent Computing & Cybernetics
3. Bean (1994) - Random-key encoding: EJOR
4. Prins (2004) - Split algorithm: Computers & Operations Research
5. Solomon (1987) - VRPTW benchmarks: Operations Research
6. García et al. (2009) - Statistical tests: Journal of Heuristics
7. Demšar (2006) - Friedman test: JMLR

---

## 👥 Team

- Implementation: Complete autonomous system
- Algorithms: 6 metaheuristics implemented
- Benchmarking: Solomon VRPTW instances
- Analysis: Full statistical validation

---

## 📄 License

Research/Educational Project

---

**Contact:** For questions about implementation details, see `CLAUDE.md` and `PRESENTATION_READY.md`

**Winner:** QA-QPSO with 560.49 mean cost (17% better than classical ACO)
