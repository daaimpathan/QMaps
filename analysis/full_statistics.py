"""Complete statistical analysis suite for algorithm comparison.

Implements the full protocol from CLAUDE.md:
- Shapiro-Wilk normality test
- Wilcoxon signed-rank (pairwise comparisons)
- Friedman test (all algorithms)
- Nemenyi post-hoc test
- Cohen's d effect size
"""

import json
import csv
import numpy as np
from pathlib import Path


def _json_safe(obj):
    """Recursively convert an object into a JSON-serializable form.

    Handles the two things that break json.dump here:
      - tuple dict keys (e.g. ('QPSO', 'PSO')) -> "QPSO_vs_PSO"
      - numpy scalar types (bool_, int64, float64) -> native Python
    """
    if isinstance(obj, dict):
        safe = {}
        for k, v in obj.items():
            if isinstance(k, tuple):
                k = "_vs_".join(str(part) for part in k)
            else:
                k = str(k)
            safe[k] = _json_safe(v)
        return safe
    if isinstance(obj, (list, tuple)):
        return [_json_safe(v) for v in obj]
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return _json_safe(obj.tolist())
    return obj
from scipy import stats
from scipy.stats import shapiro, wilcoxon, friedmanchisquare
import scikit_posthocs as sp


def load_benchmark_results(csv_path):
    """Load benchmark CSV into structured format.

    Returns:
        dict: {instance: {algorithm: [costs]}}
    """
    results = {}

    with open(csv_path, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            instance = row['instance']
            algorithm = row['algorithm']
            cost = float(row['cost'])
            feasible = row['feasible'] == 'True'

            # Only include feasible solutions
            if not feasible or np.isinf(cost):
                continue

            if instance not in results:
                results[instance] = {}

            if algorithm not in results[instance]:
                results[instance][algorithm] = []

            results[instance][algorithm].append(cost)

    return results


def shapiro_wilk_tests(results):
    """Test normality for each algorithm on each instance.

    Returns:
        dict: {instance: {algorithm: {'statistic': float, 'p_value': float, 'normal': bool}}}
    """
    normality_results = {}

    for instance, algos in results.items():
        normality_results[instance] = {}

        for algo, costs in algos.items():
            if len(costs) < 3:
                continue

            stat, p = shapiro(costs)

            normality_results[instance][algo] = {
                'statistic': float(stat),
                'p_value': float(p),
                'normal': p > 0.05,  # α = 0.05
                'n_samples': len(costs),
            }

    return normality_results


def wilcoxon_pairwise(results, pairs):
    """Pairwise Wilcoxon signed-rank tests.

    Args:
        results: {instance: {algorithm: [costs]}}
        pairs: List of (algo1, algo2) tuples to compare

    Returns:
        dict: {instance: {(algo1, algo2): test_result}}
    """
    wilcoxon_results = {}

    for instance, algos in results.items():
        wilcoxon_results[instance] = {}

        for algo1, algo2 in pairs:
            if algo1 not in algos or algo2 not in algos:
                continue

            costs1 = np.array(algos[algo1])
            costs2 = np.array(algos[algo2])

            # Need same number of runs
            n = min(len(costs1), len(costs2))
            costs1 = costs1[:n]
            costs2 = costs2[:n]

            if n < 3:
                continue

            try:
                stat, p = wilcoxon(costs1, costs2, alternative='two-sided')

                # Cohen's d effect size
                mean1, mean2 = costs1.mean(), costs2.mean()
                std1, std2 = costs1.std(ddof=1), costs2.std(ddof=1)
                pooled_std = np.sqrt(((n - 1) * std1**2 + (n - 1) * std2**2) / (2 * n - 2))
                cohens_d = (mean1 - mean2) / pooled_std if pooled_std > 0 else 0.0

                wilcoxon_results[instance][(algo1, algo2)] = {
                    'statistic': float(stat),
                    'p_value': float(p),
                    'significant': p < 0.05,
                    'mean_1': float(mean1),
                    'mean_2': float(mean2),
                    'cohens_d': float(cohens_d),
                    'better': algo1 if mean1 < mean2 else algo2,
                    'effect_size_interpretation': interpret_effect_size(abs(cohens_d)),
                    'n_samples': n,
                }
            except Exception as e:
                print(f"Wilcoxon test failed for {instance}, {algo1} vs {algo2}: {e}")

    return wilcoxon_results


def interpret_effect_size(d):
    """Cohen's d interpretation (Cohen 1988)."""
    d = abs(d)
    if d < 0.2:
        return "negligible"
    elif d < 0.5:
        return "small"
    elif d < 0.8:
        return "medium"
    else:
        return "large"


def friedman_test(results):
    """Friedman test for all algorithms on each instance.

    Returns:
        dict: {instance: {'statistic': float, 'p_value': float, 'significant': bool}}
    """
    friedman_results = {}

    for instance, algos in results.items():
        # Need at least 3 algorithms
        if len(algos) < 3:
            continue

        # Get common algorithm set and minimum sample size
        algo_names = sorted(algos.keys())
        n_samples = min(len(algos[a]) for a in algo_names)

        if n_samples < 3:
            continue

        # Build data matrix: rows = runs, cols = algorithms
        data = []
        for algo in algo_names:
            data.append(algos[algo][:n_samples])

        try:
            stat, p = friedmanchisquare(*data)

            friedman_results[instance] = {
                'statistic': float(stat),
                'p_value': float(p),
                'significant': p < 0.05,
                'n_samples': n_samples,
                'n_algorithms': len(algo_names),
                'algorithms': algo_names,
            }
        except Exception as e:
            print(f"Friedman test failed for {instance}: {e}")

    return friedman_results


def nemenyi_posthoc(results):
    """Nemenyi post-hoc test after significant Friedman test.

    Returns:
        dict: {instance: p-value matrix}
    """
    nemenyi_results = {}

    for instance, algos in results.items():
        algo_names = sorted(algos.keys())
        n_samples = min(len(algos[a]) for a in algo_names)

        if len(algo_names) < 3 or n_samples < 3:
            continue

        # Build data matrix
        data = []
        for run_id in range(n_samples):
            row = [algos[algo][run_id] for algo in algo_names]
            data.append(row)

        data = np.array(data)

        try:
            # Nemenyi test
            p_values = sp.posthoc_nemenyi_friedman(data)

            nemenyi_results[instance] = {
                'algorithms': algo_names,
                'p_values': p_values.to_dict(),
            }
        except Exception as e:
            print(f"Nemenyi test failed for {instance}: {e}")

    return nemenyi_results


def generate_claims(wilcoxon_results):
    """Generate publication-ready statistical claims."""
    claims = []

    for instance, pairs in wilcoxon_results.items():
        for (algo1, algo2), result in pairs.items():
            if result['significant']:
                better = result['better']
                worse = algo2 if better == algo1 else algo1
                p = result['p_value']
                d = result['cohens_d']
                effect = result['effect_size_interpretation']

                claim = (
                    f"{better} significantly outperforms {worse} on {instance} "
                    f"(mean: {result['mean_1']:.2f} vs {result['mean_2']:.2f}, "
                    f"p={p:.4f}, d={d:.2f}, {effect} effect)"
                )
                claims.append(claim)

    return claims


def main(csv_path):
    """Run complete statistical analysis."""
    print("=" * 80)
    print("Statistical Analysis Suite")
    print("=" * 80)

    # Load data
    print("\nLoading benchmark results...")
    results = load_benchmark_results(csv_path)

    print(f"Loaded {len(results)} instances")
    for instance, algos in results.items():
        print(f"  {instance}: {len(algos)} algorithms, {min(len(c) for c in algos.values())} runs")

    # Test 1: Normality
    print("\n" + "=" * 80)
    print("1. Shapiro-Wilk Normality Tests")
    print("=" * 80)

    normality = shapiro_wilk_tests(results)

    for instance, algos in normality.items():
        print(f"\n{instance}:")
        for algo, result in algos.items():
            status = "normal" if result['normal'] else "non-normal"
            print(f"  {algo:10s}: p={result['p_value']:.4f} ({status})")

    # Test 2: Pairwise comparisons
    print("\n" + "=" * 80)
    print("2. Wilcoxon Signed-Rank Tests (Pairwise)")
    print("=" * 80)

    # Key comparisons per CLAUDE.md
    pairs = [
        ("QPSO", "PSO"),      # Quantum gain #1
        ("QACO", "ACO"),      # Quantum gain #2
        ("QA-QPSO", "QPSO"),  # Hybrid vs QPSO
        ("QA-QPSO", "QACO"),  # Hybrid vs QACO
        ("QA-QPSO", "PSO"),   # Hybrid vs PSO
        ("QA-QPSO", "ACO"),   # Hybrid vs ACO
    ]

    wilcoxon_results = wilcoxon_pairwise(results, pairs)

    for instance, pair_results in wilcoxon_results.items():
        print(f"\n{instance}:")
        for (algo1, algo2), result in pair_results.items():
            sig = "PASS" if result['significant'] else "FAIL"
            print(
                f"  {sig} {algo1} vs {algo2}: "
                f"p={result['p_value']:.4f}, d={result['cohens_d']:.2f} ({result['effect_size_interpretation']})"
            )

    # Test 3: Friedman test
    print("\n" + "=" * 80)
    print("3. Friedman Test (All Algorithms)")
    print("=" * 80)

    friedman_results = friedman_test(results)

    for instance, result in friedman_results.items():
        sig = "significant" if result['significant'] else "not significant"
        print(
            f"{instance}: chi2={result['statistic']:.2f}, "
            f"p={result['p_value']:.4f} ({sig})"
        )

    # Test 4: Nemenyi post-hoc (if Friedman significant)
    print("\n" + "=" * 80)
    print("4. Nemenyi Post-Hoc Test")
    print("=" * 80)

    nemenyi_results = nemenyi_posthoc(results)

    for instance, result in nemenyi_results.items():
        print(f"\n{instance}:")
        print("  (see JSON output for full p-value matrix)")

    # Generate claims
    print("\n" + "=" * 80)
    print("5. Publication-Ready Claims")
    print("=" * 80)

    claims = generate_claims(wilcoxon_results)

    for i, claim in enumerate(claims, 1):
        print(f"\n{i}. {claim}")

    # Save results
    output_dir = Path(csv_path).parent

    with open(output_dir / "normality_tests.json", "w") as f:
        json.dump(_json_safe(normality), f, indent=2)

    with open(output_dir / "wilcoxon_tests.json", "w") as f:
        json.dump(_json_safe(wilcoxon_results), f, indent=2)

    with open(output_dir / "friedman_test.json", "w") as f:
        json.dump(_json_safe(friedman_results), f, indent=2)

    with open(output_dir / "nemenyi_test.json", "w") as f:
        json.dump(_json_safe(nemenyi_results), f, indent=2, default=str)

    with open(output_dir / "statistical_claims.txt", "w") as f:
        for claim in claims:
            f.write(claim + "\n")

    print("\n" + "=" * 80)
    print("Analysis complete!")
    print("=" * 80)
    print(f"Results saved to: {output_dir}")


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python full_statistics.py <benchmark_csv>")
        sys.exit(1)

    main(sys.argv[1])
