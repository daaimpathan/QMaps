"""Quick 5-run benchmark for QMaps algorithms."""

import csv
import os
import statistics
import sys
from pathlib import Path

# Add QMaps project root to Python import path.
# This is required because this script lives inside benchmark/.
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from vrp_loader import load_instance

from algorithms.pso import PSO
from algorithms.qpso import QPSO
from algorithms.astar import AStar
from algorithms.aco import ACO
from algorithms.qaco import QACO


INSTANCE_PATH = ROOT / "data" / "instances" / "RC101.csv"
N_CUSTOMERS = 25

N_RUNS = 5
MAX_ITER = 300
TIME_LIMIT = 5.0

ALGORITHMS = [
    ("PSO", PSO),
    ("QPSO", QPSO),
    ("A*", AStar),
    ("ACO", ACO),
    ("QACO", QACO),
]

OUTPUT_DIR = ROOT / "results"
OUTPUT_FILE = OUTPUT_DIR / "quick_benchmark_rc101.csv"


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    inst = load_instance(
        str(INSTANCE_PATH),
        n_customers=N_CUSTOMERS,
    )

    rows = []

    print("=" * 70)
    print("QMaps Quick Benchmark")
    print("=" * 70)
    print(f"Instance: RC101 ({N_CUSTOMERS} customers)")
    print(f"Runs per algorithm: {N_RUNS}")
    print(f"Time limit: {TIME_LIMIT}s")
    print("=" * 70)

    for name, algorithm_class in ALGORITHMS:
        print(f"\n{name}")
        print("-" * 50)

        for run_id in range(N_RUNS):
            optimizer = algorithm_class(
                inst,
                max_iter=MAX_ITER,
                time_limit=TIME_LIMIT,
                seed=run_id,
            )

            result = optimizer.optimize()

            row = {
                "algorithm": name,
                "run": run_id,
                "cost": result["cost"],
                "runtime": result["time"],
                "iterations_to_best": result["iterations_to_best"],
                "feasible": result["feasible"],
            }

            rows.append(row)

            print(
                f"Run {run_id + 1}/5 | "
                f"Cost: {result['cost']:.4f} | "
                f"Time: {result['time']:.4f}s | "
                f"Feasible: {result['feasible']}"
            )

    fieldnames = [
        "algorithm",
        "run",
        "cost",
        "runtime",
        "iterations_to_best",
        "feasible",
    ]

    with open(
        OUTPUT_FILE,
        "w",
        newline="",
        encoding="utf-8",
    ) as f:
        writer = csv.DictWriter(
            f,
            fieldnames=fieldnames,
        )
        writer.writeheader()
        writer.writerows(rows)

    print("\n")
    print("=" * 70)
    print("QUICK BENCHMARK SUMMARY")
    print("=" * 70)

    for name, _ in ALGORITHMS:
        algorithm_rows = [
            row for row in rows
            if row["algorithm"] == name
        ]

        costs = [row["cost"] for row in algorithm_rows]
        runtimes = [row["runtime"] for row in algorithm_rows]

        feasible_count = sum(
            1 for row in algorithm_rows
            if row["feasible"]
        )

        print(f"\n{name}")
        print(f"  Mean cost   : {statistics.mean(costs):.4f}")
        print(f"  Best cost   : {min(costs):.4f}")

        if len(costs) > 1:
            print(f"  Std cost    : {statistics.stdev(costs):.4f}")
        else:
            print("  Std cost    : 0.0000")

        print(
            f"  Mean runtime: "
            f"{statistics.mean(runtimes):.4f}s"
        )
        print(
            f"  Feasible    : "
            f"{feasible_count}/{N_RUNS}"
        )

    print("\n" + "=" * 70)
    print(f"Raw results saved to: {OUTPUT_FILE}")
    print("=" * 70)


if __name__ == "__main__":
    main()
