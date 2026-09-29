"""Small dependency-free paired statistics used by the benchmark API."""

from __future__ import annotations

import math
from statistics import mean, median, stdev


def wilcoxon_signed_rank(first, second, first_name="QPSO", second_name="PSO"):
    """Return an exact two-sided Wilcoxon signed-rank comparison.

    Zero differences are removed from the signed-rank calculation. The exact
    null distribution is computed by dynamic programming, including tied ranks.
    Cohen's d follows the project's existing pooled-standard-deviation report.
    """
    pairs = [(float(a), float(b)) for a, b in zip(first, second)]
    if not pairs:
        return None

    first_costs = [a for a, _ in pairs]
    second_costs = [b for _, b in pairs]
    differences = [a - b for a, b in pairs]
    nonzero = [(abs(value), value) for value in differences if value != 0.0]

    if len(nonzero) < 1:
        return {
            "statistic": 0.0,
            "p_value": 1.0,
            "significant": False,
            "mean_1": mean(first_costs),
            "mean_2": mean(second_costs),
            "cohens_d": 0.0,
            "better": first_name if mean(first_costs) <= mean(second_costs) else second_name,
            "effect_size_interpretation": "negligible",
            "n_samples": len(pairs),
            "n_nonzero_pairs": 0,
            "mean_difference": mean(differences),
            "mean_difference_pct": 0.0,
            "median_difference": median(differences),
            "wins_1": sum(value < 0 for value in differences),
            "wins_2": sum(value > 0 for value in differences),
            "ties": len(pairs),
        }

    ordered = sorted(enumerate(nonzero), key=lambda item: item[1][0])
    rank2_by_nonzero_index = [0] * len(nonzero)
    cursor = 0
    while cursor < len(ordered):
        end = cursor + 1
        while end < len(ordered) and ordered[end][1][0] == ordered[cursor][1][0]:
            end += 1
        # Average of the 1-based ranks cursor+1 through end, scaled by 2
        # so half-ranks remain integers for the exact distribution.
        doubled_rank = cursor + 1 + end
        for position in range(cursor, end):
            original_index = ordered[position][0]
            rank2_by_nonzero_index[original_index] = doubled_rank
        cursor = end

    positive_rank2 = sum(
        rank2_by_nonzero_index[index]
        for index, (_, difference) in enumerate(nonzero)
        if difference > 0.0
    )

    # All sign assignments are equiprobable under H0. Rank sums are at most
    # n(n+1), so this exact dynamic program is tiny for 30 benchmark runs.
    maximum_rank2 = sum(rank2_by_nonzero_index)
    distribution = [0] * (maximum_rank2 + 1)
    distribution[0] = 1
    reachable = 0
    for rank2 in rank2_by_nonzero_index:
        for rank_sum in range(reachable, -1, -1):
            if distribution[rank_sum]:
                distribution[rank_sum + rank2] += distribution[rank_sum]
        reachable += rank2

    total_assignments = 2 ** len(nonzero)
    lower_tail = sum(distribution[: positive_rank2 + 1])
    upper_tail = sum(distribution[positive_rank2:])
    p_value = min(1.0, 2.0 * min(lower_tail, upper_tail) / total_assignments)

    mean_1 = mean(first_costs)
    mean_2 = mean(second_costs)
    pooled_std = 0.0
    if len(pairs) > 1:
        std_1 = stdev(first_costs)
        std_2 = stdev(second_costs)
        pooled_std = math.sqrt(((len(pairs) - 1) * std_1**2 + (len(pairs) - 1) * std_2**2) / (2 * len(pairs) - 2))
    cohens_d = (mean_1 - mean_2) / pooled_std if pooled_std else 0.0
    magnitude = abs(cohens_d)
    effect = "negligible" if magnitude < 0.2 else "small" if magnitude < 0.5 else "medium" if magnitude < 0.8 else "large"
    mean_difference = mean_1 - mean_2
    return {
        "statistic": min(positive_rank2, maximum_rank2 - positive_rank2) / 2.0,
        "p_value": p_value,
        "significant": p_value < 0.05,
        "mean_1": mean_1,
        "mean_2": mean_2,
        "cohens_d": cohens_d,
        "better": first_name if mean_1 < mean_2 else second_name,
        "effect_size_interpretation": effect,
        "n_samples": len(pairs),
        "n_nonzero_pairs": len(nonzero),
        "mean_difference": mean_difference,
        "mean_difference_pct": mean_difference / mean_2 * 100.0 if mean_2 else 0.0,
        "median_difference": median(differences),
        "wins_1": sum(value < 0 for value in differences),
        "wins_2": sum(value > 0 for value in differences),
        "ties": sum(value == 0 for value in differences),
    }
