"""Mini 5-run benchmark to test the pipeline quickly."""

import csv
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from vrp_loader import load_instance
from algorithms import AStar, PSO, QPSO, ACO, QACO, QA_QPSO

INSTANCE_PATH = ROOT / "data" / "instances" / "RC101.csv"
N_CUSTOMERS = 25
N_RUNS = 5
MAX_ITER = 300
TIME_LIMIT = 5.0

ALGORITHMS = [
    ("A*", AStar),
    ("PSO", PSO),
    ("QPSO", QPSO),
    ("ACO", ACO),
    ("QACO", QACO),
    ("QA-QPSO", QA_QPSO),
]

OUTPUT_DIR = ROOT / "results"

def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("=" * 70)
    print("Mini Benchmark - RC101 (25 customers)")
    print("=" * 70)

    inst = load_instance(str(INSTANCE_PATH), n_customers=N_CUSTOMERS)
    print(f"Instance: {inst}\n")

    all_results = []

    # Use different parameters for larger instances
    n_customers = N_CUSTOMERS
    max_iter = MAX_ITER
    time_limit = TIME_LIMIT

    if n_customers >= 100:
        max_iter = 500
        time_limit = 8.0
    elif n_customers >= 50:
        max_iter = 400
        time_limit = 7.0

    for algo_name, algo_class in ALGORITHMS:
        print(f"{algo_name}:")

        for run_id in range(N_RUNS):
            try:
                optimizer = algo_class(inst, max_iter=max_iter, time_limit=time_limit, seed=run_id)
                result = optimizer.optimize()

                row = {
                    "instance": "RC101",
                    "n_customers": N_CUSTOMERS,
                    "algorithm": algo_name,
                    "run": run_id,
                    "cost": result["cost"],
                    "runtime": result["time"],
                    "iterations_to_best": result["iterations_to_best"],
                    "feasible": result["feasible"],
                }

                all_results.append(row)
                print(f"  Run {run_id+1}: Cost={result['cost']:.2f}, Time={result['time']:.2f}s")

            except Exception as e:
                print(f"  Run {run_id+1}: ERROR - {e}")

        print()

    # Save results
    output_file = OUTPUT_DIR / "mini_benchmark.csv"

    with open(output_file, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(all_results[0].keys()))
        writer.writeheader()
        writer.writerows(all_results)

    print("=" * 70)
    print(f"Results saved to: {output_file}")
    print("=" * 70)

if __name__ == "__main__":
    main()
