"""Classical Ant Colony Optimization for Solomon VRPTW.

Ants construct customer permutations using pheromone trails and
distance-based heuristic information.

The generated permutation is converted to the common random-key
representation and evaluated using the existing Prins split
implementation.

Pipeline:

    Pheromone + heuristic
            ↓
    Ant constructs permutation
            ↓
    Random-key conversion
            ↓
    Prins split
            ↓
    CVRPTW routes
            ↓
    Total distance
"""

import time

import numpy as np

from algorithms.base import Optimizer


class ACO(Optimizer):
    name = "ACO"

    def __init__(
        self,
        inst,
        max_iter=300,
        time_limit=5.0,
        seed=0,
        n_ants=30,
        alpha=1.0,
        beta=3.0,
        rho=0.5,
        q=1.0,
    ):
        super().__init__(
            inst,
            max_iter,
            time_limit,
            seed,
        )

        self.n_ants = n_ants
        self.alpha = alpha
        self.beta = beta
        self.rho = rho
        self.q = q

    def _construct_solution(
        self,
        pheromone,
        heuristic,
    ):
        """Construct one complete customer permutation."""

        n = self.inst.n_customers
        rng = self.rng

        unvisited = set(
            range(1, n + 1)
        )

        sequence = []

        current = 0

        while unvisited:

            candidates = np.array(
                list(unvisited),
                dtype=int,
            )

            tau = pheromone[
                current,
                candidates,
            ]

            eta = heuristic[
                current,
                candidates,
            ]

            # ACO transition rule:
            #
            # probability ∝
            # pheromone^alpha × heuristic^beta

            weights = (
                np.power(tau, self.alpha)
                * np.power(eta, self.beta)
            )

            # Numerical safety
            weights = np.nan_to_num(
                weights,
                nan=0.0,
                posinf=0.0,
                neginf=0.0,
            )

            total = weights.sum()

            if total <= 0.0:
                probabilities = np.full(
                    len(candidates),
                    1.0 / len(candidates),
                )
            else:
                probabilities = (
                    weights / total
                )

            next_customer = int(
                rng.choice(
                    candidates,
                    p=probabilities,
                )
            )

            sequence.append(
                next_customer
            )

            unvisited.remove(
                next_customer
            )

            current = next_customer

        return sequence

    def _sequence_to_position(
        self,
        sequence,
    ):
        """Convert permutation to random-key vector."""

        n = self.inst.n_customers

        position = np.empty(
            n,
            dtype=float,
        )

        for rank, customer in enumerate(sequence):
            position[customer - 1] = (
                rank / max(n, 1)
            )

        return position

    def _deposit_pheromone(
        self,
        pheromone,
        sequence,
        cost,
    ):
        """Deposit pheromone along an ant's sequence."""

        if not np.isfinite(cost):
            return

        if cost <= 0:
            return

        deposit = self.q / cost

        # Depot → first customer
        pheromone[
            0,
            sequence[0],
        ] += deposit

        # Customer → customer
        for i in range(
            len(sequence) - 1
        ):
            a = sequence[i]
            b = sequence[i + 1]

            pheromone[a, b] += deposit

        # Last customer → depot
        pheromone[
            sequence[-1],
            0,
        ] += deposit

    def run(self):
        n = self.inst.n_customers

        if n <= 0:
            raise ValueError(
                "ACO requires at least one customer."
            )

        rng = self.rng

        # =========================================================
        # STEP 1 — Initialize pheromone
        # =========================================================

        pheromone = np.ones(
            (n + 1, n + 1),
            dtype=float,
        )

        # =========================================================
        # STEP 2 — Distance heuristic
        # =========================================================

        distance = self.inst.dist

        heuristic = np.zeros_like(
            distance,
            dtype=float,
        )

        mask = distance > 0

        heuristic[mask] = (
            1.0 / distance[mask]
        )

        # No self transitions
        np.fill_diagonal(
            heuristic,
            0.0,
        )

        start = time.perf_counter()

        # =========================================================
        # STEP 3 — Main ACO loop
        # =========================================================

        for iteration in range(
            1,
            self.max_iter + 1,
        ):

            if (
                time.perf_counter() - start
                >= self.time_limit
            ):
                break

            ant_results = []

            # -----------------------------------------------------
            # Each ant constructs one solution
            # -----------------------------------------------------

            for _ in range(
                self.n_ants
            ):

                if (
                    time.perf_counter() - start
                    >= self.time_limit
                ):
                    break

                sequence = (
                    self._construct_solution(
                        pheromone,
                        heuristic,
                    )
                )

                position = (
                    self._sequence_to_position(
                        sequence
                    )
                )

                cost, routes, feasible = (
                    self.evaluate(position)
                )

                ant_results.append(
                    (
                        sequence,
                        cost,
                        routes,
                        feasible,
                    )
                )

                # Global best
                if cost < self.best_cost:

                    self.best_cost = cost
                    self.best_routes = routes
                    self.best_feasible = feasible
                    self.iterations_to_best = iteration

            if not ant_results:
                break

            # -----------------------------------------------------
            # STEP 4 — Pheromone evaporation
            # -----------------------------------------------------

            pheromone *= (
                1.0 - self.rho
            )

            # -----------------------------------------------------
            # STEP 5 — Pheromone deposition
            # -----------------------------------------------------

            for (
                sequence,
                cost,
                routes,
                feasible,
            ) in ant_results:

                self._deposit_pheromone(
                    pheromone,
                    sequence,
                    cost,
                )

            # -----------------------------------------------------
            # Prevent numerical instability
            # -----------------------------------------------------

            np.clip(
                pheromone,
                1e-6,
                1e6,
                out=pheromone,
            )

            np.fill_diagonal(
                pheromone,
                1e-6,
            )

            # -----------------------------------------------------
            # Convergence
            # -----------------------------------------------------

            self.convergence.append(
                self.best_cost
            )