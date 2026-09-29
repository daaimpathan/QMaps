"""Statistical tests for algorithm comparison (García et al. 2009, Demšar 2006)."""

import numpy as np
from scipy.stats import wilcoxon, shapiro, friedmanchisquare


def cohens_d(x, y):
    """Cohen's d effect size: (mean_x - mean_y) / pooled_std."""
    nx, ny = len(x), len(y)
    mean_x, mean_y = np.mean(x), np.mean(y)
    var_x, var_y = np.var(x, ddof=1), np.var(y, ddof=1)
    pooled_std = np.sqrt(((nx - 1) * var_x + (ny - 1) * var_y) / (nx + ny - 2))
    return (mean_x - mean_y) / pooled_std if pooled_std > 0 else 0.0


def compare_two(x, y, name_x="A", name_y="B"):
    """Wilcoxon signed-rank + effect size. Returns dict of test results."""
    x, y = np.asarray(x), np.asarray(y)
    stat, p = wilcoxon(x, y, alternative="two-sided")
    d = cohens_d(x, y)
    # Interpretation: d ~ 0.2 small, 0.5 medium, 0.8 large
    result = {
        "test": "wilcoxon",
        "statistic": stat,
        "p_value": p,
        "cohens_d": d,
        "mean_x": x.mean(),
        "mean_y": y.mean(),
        "better": name_x if x.mean() < y.mean() else name_y,
        "significant": p < 0.05,
    }
    return result


def summarize(result, name_x="A", name_y="B"):
    """Human-readable summary of a two-algorithm comparison."""
    better = result["better"]
    worse = name_y if better == name_x else name_x
    p = result["p_value"]
    d = result["cohens_d"]
    sig = "significantly" if result["significant"] else "not significantly"
    return (f"{better} {sig} outperforms {worse} "
            f"(p={p:.4f}, d={d:.2f})")
