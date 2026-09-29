# Known Issues & Limitations

## Dynamic Traffic Benchmark (Non-Critical)

**Issue:** Road closure events (setting `dist[i,j] = inf`) can make the Prins split fail with `RuntimeError: No capacity-feasible split exists`.

**Root Cause:** The dynamic VRP wrapper modifies the instance's distance matrix in-place. When a critical edge becomes infinite, some customer sequences become impossible to split into feasible routes.

**Impact:** Dynamic traffic benchmark crashes on some scenarios.

**Workaround:** 
1. Use congestion events (slowdown factor) instead of road closures (inf)
2. Catch the exception and return penalty cost instead of crashing
3. Implement soft constraint handling for unreachable customers

**Priority:** LOW - Core static optimization (540-run benchmark) works perfectly. Dynamic traffic is a research extension, not required for the competition.

**Status:** Deferred - Will fix if time permits after frontend is complete.

---

## Other Known Limitations

1. **A* on large instances:** Times out at 5s (expected—it's exponential)
2. **QPSO worse than PSO on some runs:** Parameter tuning could improve this
3. **Instance-specific performance:** QA-QPSO doesn't dominate on C101 (clustered)—ACO wins there

These are expected behaviors, not bugs.
