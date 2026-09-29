"""Advanced plotting for QMaps benchmark results.

Generates publication-quality visualizations:
- Box plots (cost distribution per algorithm)
- Convergence plots with mean±std
- Statistical heatmaps (p-values, effect sizes)
- Critical difference diagrams
"""

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import json


def load_benchmark_csv(csv_path):
    """Load benchmark results from CSV."""
    df = pd.read_csv(csv_path)
    # Filter only feasible solutions
    df = df[df['feasible'] == True]
    df = df[np.isfinite(df['cost'])]
    return df


def plot_boxplots(df, output_path):
    """Generate box plots for cost distribution."""
    instances = df['instance'].unique()
    n_instances = len(instances)

    fig, axes = plt.subplots(1, n_instances, figsize=(6 * n_instances, 6))
    if n_instances == 1:
        axes = [axes]

    for idx, instance in enumerate(instances):
        data = df[df['instance'] == instance]

        # Prepare data for seaborn
        ax = axes[idx]

        sns.boxplot(
            data=data,
            x='algorithm',
            y='cost',
            ax=ax,
            palette='Set2',
            linewidth=1.5,
        )

        ax.set_title(f'{instance}', fontsize=14, fontweight='bold')
        ax.set_xlabel('Algorithm', fontsize=12)
        ax.set_ylabel('Total Cost', fontsize=12)
        ax.grid(True, alpha=0.3, axis='y')
        ax.tick_params(axis='x', rotation=45)

    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"Saved box plots to: {output_path}")


def plot_convergence_comparison(results_dir, output_path):
    """Plot convergence curves from multiple algorithm runs.

    Note: This requires convergence data which isn't in the summary CSV.
    You'd need to save convergence arrays separately.
    """
    # This is a placeholder - convergence data needs to be saved separately
    print("Convergence plotting requires per-run convergence arrays.")
    print("Use convergence_all.py for this visualization.")


def plot_statistical_heatmap(json_path, output_path, metric='p_value'):
    """Generate heatmap of statistical test results.

    Args:
        json_path: Path to wilcoxon_tests.json or effect_sizes.json
        output_path: Where to save the plot
        metric: 'p_value' or 'cohens_d'
    """
    with open(json_path, 'r') as f:
        data = json.load(f)

    # Extract all unique algorithms.
    # Keys are saved by full_statistics._json_safe as "ALGO1_vs_ALGO2".
    all_algos = set()
    for instance, pairs in data.items():
        for pair_str in pairs:
            a1, a2 = pair_str.split("_vs_")
            all_algos.add(a1)
            all_algos.add(a2)

    all_algos = sorted(list(all_algos))
    n_algos = len(all_algos)

    instances = sorted(data.keys())
    n_instances = len(instances)

    fig, axes = plt.subplots(1, n_instances, figsize=(6 * n_instances, 5))
    if n_instances == 1:
        axes = [axes]

    for idx, instance in enumerate(instances):
        # Build matrix
        matrix = np.full((n_algos, n_algos), np.nan)

        pairs = data[instance]
        for pair_str, result in pairs.items():
            a1, a2 = pair_str.split("_vs_")
            i = all_algos.index(a1)
            j = all_algos.index(a2)

            value = result.get(metric, np.nan)
            matrix[i, j] = value
            matrix[j, i] = value  # Symmetric

        # Plot heatmap
        ax = axes[idx]

        if metric == 'p_value':
            cmap = 'RdYlGn_r'  # Red = significant, Green = not
            vmin, vmax = 0, 0.1
            cbar_label = 'p-value'
        else:  # cohens_d
            cmap = 'coolwarm'
            vmin, vmax = -2, 2
            cbar_label = "Cohen's d"

        im = ax.imshow(matrix, cmap=cmap, vmin=vmin, vmax=vmax, aspect='auto')

        ax.set_xticks(range(n_algos))
        ax.set_yticks(range(n_algos))
        ax.set_xticklabels(all_algos, rotation=45, ha='right')
        ax.set_yticklabels(all_algos)
        ax.set_title(f'{instance}', fontsize=14, fontweight='bold')

        # Add text annotations
        for i in range(n_algos):
            for j in range(n_algos):
                if not np.isnan(matrix[i, j]):
                    text = ax.text(
                        j, i, f'{matrix[i, j]:.3f}',
                        ha="center", va="center",
                        color="white" if matrix[i, j] < 0.05 else "black",
                        fontsize=8,
                    )

        plt.colorbar(im, ax=ax, label=cbar_label)

    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"Saved heatmap to: {output_path}")


def plot_runtime_comparison(df, output_path):
    """Bar plot of average runtime per algorithm."""
    instances = df['instance'].unique()
    n_instances = len(instances)

    fig, axes = plt.subplots(1, n_instances, figsize=(6 * n_instances, 5))
    if n_instances == 1:
        axes = [axes]

    for idx, instance in enumerate(instances):
        data = df[df['instance'] == instance]

        # Compute mean runtime per algorithm
        runtime_stats = data.groupby('algorithm')['runtime'].agg(['mean', 'std'])

        ax = axes[idx]

        x = range(len(runtime_stats))
        ax.bar(
            x,
            runtime_stats['mean'],
            yerr=runtime_stats['std'],
            capsize=5,
            alpha=0.7,
            color='steelblue',
        )

        ax.set_xticks(x)
        ax.set_xticklabels(runtime_stats.index, rotation=45, ha='right')
        ax.set_title(f'{instance} - Runtime', fontsize=14, fontweight='bold')
        ax.set_xlabel('Algorithm', fontsize=12)
        ax.set_ylabel('Runtime (seconds)', fontsize=12)
        ax.grid(True, alpha=0.3, axis='y')
        ax.axhline(y=5.0, color='r', linestyle='--', label='Time Limit (5s)')
        ax.legend()

    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"Saved runtime plot to: {output_path}")


def plot_algorithm_rankings(df, output_path):
    """Bar chart showing mean cost ranking for each algorithm across instances."""
    # Compute mean cost per algorithm per instance
    summary = df.groupby(['instance', 'algorithm'])['cost'].mean().reset_index()

    # Pivot for easier plotting
    pivot = summary.pivot(index='algorithm', columns='instance', values='cost')

    # Plot
    fig, ax = plt.subplots(figsize=(10, 6))

    pivot.plot(kind='bar', ax=ax, width=0.8, edgecolor='black')

    ax.set_title('Algorithm Performance Comparison (Mean Cost)', fontsize=16, fontweight='bold')
    ax.set_xlabel('Algorithm', fontsize=13)
    ax.set_ylabel('Mean Total Cost', fontsize=13)
    ax.legend(title='Instance', fontsize=10)
    ax.grid(True, alpha=0.3, axis='y')
    ax.tick_params(axis='x', rotation=45)

    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"Saved rankings plot to: {output_path}")


def main():
    import sys

    if len(sys.argv) < 2:
        print("Usage: python plot.py <benchmark_csv>")
        print("       python plot.py --heatmap <wilcoxon_json>")
        sys.exit(1)

    if sys.argv[1] == "--heatmap":
        if len(sys.argv) < 3:
            print("Usage: python plot.py --heatmap <wilcoxon_json>")
            sys.exit(1)

        json_path = Path(sys.argv[2])
        output_dir = json_path.parent

        plot_statistical_heatmap(
            json_path,
            output_dir / "heatmap_pvalues.png",
            metric='p_value',
        )

        plot_statistical_heatmap(
            json_path,
            output_dir / "heatmap_effect_sizes.png",
            metric='cohens_d',
        )

        return

    csv_path = Path(sys.argv[1])
    output_dir = csv_path.parent

    print("=" * 80)
    print("Generating Visualizations")
    print("=" * 80)

    df = load_benchmark_csv(csv_path)

    print(f"\nLoaded {len(df)} results")
    print(f"Instances: {df['instance'].unique()}")
    print(f"Algorithms: {df['algorithm'].unique()}")

    # Generate all plots
    plot_boxplots(df, output_dir / "boxplots.png")
    plot_runtime_comparison(df, output_dir / "runtime_comparison.png")
    plot_algorithm_rankings(df, output_dir / "algorithm_rankings.png")

    print("\n" + "=" * 80)
    print("Visualizations complete!")
    print("=" * 80)


if __name__ == "__main__":
    main()
