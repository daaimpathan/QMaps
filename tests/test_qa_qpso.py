"""Quick test of QA-QPSO hybrid algorithm."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from vrp_loader import load_instance
from algorithms.qa_qpso import QA_QPSO

INSTANCE_PATH = ROOT / "data" / "instances" / "RC101.csv"
N_CUSTOMERS = 25

def main():
    print("=" * 70)
    print("QA-QPSO Hybrid Algorithm Test")
    print("=" * 70)

    inst = load_instance(
        str(INSTANCE_PATH),
        n_customers=N_CUSTOMERS,
    )

    print(f"Instance: {inst}")
    print()

    # Test with 3 runs
    for run_id in range(3):
        print(f"\n--- Run {run_id + 1} ---")

        optimizer = QA_QPSO(
            inst,
            max_iter=300,
            time_limit=5.0,
            seed=run_id,
            phase1_ratio=0.4,  # 40% QACO, 60% QPSO
        )

        result = optimizer.optimize()

        print(f"Final Cost: {result['cost']:.4f}")
        print(f"Feasible: {result['feasible']}")
        print(f"Runtime: {result['time']:.4f}s")
        print(f"Iterations to best: {result['iterations_to_best']}")
        print(f"Convergence length: {len(result['convergence'])}")

        # Show phase transition
        phase1_len = int(300 * 0.4)
        if len(result['convergence']) > phase1_len:
            phase1_best = result['convergence'][phase1_len - 1]
            phase2_best = result['convergence'][-1]
            improvement = ((phase1_best - phase2_best) / phase1_best) * 100
            print(f"Phase 1 (QACO) best: {phase1_best:.4f}")
            print(f"Phase 2 (QPSO) best: {phase2_best:.4f}")
            print(f"Improvement: {improvement:.2f}%")

    print("\n" + "=" * 70)
    print("Test complete!")
    print("=" * 70)

if __name__ == "__main__":
    main()
