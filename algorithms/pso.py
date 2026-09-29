"""Classical Particle Swarm Optimization (Kennedy & Eberhart 1995) for VRP.

Uses random-key encoding: particle position = N reals, argsort -> customer
sequence, Prins split -> feasible routes. Fitness = total route cost.
"""

import numpy as np

from algorithms.base import Optimizer


class PSO(Optimizer):
    name = "PSO"

    def __init__(self, inst, max_iter=300, time_limit=5.0, seed=0,
                 n_particles=30, w=0.7, c1=1.5, c2=1.5):
        super().__init__(inst, max_iter, time_limit, seed)
        self.n_particles = n_particles
        self.w = w
        self.c1 = c1
        self.c2 = c2

    def run(self):
        n = self.inst.n_customers
        rng = self.rng

        # Initialize swarm in [0, 1]^n (random keys are order-only, so [0,1] suffices)
        X = rng.random((self.n_particles, n))
        V = np.zeros_like(X)

        # Evaluate initial swarm
        pbest = X.copy()
        pbest_cost = np.full(self.n_particles, np.inf)
        for i in range(self.n_particles):
            cost, routes, feas = self.evaluate(X[i])
            pbest_cost[i] = cost
            if cost < self.best_cost:
                self.best_cost = cost
                self.best_routes = routes
                self.best_feasible = feas
                self.iterations_to_best = 0
        gbest = pbest[np.argmin(pbest_cost)].copy()
        self.convergence.append(self.best_cost)

        import time
        start = time.perf_counter()

        for it in range(1, self.max_iter + 1):
            if time.perf_counter() - start > self.time_limit:
                break

            r1 = rng.random((self.n_particles, n))
            r2 = rng.random((self.n_particles, n))
            V = (self.w * V
                 + self.c1 * r1 * (pbest - X)
                 + self.c2 * r2 * (gbest - X))
            X = X + V

            # Keep positions bounded in [0, 1]; velocities clamped implicitly
            np.clip(X, 0.0, 1.0, out=X)

            for i in range(self.n_particles):
                cost, routes, feas = self.evaluate(X[i])
                if cost < pbest_cost[i]:
                    pbest_cost[i] = cost
                    pbest[i] = X[i].copy()
                    if cost < self.best_cost:
                        self.best_cost = cost
                        self.best_routes = routes
                        self.best_feasible = feas
                        self.iterations_to_best = it
            # Refresh gbest from the improved pbest each iteration
            gbest = pbest[np.argmin(pbest_cost)].copy()
            self.convergence.append(self.best_cost)
