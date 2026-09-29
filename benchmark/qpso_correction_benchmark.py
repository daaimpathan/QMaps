"""Paired 30-seed rebenchmark for the QPSO correction on affected instances."""

import csv
import json
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from algorithms.pso import PSO
from algorithms.qpso import QPSO
from vrp_loader import load_instance


RUNS = 30
MAX_ITER = 300
TIME_LIMIT = 5.0
INSTANCES = (("RC201.csv", 50), ("C101.csv", 100))
ALGORITHMS = (("PSO", PSO), ("QPSO", QPSO))
FIELDS = (
    "instance", "n_customers", "algorithm", "run", "cost", "runtime",
    "iterations_to_best", "feasible", "convergence_length", "convergence",
    "implementation",
)


def main():
    pilot = "--pilot" in sys.argv
    run_count = 5 if pilot else RUNS
    algorithms = (("QPSO", QPSO),) if pilot else ALGORITHMS
    prefix = "qpso_pilot" if pilot else "qpso_correction"
    implementation = "canonical-qpso-unbounded-keys-v2"
    output = ROOT / "results" / f"{prefix}_{datetime.now():%Y%m%d_%H%M%S}.csv"
    output.parent.mkdir(parents=True, exist_ok=True)

    print(f"QPSO{' pilot' if pilot else ' correction'} benchmark: {run_count} seeds × {len(INSTANCES)} instances", flush=True)
    print(f"Budget: {MAX_ITER} iterations or {TIME_LIMIT:.1f}s per run", flush=True)
    print(f"Raw output: {output}", flush=True)

    with output.open("w", newline="", encoding="utf-8") as target:
        writer = csv.DictWriter(target, fieldnames=FIELDS)
        writer.writeheader()
        target.flush()

        for filename, customer_count in INSTANCES:
            instance = load_instance(str(ROOT / "data" / "instances" / filename), n_customers=customer_count)
            instance_name = filename.removesuffix(".csv")
            for run_id in range(run_count):
                for algorithm_name, algorithm_class in algorithms:
                    result = algorithm_class(
                        instance,
                        max_iter=MAX_ITER,
                        time_limit=TIME_LIMIT,
                        seed=run_id,
                    ).optimize()
                    writer.writerow({
                        "instance": instance_name,
                        "n_customers": customer_count,
                        "algorithm": algorithm_name,
                        "run": run_id,
                        "cost": result["cost"],
                        "runtime": result["time"],
                        "iterations_to_best": result["iterations_to_best"],
                        "feasible": result["feasible"],
                        "convergence_length": len(result["convergence"]),
                        "convergence": json.dumps(result["convergence"], separators=(",", ":")),
                        "implementation": implementation,
                    })
                    target.flush()
                    print(
                        f"{instance_name} {algorithm_name} seed {run_id + 1:02}/{run_count}: "
                        f"cost={result['cost']:.2f}, feasible={result['feasible']}, "
                        f"time={result['time']:.2f}s",
                        flush=True,
                    )

    print("Benchmark complete.", flush=True)


if __name__ == "__main__":
    main()
