"""Dynamic VRP optimization with real-time traffic events.

Wraps any static optimizer to handle dynamic traffic conditions.
"""

import time
import numpy as np
from copy import deepcopy

from algorithms.dynamic_events import TrafficEvent


class DynamicVRP:
    """Wrapper for running static optimizers with dynamic traffic events.

    The algorithm runs normally, but at specified iterations, traffic events
    are injected that modify the distance matrix. The optimizer must adapt
    its solution to the new conditions.

    Metrics tracked:
    - Recovery time: iterations to return to pre-event quality
    - Cost spike: maximum cost increase after event
    - Adaptation score: final_cost / pre_event_cost
    """

    def __init__(
        self,
        optimizer_class,
        instance,
        events: list[TrafficEvent],
        max_iter: int = 300,
        time_limit: float = 10.0,
        seed: int = 0,
        **optimizer_kwargs,
    ):
        """
        Args:
            optimizer_class: Algorithm class (PSO, QPSO, ACO, etc.)
            instance: VRPInstance
            events: List of TrafficEvent objects
            max_iter: Maximum iterations
            time_limit: Time limit in seconds
            seed: Random seed
            **optimizer_kwargs: Additional args for optimizer
        """
        self.optimizer_class = optimizer_class
        self.base_instance = instance
        self.events = sorted(events, key=lambda e: e.start_iteration)
        self.max_iter = max_iter
        self.time_limit = time_limit
        self.seed = seed
        self.optimizer_kwargs = optimizer_kwargs

        # Tracking
        self.convergence = []
        self.event_times = []  # When each event triggered
        self.recovery_metrics = []

    def run(self):
        """Run optimization with dynamic events."""
        start = time.perf_counter()

        # Create optimizer with base instance
        instance = deepcopy(self.base_instance)
        optimizer = self.optimizer_class(
            instance,
            max_iter=self.max_iter,
            time_limit=self.time_limit,
            seed=self.seed,
            **self.optimizer_kwargs,
        )

        # We need to run the optimizer in a custom loop to inject events
        # This is a simplified version - real implementation would need
        # to modify the optimizer's run() method

        # For now, we'll run in phases between events
        current_iter = 0
        event_idx = 0

        best_cost = np.inf
        best_routes = None
        best_feasible = False

        # Run initial phase until first event
        if self.events and self.events[0].start_iteration > 0:
            phase_iters = self.events[0].start_iteration
        else:
            phase_iters = self.max_iter

        # Initial optimization phase
        optimizer.max_iter = phase_iters
        result = optimizer.optimize()

        self.convergence.extend(result["convergence"])
        best_cost = result["cost"]
        best_routes = result["routes"]
        best_feasible = result["feasible"]

        current_iter = len(result["convergence"])

        # Process events
        for event in self.events:
            if current_iter >= self.max_iter:
                break

            if time.perf_counter() - start >= self.time_limit:
                break

            # Wait until event start
            if event.start_iteration > current_iter:
                # Continue optimization until event
                remaining = event.start_iteration - current_iter
                optimizer.max_iter = remaining
                result = optimizer.optimize()
                self.convergence.extend(result["convergence"])
                current_iter += len(result["convergence"])

            # Apply event
            self.event_times.append(current_iter)
            pre_event_cost = self.convergence[-1] if self.convergence else np.inf

            # Modify instance distance matrix
            if event.is_active(current_iter):
                instance.dist = event.apply(instance.dist)

            # Re-optimize after event
            remaining_iters = self.max_iter - current_iter
            if remaining_iters > 0:
                optimizer = self.optimizer_class(
                    instance,
                    max_iter=remaining_iters,
                    time_limit=self.time_limit - (time.perf_counter() - start),
                    seed=self.seed + current_iter,
                    **self.optimizer_kwargs,
                )
                result = optimizer.optimize()
                self.convergence.extend(result["convergence"])

                # Track recovery
                post_event_costs = result["convergence"]
                if post_event_costs:
                    max_spike = max(post_event_costs) - pre_event_cost
                    final_cost = post_event_costs[-1]
                    adaptation = final_cost / pre_event_cost if pre_event_cost > 0 else 1.0

                    # Find recovery point (when cost returns to pre-event level)
                    recovery_iters = 0
                    for i, cost in enumerate(post_event_costs):
                        if cost <= pre_event_cost * 1.05:  # Within 5% of pre-event
                            recovery_iters = i
                            break
                    else:
                        recovery_iters = len(post_event_costs)

                    self.recovery_metrics.append({
                        "event_type": event.event_type,
                        "event_iter": current_iter,
                        "pre_event_cost": pre_event_cost,
                        "max_cost_spike": max_spike,
                        "recovery_iterations": recovery_iters,
                        "adaptation_score": adaptation,
                        "final_cost": final_cost,
                    })

                current_iter += len(result["convergence"])

        return {
            "convergence": self.convergence,
            "event_times": self.event_times,
            "recovery_metrics": self.recovery_metrics,
            "best_cost": self.convergence[-1] if self.convergence else np.inf,
            "total_iterations": len(self.convergence),
        }

    def plot_convergence(self, output_path: str):
        """Plot convergence curve with event markers."""
        import matplotlib.pyplot as plt

        plt.figure(figsize=(12, 6))

        iterations = np.arange(len(self.convergence))
        plt.plot(iterations, self.convergence, linewidth=2, label="Cost")

        # Mark events
        for i, event_iter in enumerate(self.event_times):
            if i < len(self.recovery_metrics):
                event_type = self.recovery_metrics[i]["event_type"]
                plt.axvline(
                    event_iter,
                    color="red",
                    linestyle="--",
                    alpha=0.7,
                    label=f"Event: {event_type}" if i == 0 else "",
                )

        plt.xlabel("Iteration", fontsize=12)
        plt.ylabel("Best Cost", fontsize=12)
        plt.title("Dynamic VRP: Cost vs Iteration with Traffic Events", fontsize=14)
        plt.grid(True, alpha=0.3)
        plt.legend()
        plt.tight_layout()
        plt.savefig(output_path, dpi=200)
        plt.close()

        print(f"Saved convergence plot to: {output_path}")
