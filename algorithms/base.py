"""Base class for all VRP optimizers."""

import time

import numpy as np

from encoding import evaluate


class Optimizer:
    """Abstract base for all six algorithms.

    Subclasses implement run() and must populate:
        self.best_cost, self.best_routes, self.best_feasible,
        self.convergence (list of best-so-far cost per iteration),
        self.iterations_to_best
    """

    name = "base"

    def __init__(self, inst, max_iter=300, time_limit=5.0, seed=0):
        self.inst = inst
        self.max_iter = max_iter
        self.time_limit = time_limit
        self.rng = np.random.default_rng(seed)

        self.best_cost = np.inf
        self.best_routes = None
        self.best_feasible = False
        self.best_position = None  # For hybrid algorithms
        self.convergence = []
        self.iterations_to_best = 0
        self.elapsed = 0.0

    def run(self):
        raise NotImplementedError

    def evaluate(self, position):
        """Vector -> (cost, routes, feasible). Fitness = cost (lower is better)."""
        return evaluate(self.inst, position)

    def _record(self, cost, routes, feasible, iteration, position=None):
        """Track global best + convergence curve."""
        if cost < self.best_cost:
            self.best_cost = cost
            self.best_routes = routes
            self.best_feasible = feasible
            self.iterations_to_best = iteration
            if position is not None:
                self.best_position = position.copy()
        self.convergence.append(self.best_cost)

    def optimize(self):
        """Public entry point per CLAUDE.md contract. Returns the result dict."""
        start = time.perf_counter()
        self.run()
        self.elapsed = time.perf_counter() - start

        return {
            "algorithm": self.name,
            "cost": self.best_cost,
            "best_cost": self.best_cost,
            "routes": self.best_routes,
            "convergence": self.convergence,
            "iterations_to_best": self.iterations_to_best,
            "time": self.elapsed,
            "feasible": self.best_feasible,
        }
