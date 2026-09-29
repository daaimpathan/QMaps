"""Quantum-behaved PSO (Sun, Xu, Liu 2004) for random-key VRP encoding.

The implementation uses the canonical QPSO update (no velocity term) and the
project's fixed contraction schedule, beta(t) = 1 - 0.5 * t / max_iter.
Random keys are order-only, so the continuous update remains unbounded rather
than clipping coordinates at [0, 1] and creating ties at the boundaries.
"""

import time

import numpy as np

from algorithms.base import Optimizer


class QPSO(Optimizer):
    name = "QPSO"

    def __init__(self, inst, max_iter=300, time_limit=5.0, seed=0,
                 n_particles=30, beta_initial=0.8):
        super().__init__(inst, max_iter, time_limit, seed)
        self.n_particles = n_particles
        # Kept for callers using the previous constructor. The benchmark uses
        # the documented beta(t)=1-0.5*t/max_iter schedule below.
        self.beta_initial = beta_initial

    def _warm_start(self, seed_position, seed_cost):
        """Initialize particle 0 from a known solution (used by QA-QPSO)."""
        self._warm_start_position = seed_position.copy()
        self._warm_start_cost = seed_cost

    def run(self):
        n = self.inst.n_customers
        rng = self.rng

        if hasattr(self, "_warm_start_position"):
            X = rng.random((self.n_particles, n))
            X[0] = self._warm_start_position.copy()
            for i in range(1, self.n_particles):
                # Keep warm-start diversity independent of particle index.
                X[i] = self._warm_start_position + rng.normal(0.0, 0.1, n)
        else:
            # Independent samples retain population diversity as customer
            # count grows; correlated starts can collapse random-key rankings.
            X = rng.random((self.n_particles, n))

        pbest = X.copy()
        pbest_cost = np.full(self.n_particles, np.inf)

        for i in range(self.n_particles):
            cost, routes, feasible = self.evaluate(X[i])
            pbest_cost[i] = cost
            if cost < self.best_cost:
                self.best_cost = cost
                self.best_routes = routes
                self.best_feasible = feasible
                self.best_position = X[i].copy()
                self.iterations_to_best = 0

        gbest = pbest[np.argmin(pbest_cost)].copy()
        self.convergence.append(self.best_cost)
        start = time.perf_counter()

        for iteration in range(1, self.max_iter + 1):
            if time.perf_counter() - start > self.time_limit:
                break

            beta = 1.0 - 0.5 * iteration / self.max_iter
            mbest = pbest.mean(axis=0)

            phi = rng.random((self.n_particles, n))
            attractor = phi * pbest + (1.0 - phi) * gbest
            u = np.maximum(rng.random((self.n_particles, n)), np.finfo(float).tiny)
            sign = np.where(rng.random((self.n_particles, n)) < 0.5, -1.0, 1.0)
            X = attractor + sign * beta * np.abs(mbest - X) * np.log(1.0 / u)

            # Unbounded random keys are valid; argsort consumes order only.
            # Repair only non-finite values so the decoder always gets real keys.
            X = np.nan_to_num(X, copy=False, nan=0.0, posinf=1e100, neginf=-1e100)

            for i in range(self.n_particles):
                cost, routes, feasible = self.evaluate(X[i])
                if cost < pbest_cost[i]:
                    pbest_cost[i] = cost
                    pbest[i] = X[i].copy()
                    if cost < self.best_cost:
                        self.best_cost = cost
                        self.best_routes = routes
                        self.best_feasible = feasible
                        self.best_position = X[i].copy()
                        self.iterations_to_best = iteration

            # QPSO's global attractor must track each generation's best pbest.
            gbest = pbest[np.argmin(pbest_cost)].copy()
            self.convergence.append(self.best_cost)
