import numpy as np
import matplotlib.pyplot as plt

from vrp_loader import load_instance

from algorithms.pso import PSO
from algorithms.qpso import QPSO
from algorithms.astar import AStar
from algorithms.aco import ACO
from algorithms.qaco import QACO


INSTANCE = "data/instances/RC101.csv"

N_CUSTOMERS = 25
N_RUNS = 5
MAX_ITER = 300
TIME_LIMIT = 5.0

algorithms = {
    "PSO": PSO,
    "QPSO": QPSO,
    "A*": AStar,
    "ACO": ACO,
    "QACO": QACO,
}


def run_algorithm(algorithm_class, instance, seed):
    optimizer = algorithm_class(
        instance,
        max_iter=MAX_ITER,
        time_limit=TIME_LIMIT,
        seed=seed,
    )

    result = optimizer.optimize()

    return np.asarray(result["convergence"], dtype=float)


def pad_convergence(curves):
    """
    Make all convergence curves the same length.
    If an algorithm stops early because of time limit,
    carry forward its last best-so-far value.
    """
    max_len = max(len(c) for c in curves)

    padded = []

    for curve in curves:
        if len(curve) < max_len:
            curve = np.pad(
                curve,
                (0, max_len - len(curve)),
                mode="edge",
            )

        padded.append(curve)

    return np.asarray(padded)


def main():

    print("Loading RC101...")

    inst = load_instance(
        INSTANCE,
        n_customers=N_CUSTOMERS,
    )

    print(inst)
    print()

    all_results = {}

    for name, algorithm_class in algorithms.items():

        print(f"Running {name}...")

        curves = []

        for run in range(N_RUNS):

            seed = 42 + run

            curve = run_algorithm(
                algorithm_class,
                inst,
                seed,
            )

            curves.append(curve)

            print(
                f"  Run {run + 1}/{N_RUNS} "
                f"| Final Cost: {curve[-1]:.4f}"
            )

        curves = pad_convergence(curves)

        mean_curve = np.mean(curves, axis=0)
        std_curve = np.std(curves, axis=0, ddof=1)

        all_results[name] = (
            mean_curve,
            std_curve,
        )

        print()

    # ---------------------------------------------------------
    # Plot convergence curves
    # ---------------------------------------------------------

    plt.figure(figsize=(13, 7.5))

    for name, (mean_curve, std_curve) in all_results.items():

        iterations = np.arange(len(mean_curve))

        plt.plot(
            iterations,
            mean_curve,
            linewidth=2.5,
            label=name,
        )

        plt.fill_between(
            iterations,
            mean_curve - std_curve,
            mean_curve + std_curve,
            alpha=0.15,
        )

    plt.title(
        "Convergence Curve — RC101 (25 Customers)",
        fontsize=20,
        pad=15,
    )

    plt.xlabel(
        "Iteration",
        fontsize=13,
    )

    plt.ylabel(
        "Best-so-far Total Cost",
        fontsize=13,
    )

    plt.grid(
        True,
        linestyle="--",
        alpha=0.25,
    )

    plt.legend(
        title="Algorithm",
        fontsize=10,
    )

    plt.tight_layout()

    output = "results/convergence_all_algorithms_rc101.png"

    plt.savefig(
        output,
        dpi=240,
        bbox_inches="tight",
    )

    plt.show()

    print()
    print("=" * 60)
    print("CONVERGENCE CURVE GENERATED")
    print("=" * 60)
    print(f"Saved to: {output}")


if __name__ == "__main__":
    main()