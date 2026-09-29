"""First statistical comparison for the QMaps quick benchmark."""

import csv
import math
import sys
from pathlib import Path

import numpy as np

try:
    from scipy.stats import wilcoxon
except ImportError:
    print("ERROR: scipy is not installed.")
    print("Install it with: python -m pip install scipy")
    sys.exit(1)


ROOT = Path(__file__).resolve().parents[1]
CSV_FILE = ROOT / "results" / "quick_benchmark_rc101.csv"


def load_results():
    if not CSV_FILE.exists():
        raise FileNotFoundError(
            f"Benchmark file not found: {CSV_FILE}\n"
            "Run: python benchmark/quick_benchmark.py"
        )

    results = {}

    with CSV_FILE.open("r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)

        for row in reader:
            algorithm = row["algorithm"]
            results.setdefault(algorithm, []).append(
                float(row["cost"])
            )

    return results


def sample_std(values):
    """Sample standard deviation (ddof=1)."""
    return float(np.std(values, ddof=1))


def cohens_d(a, b):
    """Cohen's d using pooled sample standard deviation."""
    a = np.asarray(a, dtype=float)
    b = np.asarray(b, dtype=float)

    n1 = len(a)
    n2 = len(b)

    s1 = sample_std(a)
    s2 = sample_std(b)

    pooled = math.sqrt(
        (
            (n1 - 1) * s1**2
            + (n2 - 1) * s2**2
        )
        / (n1 + n2 - 2)
    )

    if pooled == 0:
        return 0.0

    return float((np.mean(a) - np.mean(b)) / pooled)


def print_descriptive(name, values):
    print(f"\n{name}")
    print("-" * 50)
    print(f"Mean cost : {np.mean(values):.4f}")
    print(f"Std cost  : {sample_std(values):.4f}")
    print(f"Best cost : {np.min(values):.4f}")
    print(f"Worst cost: {np.max(values):.4f}")


def compare(name_a, name_b, a, b):
    print("\n" + "=" * 70)
    print(f"{name_a} vs {name_b}")
    print("=" * 70)

    print_descriptive(name_a, a)
    print_descriptive(name_b, b)

    result = wilcoxon(
        a,
        b,
        alternative="two-sided",
        method="exact",
    )

    d = cohens_d(a, b)

    print("\nPaired Wilcoxon signed-rank test")
    print(f"Statistic W : {result.statistic:.4f}")
    print(f"p-value     : {result.pvalue:.4f}")

    print("\nEffect size")
    print(f"Cohen's d   : {d:.4f}")

    if result.pvalue < 0.05:
        print(
            "Interpretation: statistically significant "
            "difference at alpha = 0.05."
        )
    else:
        print(
            "Interpretation: not statistically significant "
            "at alpha = 0.05."
        )


def main():
    results = load_results()

    required = ["PSO", "QPSO", "ACO", "QACO"]

    missing = [
        name for name in required
        if name not in results
    ]

    if missing:
        raise RuntimeError(
            "Missing benchmark results for: "
            + ", ".join(missing)
        )

    for name in ["PSO", "QPSO", "A*", "ACO", "QACO"]:
        if name in results:
            print_descriptive(name, results[name])

    compare(
        "PSO",
        "QPSO",
        results["PSO"],
        results["QPSO"],
    )

    compare(
        "ACO",
        "QACO",
        results["ACO"],
        results["QACO"],
    )

    print("\n" + "=" * 70)
    print("FIRST STATISTICAL COMPARISON COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    main()
