"""Print paired QPSO/PSO evidence from historical and current run CSVs.

This replaces the obsolete frozen-gbest diagnostic. Current QPSO already
refreshes its global best each generation; conclusions must come from saved,
paired benchmark rows rather than that old code-path assumption.
"""

import csv
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from analysis.paired_stats import wilcoxon_signed_rank


def load_runs(path):
    runs = {}
    with path.open(newline="", encoding="utf-8") as source:
        for row in csv.DictReader(source):
            if row.get("feasible") != "True":
                continue
            runs.setdefault((row["instance"], row["algorithm"]), {})[int(row["run"])] = float(row["cost"])
    return runs


def show_pair(label, runs, instance):
    qpso = runs.get((instance, "QPSO"), {})
    pso = runs.get((instance, "PSO"), {})
    seeds = sorted(set(qpso) & set(pso))
    result = wilcoxon_signed_rank(
        [qpso[seed] for seed in seeds],
        [pso[seed] for seed in seeds],
        "QPSO",
        "PSO",
    )
    if result is None:
        print(f"{label} {instance}: no paired feasible runs")
        return
    print(
        f"{label} {instance}: n={len(seeds)} | "
        f"QPSO={result['mean_1']:.2f} | PSO={result['mean_2']:.2f} | "
        f"gap={result['mean_difference_pct']:+.2f}% | "
        f"Wilcoxon p={result['p_value']:.6g} | d={result['cohens_d']:.2f}"
    )


def main():
    historical_path = ROOT / "results" / "benchmark_full_20260925_160246.csv"
    correction_files = sorted((ROOT / "results").glob("qpso_correction_*.csv"), key=lambda path: path.stat().st_mtime)
    if not historical_path.exists():
        raise FileNotFoundError(historical_path)
    if not correction_files:
        raise FileNotFoundError("No results/qpso_correction_*.csv run file exists yet.")

    historical = load_runs(historical_path)
    current_path = correction_files[-1]
    current = load_runs(current_path)
    print(f"Historical source: {historical_path.name}")
    print(f"Current paired source: {current_path.name}")
    for instance in ("RC201", "C101"):
        show_pair("Historical", historical, instance)
        show_pair("Current", current, instance)


if __name__ == "__main__":
    main()
