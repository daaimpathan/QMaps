"""Create RC101 convergence data and a six-panel mean ± SD figure.

Runs the six project algorithms with the benchmark seed convention (0..29),
300 iterations maximum, and a five-second time limit per run. The plot uses
each algorithm's actual logged convergence updates; A* logs search checkpoints
rather than population iterations, which is called out in its panel label.
"""

import argparse
import csv
import json
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from algorithms import AStar, ACO, PSO, QA_QPSO, QACO, QPSO
from vrp_loader import load_instance


INSTANCE_PATH = ROOT / "data" / "instances" / "RC101.csv"
OUTPUT_DIR = ROOT / "results"
OUTPUT_CSV = OUTPUT_DIR / "convergence_rc101_all_6_algorithms.csv"
OUTPUT_PNG = OUTPUT_DIR / "convergence_rc101_all_6_algorithms.png"
N_CUSTOMERS = 25
N_RUNS = 30
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

COLORS = {
    "A*": "#64748b",
    "PSO": "#d97706",
    "QPSO": "#ea580c",
    "ACO": "#2563eb",
    "QACO": "#0f766e",
    "QA-QPSO": "#7c3aed",
}


def _pad_curves(curves):
    """Align histories by each algorithm's logged update index.

    Histories stop at different times. The final best value is carried forward
    after a run stops; leading non-finite values remain missing until that run
    first finds a finite feasible incumbent.
    """
    max_length = max(map(len, curves))
    matrix = np.full((len(curves), max_length), np.nan, dtype=float)
    for row_index, curve in enumerate(curves):
        values = np.asarray(curve, dtype=float)
        finite_indices = np.flatnonzero(np.isfinite(values))
        if finite_indices.size == 0:
            continue
        last_index = int(finite_indices[-1])
        padded_values = values.copy()
        padded_values[~np.isfinite(padded_values)] = np.nan
        matrix[row_index, : len(values)] = padded_values
        matrix[row_index, last_index + 1 :] = values[last_index]
    return matrix


def _mean_and_sd(matrix):
    counts = np.sum(np.isfinite(matrix), axis=0)
    mean = np.full(matrix.shape[1], np.nan, dtype=float)
    sd = np.zeros(matrix.shape[1], dtype=float)
    for index, count in enumerate(counts):
        values = matrix[np.isfinite(matrix[:, index]), index]
        if count:
            mean[index] = float(np.mean(values))
        if count > 1:
            sd[index] = float(np.std(values, ddof=1))
    return mean, sd, counts


def _load_saved_curves():
    if not OUTPUT_CSV.exists():
        raise FileNotFoundError(f"No saved convergence data found at {OUTPUT_CSV}")

    curves_by_algorithm = {name: [] for name, _ in ALGORITHMS}
    feasible_counts = {name: 0 for name, _ in ALGORITHMS}
    with OUTPUT_CSV.open(newline="", encoding="utf-8") as source:
        for row in csv.DictReader(source):
            name = row["algorithm"]
            if name not in curves_by_algorithm or row["feasible"] != "True":
                continue
            cost = float(row["cost"])
            curve = [float(value) for value in json.loads(row["convergence"])]
            if np.isfinite(cost) and curve:
                curves_by_algorithm[name].append(curve)
                feasible_counts[name] += 1
    return curves_by_algorithm, feasible_counts


def _plot_curves(curves_by_algorithm, feasible_counts):
    summaries = {}
    global_upper = 0.0
    for algorithm_name, _ in ALGORITHMS:
        curves = curves_by_algorithm[algorithm_name]
        if not curves:
            raise RuntimeError(f"{algorithm_name} has no feasible RC101 convergence curves.")
        mean, sd, counts = _mean_and_sd(_pad_curves(curves))
        summaries[algorithm_name] = (mean, sd)
        finite_upper = mean + sd
        if np.isfinite(finite_upper).any():
            global_upper = max(global_upper, float(np.nanmax(finite_upper)))

    fig, axes = plt.subplots(2, 3, figsize=(14, 8.5), sharey=True)
    axes = axes.ravel()
    for axis, (algorithm_name, _) in zip(axes, ALGORITHMS):
        mean, sd = summaries[algorithm_name]
        x = np.arange(len(mean))
        color = COLORS[algorithm_name]
        axis.plot(x, mean, color=color, linewidth=2, label="Mean best-so-far cost")
        axis.fill_between(
            x,
            np.maximum(0, mean - sd),
            mean + sd,
            color=color,
            alpha=0.18,
            linewidth=0,
            label="±1 sample SD",
        )
        axis.set_title(
            f"{algorithm_name} · {feasible_counts[algorithm_name]}/{N_RUNS} feasible runs",
            fontsize=11,
            fontweight="bold",
        )
        if algorithm_name == "A*":
            axis.set_xlabel("Logged A* search checkpoints")
        elif algorithm_name == "QA-QPSO":
            axis.set_xlabel("Logged QACO + QPSO phase updates")
        else:
            axis.set_xlabel("Algorithm iteration")
        axis.set_ylabel("Best-so-far route cost")
        axis.grid(True, linestyle="--", alpha=0.28)
        axis.tick_params(labelsize=9)

    # Set a common y-scale after plotting every panel, so early high costs are
    # not clipped by the first subplot's smaller A* range.
    shared_ymax = max(1.0, global_upper * 1.08)
    for axis in axes:
        axis.set_ylim(0, shared_ymax)

    fig.suptitle(
        "RC101 convergence · all six algorithms · 30 fixed seeds",
        fontsize=16,
        fontweight="bold",
        y=0.985,
    )
    handles, labels = axes[0].get_legend_handles_labels()
    fig.legend(handles, labels, loc="upper center", bbox_to_anchor=(0.5, 0.955), ncol=2, frameon=False)
    fig.text(
        0.5,
        0.012,
        "Curves use feasible runs only; stopped runs carry their final best value forward. "
        "A* logs search checkpoints, while metaheuristics log iterations, so x-axis speed is not directly comparable.",
        ha="center",
        va="bottom",
        fontsize=8,
        color="#57534e",
        wrap=True,
    )
    fig.tight_layout(rect=(0.04, 0.05, 0.98, 0.91))
    fig.savefig(OUTPUT_PNG, dpi=300, bbox_inches="tight")
    plt.close(fig)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--plot-only",
        action="store_true",
        help="rebuild the PNG from saved convergence CSV without rerunning experiments",
    )
    args = parser.parse_args()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    if args.plot_only:
        curves_by_algorithm, feasible_counts = _load_saved_curves()
        print(f"Loaded saved convergence histories from {OUTPUT_CSV}", flush=True)
    else:
        instance = load_instance(str(INSTANCE_PATH), n_customers=N_CUSTOMERS)
        print(f"RC101 loaded: {instance}", flush=True)
        print(
            f"Protocol: {N_RUNS} seeds (0–{N_RUNS - 1}), up to {MAX_ITER} iterations "
            f"or {TIME_LIMIT:.1f}s per run.",
            flush=True,
        )

        all_records = []
        curves_by_algorithm = {}
        feasible_counts = {}
        for algorithm_name, algorithm_class in ALGORITHMS:
            print(f"\n{algorithm_name}", flush=True)
            feasible_curves = []
            feasible_count = 0
            for seed in range(N_RUNS):
                optimizer = algorithm_class(
                    instance,
                    max_iter=MAX_ITER,
                    time_limit=TIME_LIMIT,
                    seed=seed,
                )
                result = optimizer.optimize()
                convergence = [float(value) for value in result.get("convergence", [])]
                feasible = bool(result.get("feasible", False))
                cost = float(result.get("cost", np.inf))
                if feasible and np.isfinite(cost) and convergence:
                    feasible_curves.append(convergence)
                    feasible_count += 1
                all_records.append({
                    "instance": "RC101",
                    "n_customers": N_CUSTOMERS,
                    "algorithm": algorithm_name,
                    "run": seed,
                    "cost": cost,
                    "runtime_seconds": float(result.get("time", np.nan)),
                    "iterations_to_best": int(result.get("iterations_to_best", 0)),
                    "feasible": feasible,
                    "convergence_length": len(convergence),
                    "convergence": json.dumps(convergence, separators=(",", ":")),
                })
                print(
                    f"  seed {seed:02d}/{N_RUNS - 1}: cost={cost:.2f}, "
                    f"feasible={feasible}, updates={len(convergence)}",
                    flush=True,
                )

            curves_by_algorithm[algorithm_name] = feasible_curves
            feasible_counts[algorithm_name] = feasible_count
            if not feasible_curves:
                raise RuntimeError(f"{algorithm_name} produced no feasible RC101 convergence curves.")

        with OUTPUT_CSV.open("w", newline="", encoding="utf-8") as output_file:
            fieldnames = [
                "instance", "n_customers", "algorithm", "run", "cost",
                "runtime_seconds", "iterations_to_best", "feasible",
                "convergence_length", "convergence",
            ]
            writer = csv.DictWriter(output_file, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(all_records)

    _plot_curves(curves_by_algorithm, feasible_counts)
    print("\nSaved convergence data and graph:", flush=True)
    print(f"  {OUTPUT_CSV}", flush=True)
    print(f"  {OUTPUT_PNG}", flush=True)
    print("Feasible run counts:", feasible_counts, flush=True)


if __name__ == "__main__":
    main()
