"""QA-QPSO Hybrid: QACO (Phase 1) → QPSO (Phase 2).

This is the primary innovation of the QMaps project.

Phase 1: QACO constructs initial customer sequences using quantum rotation.
         Output: best permutation → warm start for Phase 2.

Phase 2: QPSO refines the solution with quantum-behaved particle movement.
         Particles initialized around QACO's best solution.

Expected improvement: 5-15% over standalone QACO or QPSO.
"""

import time

import numpy as np

from algorithms.base import Optimizer
from algorithms.qaco import QACO
from algorithms.qpso import QPSO


class QA_QPSO(Optimizer):
    """Hybrid Quantum Ant Colony → Quantum Particle Swarm Optimization.

    The key insight: QACO excels at exploration (constructing good sequences),
    while QPSO excels at exploitation (refining continuous positions).

    By combining them:
    - QACO quickly finds promising regions of the search space
    - QPSO fine-tunes the solution with quantum dynamics
    """

    name = "QA-QPSO"

    def __init__(
        self,
        inst,
        max_iter=300,
        time_limit=5.0,
        seed=0,
        # Phase allocation (ratio of iterations for QACO)
        phase1_ratio=0.4,
        # QACO params
        n_ants=20,
        alpha=1.0,
        beta=5.0,
        theta_initial=np.pi / 4,
        # QPSO params
        n_particles=30,
        beta_initial=0.8,
    ):
        super().__init__(
            inst,
            max_iter,
            time_limit,
            seed,
        )

        self.seed = seed  # Store seed for Phase 2
        self.phase1_ratio = phase1_ratio
        self.n_ants = n_ants
        self.alpha = alpha
        self.beta = beta
        self.theta_initial = theta_initial
        self.n_particles = n_particles
        self.beta_initial = beta_initial

    def run(self):
        n = self.inst.n_customers

        if n <= 0:
            raise ValueError(
                "QA-QPSO requires at least one customer."
            )

        self._start_time = time.perf_counter()

        # =========================================================
        # PHASE 1: QACO for initial solution construction
        # =========================================================

        phase1_iter = max(
            1,
            int(self.max_iter * self.phase1_ratio),
        )

        qaco = QACO(
            self.inst,
            max_iter=phase1_iter,
            time_limit=self.time_limit * self.phase1_ratio,
            seed=self.seed,
            n_ants=self.n_ants,
            alpha=self.alpha,
            beta=self.beta,
            theta_initial=self.theta_initial,
        )

        # Run QACO and get warm start
        qaco_result = qaco.optimize()

        qaco_best_position = qaco.best_position
        qaco_best_cost = qaco.best_cost
        qaco_best_routes = qaco.best_routes

        phase1_time = time.perf_counter() - self._start_time

        # Record QACO convergence
        self.convergence.extend(
            qaco_result["convergence"]
        )

        if qaco_best_cost < self.best_cost:
            self.best_cost = qaco_best_cost
            self.best_routes = qaco_best_routes
            self.best_feasible = qaco_result["feasible"]
            self.iterations_to_best = len(self.convergence)

        # =========================================================
        # PHASE 2: QPSO refinement with warm start
        # =========================================================

        phase2_iter = self.max_iter - phase1_iter
        remaining_time = self.time_limit - phase1_time

        if phase2_iter <= 0 or remaining_time <= 0.1:
            # No time for Phase 2
            return

        # Adaptive parameters for Phase 2 based on instance size
        n_customers = self.inst.n_customers
        qpso_particles = self.n_particles
        qpso_beta = self.beta_initial

        if n_customers > 50:
            # Larger instances need more exploration in QPSO phase
            qpso_particles = self.n_particles + 10
            qpso_beta = min(1.0, self.beta_initial + 0.1)

        qpso = QPSO(
            self.inst,
            max_iter=phase2_iter,
            time_limit=remaining_time,
            seed=self.seed + 1000,  # Different seed for Phase 2
            n_particles=qpso_particles,
            beta_initial=qpso_beta,
        )

        # Warm start when QACO produced a finite candidate. If every QACO
        # construction was infeasible (for example, fleet capacity is too
        # restrictive), let QPSO initialize its own random-key population.
        # Passing None to _warm_start used to crash here with AttributeError.
        if qaco_best_position is not None and np.isfinite(qaco_best_cost):
            qpso._warm_start(qaco_best_position, qaco_best_cost)

        # Run QPSO refinement
        qpso_result = qpso.optimize()

        # Record QPSO convergence
        for i, cost in enumerate(qpso_result["convergence"]):
            self.convergence.append(cost)

            # Update global best if QPSO found better
            if cost < self.best_cost:
                self.best_cost = cost
                self.best_routes = qpso.best_routes
                self.best_feasible = qpso_result["feasible"]
                self.iterations_to_best = len(self.convergence)

    def optimize(self):
        """Run hybrid optimization and return results dict."""
        self.run()

        return {
            "cost": self.best_cost,
            "best_cost": self.best_cost,
            "routes": self.best_routes,
            "convergence": self.convergence,
            "iterations_to_best": self.iterations_to_best,
            "time": time.perf_counter() - getattr(self, '_start_time', time.perf_counter()),
            "feasible": self.best_feasible,
        }
