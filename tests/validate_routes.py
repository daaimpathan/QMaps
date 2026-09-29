"""Independent route validator - verifies CVRP/VRPTW constraints.

Runs each algorithm once per instance and INDEPENDENTLY re-checks the
returned routes against the raw instance data (does NOT trust the
optimizer's own feasible flag or encoding.routes_feasible).

Checks:
  1. Every customer served exactly once (no missing, no duplicates)
  2. Capacity: sum(demand) <= Q for each route
  3. Time windows: arrival within [ready, due] for each customer + depot return
  4. Reported cost matches an independent recomputation
"""

import numpy as np
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from vrp_loader import load_instance
from algorithms import AStar, PSO, QPSO, ACO, QACO, QA_QPSO

INSTANCES = [("RC101.csv", 25), ("RC201.csv", 50), ("C101.csv", 100)]
ALGORITHMS = [("A*", AStar), ("PSO", PSO), ("QPSO", QPSO),
              ("ACO", ACO), ("QACO", QACO), ("QA-QPSO", QA_QPSO)]


def independent_check(inst, routes, reported_cost):
    """Re-verify routes against raw instance data. Returns dict of check results."""
    issues = []

    # 1. Customer coverage
    served = [c for r in routes for c in r]
    served_set = set(served)
    expected = set(range(1, inst.n_customers + 1))
    duplicates = len(served) != len(served_set)
    missing = expected - served_set
    extra = served_set - expected
    coverage_ok = not duplicates and not missing and not extra
    if duplicates:
        issues.append("duplicate customers")
    if missing:
        issues.append(f"missing {len(missing)} customers")
    if extra:
        issues.append(f"{len(extra)} invalid customer ids")

    # 2. Capacity
    capacity_ok = True
    for r in routes:
        load = sum(inst.demand[c] for c in r)
        if load > inst.capacity + 1e-6:
            capacity_ok = False
            issues.append(f"capacity exceeded ({load:.1f} > {inst.capacity})")

    # 3. Time windows
    tw_ok = True
    for r in routes:
        t = 0.0
        prev = 0
        for c in r:
            t = max(t + inst.dist[prev, c], inst.ready[c])
            if t > inst.due[c] + 1e-6:
                tw_ok = False
            t += inst.service[c]
            prev = c
        t += inst.dist[prev, 0]
        if t > inst.due[0] + 1e-6:
            tw_ok = False
    if not tw_ok:
        issues.append("time window violated")

    # 4. Cost recomputation (independent)
    recomputed = 0.0
    for r in routes:
        path = [0] + list(r) + [0]
        recomputed += sum(inst.dist[path[i], path[i + 1]] for i in range(len(path) - 1))
    cost_match = abs(recomputed - reported_cost) < 1e-3

    return {
        "coverage_ok": coverage_ok,
        "capacity_ok": capacity_ok,
        "timewindow_ok": tw_ok,
        "cost_match": cost_match,
        "recomputed_cost": recomputed,
        "reported_cost": reported_cost,
        "all_valid": coverage_ok and capacity_ok and tw_ok and cost_match,
        "issues": issues,
    }


def main():
    print("=" * 80)
    print("INDEPENDENT ROUTE VALIDATION (CVRP + VRPTW constraints)")
    print("=" * 80)

    all_valid = True
    summary = []

    for inst_file, n_cust in INSTANCES:
        inst_path = ROOT / "data" / "instances" / inst_file
        inst = load_instance(str(inst_path), n_customers=n_cust)
        inst_name = inst_file.replace(".csv", "")

        print(f"\n{inst_name} ({n_cust} customers, Q={inst.capacity:.0f}, "
              f"depot due={inst.due[0]:.0f})")
        print("-" * 80)

        for algo_name, algo_cls in ALGORITHMS:
            opt = algo_cls(inst, max_iter=100, time_limit=3.0, seed=0)
            result = opt.optimize()
            routes = result["routes"] or []

            check = independent_check(inst, routes, result["cost"])
            all_valid = all_valid and check["all_valid"]

            status = "PASS" if check["all_valid"] else "FAIL"
            flags = (
                f"cover={'Y' if check['coverage_ok'] else 'N'} "
                f"cap={'Y' if check['capacity_ok'] else 'N'} "
                f"tw={'Y' if check['timewindow_ok'] else 'N'} "
                f"cost={'Y' if check['cost_match'] else 'N'}"
            )
            issue_str = f" | {'; '.join(check['issues'])}" if check["issues"] else ""
            print(f"  [{status}] {algo_name:8s} | {len(routes)} routes | "
                  f"cost={result['cost']:8.2f} | {flags}{issue_str}")

            summary.append((inst_name, algo_name, check["all_valid"]))

    print("\n" + "=" * 80)
    n_pass = sum(1 for _, _, v in summary if v)
    print(f"RESULT: {n_pass}/{len(summary)} algorithm/instance combos produce valid routes")
    if all_valid:
        print("All algorithms produce constraint-compliant routes under CVRP + VRPTW.")
    else:
        print("WARNING: Some combinations produced invalid routes (see FAIL above).")
    print("=" * 80)
    return 0 if all_valid else 1


if __name__ == "__main__":
    sys.exit(main())