"""Dynamic VRP benchmark with traffic events.

Tests algorithm adaptation to real-time traffic changes.
"""

import sys
import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from vrp_loader import load_instance
from algorithms.dynamic import DynamicVRP
from algorithms.dynamic_events import create_scenario, generate_random_events
from algorithms import PSO, QPSO, ACO, QACO, QA_QPSO

# Configuration
INSTANCE_PATH = ROOT / "data" / "instances" / "RC101.csv"
N_CUSTOMERS = 25
MAX_ITER = 300
TIME_LIMIT = 10.0  # Longer for dynamic scenarios
N_RUNS = 5

ALGORITHMS = [
    ("PSO", PSO),
    ("QPSO", QPSO),
    ("ACO", ACO),
    ("QACO", QACO),
    ("QA-QPSO", QA_QPSO),
]

SCENARIOS = ["rush_hour", "road_closure", "accident"]

OUTPUT_DIR = ROOT / "results"


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("=" * 80)
    print("Dynamic VRP Benchmark")
    print("=" * 80)
    print(f"Instance: RC101 ({N_CUSTOMERS} customers)")
    print(f"Scenarios: {', '.join(SCENARIOS)}")
    print(f"Algorithms: {len(ALGORITHMS)}")
    print(f"Runs per scenario: {N_RUNS}")
    print("=" * 80)
    print()

    # Load instance
    instance = load_instance(str(INSTANCE_PATH), n_customers=N_CUSTOMERS)
    print(f"Loaded: {instance}")
    print()

    all_results = []

    for scenario_name in SCENARIOS:
        print(f"\n{'=' * 80}")
        print(f"SCENARIO: {scenario_name}")
        print("=" * 80)

        # Generate traffic events for this scenario
        events = create_scenario(scenario_name, instance)
        print(f"Events: {len(events)}")
        for event in events:
            print(f"  - {event.event_type} at iteration {event.start_iteration}")
        print()

        for algo_name, algo_class in ALGORITHMS:
            print(f"\n{algo_name}")
            print("-" * 60)

            for run_id in range(N_RUNS):
                try:
                    # Run dynamic VRP
                    dynamic_vrp = DynamicVRP(
                        algo_class,
                        instance,
                        events,
                        max_iter=MAX_ITER,
                        time_limit=TIME_LIMIT,
                        seed=run_id,
                    )

                    result = dynamic_vrp.run()

                    # Extract recovery metrics
                    if result['recovery_metrics']:
                        avg_recovery = sum(
                            m['recovery_iterations'] for m in result['recovery_metrics']
                        ) / len(result['recovery_metrics'])

                        avg_spike = sum(
                            m['max_cost_spike'] for m in result['recovery_metrics']
                        ) / len(result['recovery_metrics'])

                        avg_adaptation = sum(
                            m['adaptation_score'] for m in result['recovery_metrics']
                        ) / len(result['recovery_metrics'])
                    else:
                        avg_recovery = 0
                        avg_spike = 0
                        avg_adaptation = 1.0

                    row = {
                        'scenario': scenario_name,
                        'algorithm': algo_name,
                        'run': run_id,
                        'final_cost': result['best_cost'],
                        'total_iterations': result['total_iterations'],
                        'avg_recovery_time': avg_recovery,
                        'avg_cost_spike': avg_spike,
                        'avg_adaptation_score': avg_adaptation,
                        'n_events': len(events),
                    }

                    all_results.append(row)

                    print(
                        f"  Run {run_id + 1}/{N_RUNS} | "
                        f"Cost: {result['best_cost']:.2f} | "
                        f"Recovery: {avg_recovery:.1f} iters | "
                        f"Adaptation: {avg_adaptation:.3f}"
                    )

                    # Save convergence plot
                    if run_id == 0:  # Save first run plot
                        plot_path = (
                            OUTPUT_DIR /
                            f"dynamic_{scenario_name}_{algo_name}.png"
                        )
                        dynamic_vrp.plot_convergence(str(plot_path))

                except Exception as e:
                    print(f"  Run {run_id + 1}/{N_RUNS} | ERROR: {e}")
                    import traceback
                    traceback.print_exc()

    # Save results
    output_file = OUTPUT_DIR / "dynamic_benchmark.csv"

    fieldnames = [
        'scenario',
        'algorithm',
        'run',
        'final_cost',
        'total_iterations',
        'avg_recovery_time',
        'avg_cost_spike',
        'avg_adaptation_score',
        'n_events',
    ]

    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_results)

    print("\n" + "=" * 80)
    print("DYNAMIC BENCHMARK COMPLETE")
    print("=" * 80)
    print(f"Results saved to: {output_file}")

    # Summary statistics
    print("\n" + "=" * 80)
    print("SUMMARY: Average Adaptation Score (lower = better recovery)")
    print("=" * 80)

    for scenario in SCENARIOS:
        print(f"\n{scenario}:")
        for algo_name, _ in ALGORITHMS:
            scenario_results = [
                r for r in all_results
                if r['algorithm'] == algo_name and r['scenario'] == scenario
            ]
            if scenario_results:
                avg_adapt = sum(r['avg_adaptation_score'] for r in scenario_results) / len(scenario_results)
                avg_recovery = sum(r['avg_recovery_time'] for r in scenario_results) / len(scenario_results)
                print(f"  {algo_name:10s} | Adaptation: {avg_adapt:.3f} | Recovery: {avg_recovery:.1f} iters")

    print("\n" + "=" * 80)


if __name__ == "__main__":
    main()
