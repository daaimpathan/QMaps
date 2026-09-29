"""Full 30-run benchmark for all algorithms on multiple instances.

This is the core benchmarking script for statistical analysis.
Runs 30 independent runs per algorithm per instance.
"""

import csv
import json
import os
import sys
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from vrp_loader import load_instance
from algorithms import AStar, PSO, QPSO, ACO, QACO, QA_QPSO


# Benchmark configuration
N_RUNS = 30
MAX_ITER = 300
TIME_LIMIT = 5.0

# Instance configurations: (filename, n_customers)
INSTANCES = [
    ("RC101.csv", 25),
    ("RC201.csv", 50),
    ("C101.csv", 100),
]

# All 6 algorithms
ALGORITHMS = [
    ("A*", AStar),
    ("PSO", PSO),
    ("QPSO", QPSO),
    ("ACO", ACO),
    ("QACO", QACO),
    ("QA-QPSO", QA_QPSO),
]

OUTPUT_DIR = ROOT / "results"


def run_single(algorithm_class, instance, run_id):
    """Run one algorithm once and return results."""
    optimizer = algorithm_class(
        instance,
        max_iter=MAX_ITER,
        time_limit=TIME_LIMIT,
        seed=run_id,  # Fixed seed convention
    )

    result = optimizer.optimize()

    return {
        "cost": result["cost"],
        "runtime": result["time"],
        "iterations_to_best": result["iterations_to_best"],
        "feasible": result["feasible"],
        "convergence_length": len(result["convergence"]),
        # Keep the actual per-iteration history so the 30-run benchmark can
        # reproduce convergence plots; the length alone is not sufficient.
        "convergence": [float(cost) for cost in result["convergence"]],
    }


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    print("=" * 80)
    print("QMaps Full Benchmark Suite")
    print("=" * 80)
    print(f"Runs per algorithm: {N_RUNS}")
    print(f"Max iterations: {MAX_ITER}")
    print(f"Time limit: {TIME_LIMIT}s")
    print(f"Total experiments: {len(INSTANCES)} instances × {len(ALGORITHMS)} algorithms × {N_RUNS} runs")
    print(f"Estimated time: ~{len(INSTANCES) * len(ALGORITHMS) * N_RUNS * TIME_LIMIT / 60:.1f} minutes")
    print("=" * 80)
    print()

    all_results = []

    for inst_file, n_customers in INSTANCES:
        print(f"\n{'=' * 80}")
        print(f"INSTANCE: {inst_file} ({n_customers} customers)")
        print("=" * 80)

        inst_path = ROOT / "data" / "instances" / inst_file
        inst = load_instance(str(inst_path), n_customers=n_customers)

        print(f"Loaded: {inst}")
        print()

        for algo_name, algo_class in ALGORITHMS:
            print(f"\n{algo_name}")
            print("-" * 60)

            for run_id in range(N_RUNS):
                try:
                    result = run_single(algo_class, inst, run_id)

                    row = {
                        "instance": inst_file.replace(".csv", ""),
                        "n_customers": n_customers,
                        "algorithm": algo_name,
                        "run": run_id,
                        "cost": result["cost"],
                        "runtime": result["runtime"],
                        "iterations_to_best": result["iterations_to_best"],
                        "feasible": result["feasible"],
                        "convergence_length": result["convergence_length"],
                        "convergence": json.dumps(result["convergence"], separators=(",", ":")),
                    }

                    all_results.append(row)

                    if (run_id + 1) % 5 == 0:
                        print(
                            f"  Run {run_id + 1:2d}/{N_RUNS} | "
                            f"Cost: {result['cost']:8.2f} | "
                            f"Time: {result['runtime']:.2f}s | "
                            f"Feasible: {result['feasible']}"
                        )

                except Exception as e:
                    print(f"  Run {run_id + 1:2d}/{N_RUNS} | ERROR: {e}")
                    # Record failure
                    row = {
                        "instance": inst_file.replace(".csv", ""),
                        "n_customers": n_customers,
                        "algorithm": algo_name,
                        "run": run_id,
                        "cost": float('inf'),
                        "runtime": 0.0,
                        "iterations_to_best": 0,
                        "feasible": False,
                        "convergence_length": 0,
                        "convergence": "[]",
                    }
                    all_results.append(row)

            # Summary for this algorithm
            algo_results = [
                r for r in all_results
                if r["algorithm"] == algo_name and r["instance"] == inst_file.replace(".csv", "")
            ]

            feasible_results = [r for r in algo_results if r["feasible"]]

            if feasible_results:
                costs = [r["cost"] for r in feasible_results]
                print(f"\n  Summary:")
                print(f"    Mean cost: {sum(costs) / len(costs):.2f}")
                print(f"    Best cost: {min(costs):.2f}")
                print(f"    Worst cost: {max(costs):.2f}")
                print(f"    Feasible runs: {len(feasible_results)}/{N_RUNS}")
            else:
                print(f"\n  Summary: No feasible solutions found")

    # Save raw results
    output_file = OUTPUT_DIR / f"benchmark_full_{timestamp}.csv"

    fieldnames = [
        "instance",
        "n_customers",
        "algorithm",
        "run",
        "cost",
        "runtime",
        "iterations_to_best",
        "feasible",
        "convergence_length",
        "convergence",
    ]

    with open(output_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_results)

    print("\n" + "=" * 80)
    print("BENCHMARK COMPLETE")
    print("=" * 80)
    print(f"Raw results saved to: {output_file}")
    print(f"Total experiments completed: {len(all_results)}")
    print("=" * 80)

    # Create summary statistics
    print("\n" + "=" * 80)
    print("SUMMARY STATISTICS")
    print("=" * 80)

    for inst_file, n_customers in INSTANCES:
        print(f"\n{inst_file.replace('.csv', '')} ({n_customers} customers)")
        print("-" * 60)

        for algo_name, _ in ALGORITHMS:
            algo_results = [
                r for r in all_results
                if r["algorithm"] == algo_name and r["instance"] == inst_file.replace(".csv", "")
            ]

            feasible_results = [r for r in algo_results if r["feasible"]]

            if feasible_results:
                costs = [r["cost"] for r in feasible_results]
                mean_cost = sum(costs) / len(costs)
                best_cost = min(costs)

                print(f"  {algo_name:10s} | Mean: {mean_cost:8.2f} | Best: {best_cost:8.2f} | Feasible: {len(feasible_results)}/{N_RUNS}")
            else:
                print(f"  {algo_name:10s} | No feasible solutions")

    print("\n" + "=" * 80)


if __name__ == "__main__":
    main()
