"""Dynamic traffic events for VRP simulation.

Traffic events modify edge costs during optimization to simulate
real-world dynamic conditions like road closures, accidents, and congestion.
"""

import numpy as np
from dataclasses import dataclass
from typing import Literal


@dataclass
class TrafficEvent:
    """A dynamic traffic event that changes edge costs.

    Attributes:
        event_type: Type of event ("road_closure", "congestion", "accident")
        edge: Tuple (from_node, to_node) affected
        start_iteration: When the event begins
        duration: How many iterations it lasts (or None for permanent)
        severity: Impact factor (0.0-1.0 for congestion, inf for closure)
    """

    event_type: Literal["road_closure", "congestion", "accident"]
    edge: tuple[int, int]
    start_iteration: int
    duration: int | None
    severity: float

    def is_active(self, iteration: int) -> bool:
        """Check if event is active at given iteration."""
        if iteration < self.start_iteration:
            return False
        if self.duration is None:
            return True
        return iteration < self.start_iteration + self.duration

    def apply(self, distance_matrix: np.ndarray) -> np.ndarray:
        """Apply event to distance matrix (returns modified copy)."""
        dist = distance_matrix.copy()
        i, j = self.edge

        if self.event_type == "road_closure":
            # Infinite cost = road unusable
            dist[i, j] = np.inf
            dist[j, i] = np.inf
        elif self.event_type in ("congestion", "accident"):
            # Multiply cost by severity factor
            dist[i, j] *= (1.0 + self.severity)
            dist[j, i] *= (1.0 + self.severity)

        return dist


def generate_random_events(
    instance,
    n_events: int = 3,
    start_window: tuple[int, int] = (100, 150),
    duration_range: tuple[int, int] = (50, 100),
    seed: int = 42,
) -> list[TrafficEvent]:
    """Generate random traffic events for an instance.

    Args:
        instance: VRPInstance
        n_events: Number of events to generate
        start_window: (min_iter, max_iter) when events can start
        duration_range: (min_dur, max_dur) event duration
        seed: Random seed for reproducibility

    Returns:
        List of TrafficEvent objects
    """
    rng = np.random.default_rng(seed)
    n = instance.n_customers
    events = []

    for _ in range(n_events):
        # Pick random edge
        i = rng.integers(0, n + 1)
        j = rng.integers(0, n + 1)
        while i == j:
            j = rng.integers(0, n + 1)

        # Random event type
        event_type = rng.choice(["road_closure", "congestion", "accident"])

        # Random timing
        start = rng.integers(start_window[0], start_window[1] + 1)
        duration = rng.integers(duration_range[0], duration_range[1] + 1)

        # Severity based on type
        if event_type == "road_closure":
            severity = np.inf
        elif event_type == "congestion":
            severity = rng.uniform(0.3, 0.8)  # 30-80% slowdown
        else:  # accident
            severity = rng.uniform(0.5, 1.5)  # 50-150% delay

        events.append(
            TrafficEvent(
                event_type=event_type,
                edge=(i, j),
                start_iteration=start,
                duration=duration,
                severity=severity,
            )
        )

    return events


def create_scenario(
    name: str,
    instance,
) -> list[TrafficEvent]:
    """Create a predefined traffic scenario.

    Args:
        name: Scenario name ("rush_hour", "accident", "road_work")
        instance: VRPInstance

    Returns:
        List of TrafficEvent objects
    """
    n = instance.n_customers

    if name == "rush_hour":
        # Multiple congestion events at common routes
        return [
            TrafficEvent("congestion", (0, 1), 100, 100, 0.5),
            TrafficEvent("congestion", (0, 2), 100, 100, 0.5),
            TrafficEvent("congestion", (1, 2), 100, 100, 0.4),
        ]

    elif name == "road_closure":
        # Single road closure forcing re-routing
        return [
            TrafficEvent("road_closure", (0, 1), 100, None, np.inf),
        ]

    elif name == "accident":
        # Sudden severe congestion, then gradual clearance
        return [
            TrafficEvent("accident", (1, 2), 120, 50, 1.2),
            TrafficEvent("congestion", (1, 2), 170, 50, 0.3),
        ]

    elif name == "multi_incident":
        # Multiple overlapping events
        return [
            TrafficEvent("road_closure", (0, 1), 80, 150, np.inf),
            TrafficEvent("accident", (2, 3), 120, 60, 0.9),
            TrafficEvent("congestion", (4, 5), 150, 100, 0.6),
        ]

    else:
        raise ValueError(f"Unknown scenario: {name}")


# Predefined scenarios for benchmarking
BENCHMARK_SCENARIOS = {
    "rush_hour": "Morning rush hour congestion on depot routes",
    "road_closure": "Major road closure requiring re-routing",
    "accident": "Traffic accident with gradual clearance",
    "multi_incident": "Multiple simultaneous incidents",
}
