"""Quantum-inspired Ant Colony Optimization for Solomon VRPTW.

QACO replaces classical pheromone trails with quantum-inspired
rotation angles.

Quantum state:

    |psi> = cos(theta)|0> + sin(theta)|1>

The probability of selecting an edge is derived from the
quantum state amplitude:

    P_quantum(i,j) = sin(theta_ij)^2

Ants combine this quantum probability with the classical
distance heuristic.

Pipeline:

    Quantum rotation angles
            ↓
    Quantum path probabilities
            ↓
    Ant constructs customer permutation
            ↓
    Random-key conversion
            ↓
    Existing Prins split
            ↓
    CVRPTW routes
            ↓
    Total distance

Project parameters:
    ants = 20
    alpha = 1.0
    beta = 5.0
    theta_initial = pi / 4
"""

import time

import numpy as np

from algorithms.base import Optimizer


class QACO(Optimizer):
    name = "QACO"

    def __init__(
        self,
        inst,
        max_iter=300,
        time_limit=5.0,
        seed=0,
        n_ants=20,
        alpha=1.0,
        beta=5.0,
        theta_initial=np.pi / 4,
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
        self.theta_initial = theta_initial

    def _sequence_to_position(self, sequence):
        """Convert a customer permutation to random-key representation."""

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

    def _quantum_probability(self, theta):
        """Convert rotation angles into quantum selection probability.

        For:

            |psi> = cos(theta)|0> + sin(theta)|1>

        probability of measuring |1> is:

            P(1) = sin(theta)^2
        """

        probability = np.sin(theta) ** 2

        return np.clip(
            probability,
            1e-12,
            1.0,
        )

    def _construct_solution(
        self,
        theta,
        heuristic,
    ):
        """Construct one customer permutation using quantum probabilities."""

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

            # -----------------------------------------------------
            # Quantum probability for each candidate edge
            # -----------------------------------------------------

            quantum_prob = self._quantum_probability(
                theta[
                    current,
                    candidates,
                ]
            )

            eta = heuristic[
                current,
                candidates,
            ]

            # -----------------------------------------------------
            # Combine quantum state probability with heuristic.
            #
            # Classical ACO:
            #     tau^alpha * eta^beta
            #
            # QACO:
            #     quantum_probability^alpha * eta^beta
            # -----------------------------------------------------

            weights = (
                np.power(
                    quantum_prob,
                    self.alpha,
                )
                * np.power(
                    eta,
                    self.beta,
                )
            )

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

    def _rotation_update(
        self,
        theta,
        ant_results,
        iteration,
    ):
        """Update quantum rotation angles.

        The research specification defines:

            theta(t+1) = theta(t) + Delta_theta

        and:

            Delta_theta =
                (pi/2) * exp(-alpha * Delta_E / T)

        where Delta_E represents a solution-quality difference.

        Here we use the current global-best cost as the reference
        and rotate edges belonging to better ant solutions toward
        higher selection probability.

        A temperature schedule prevents the update from becoming
        excessively aggressive early in the search.
        """

        if not ant_results:
            return

        # ---------------------------------------------------------
        # Best solution produced during this iteration
        # ---------------------------------------------------------

        finite_results = [
            result
            for result in ant_results
            if np.isfinite(result[1])
        ]

        if not finite_results:
            return

        iteration_best = min(
            finite_results,
            key=lambda result: result[1],
        )

        best_sequence = iteration_best[0]
        best_cost = iteration_best[1]

        # ---------------------------------------------------------
        # Temperature schedule
        # ---------------------------------------------------------

        progress = iteration / max(
            self.max_iter,
            1,
        )

        temperature = max(
            0.05,
            1.0 - progress,
        )

        # ---------------------------------------------------------
        # Compare each ant with iteration-best.
        # ---------------------------------------------------------

        for sequence, cost, routes, feasible in finite_results:

            # Better solutions receive stronger rotation.
            energy_difference = max(
                0.0,
                cost - best_cost,
            )

            delta_theta = (
                (np.pi / 2.0)
                * np.exp(
                    -self.alpha
                    * energy_difference
                    / temperature
                )
            )

            # Keep the rotation update numerically bounded.
            delta_theta = min(
                delta_theta,
                np.pi / 8.0,
            )

            # -----------------------------------------------------
            # Direction:
            #
            # Edges from the current best solution are reinforced.
            # Other sampled edges receive a weaker opposing update.
            # -----------------------------------------------------

            best_edges = set(
                self._sequence_edges(
                    best_sequence
                )
            )

            for edge in self._sequence_edges(
                sequence
            ):

                i, j = edge

                if edge in best_edges:
                    theta[i, j] += delta_theta
                else:
                    theta[i, j] -= (
                        0.25 * delta_theta
                    )

        # ---------------------------------------------------------
        # Keep angles inside [0, pi/2].
        #
        # This keeps sin(theta)^2 in [0,1].
        # ---------------------------------------------------------

        np.clip(
            theta,
            1e-6,
            (np.pi / 2.0) - 1e-6,
            out=theta,
        )

    @staticmethod
    def _sequence_edges(sequence):
        """Return directed edges for a complete ant sequence."""

        if not sequence:
            return []

        edges = []

        # Depot -> first customer
        edges.append(
            (
                0,
                int(sequence[0]),
            )
        )

        # Customer -> customer
        for i in range(
            len(sequence) - 1
        ):
            edges.append(
                (
                    int(sequence[i]),
                    int(sequence[i + 1]),
                )
            )

        # Last customer -> depot
        edges.append(
            (
                int(sequence[-1]),
                0,
            )
        )

        return edges

    def run(self):
        n = self.inst.n_customers

        if n <= 0:
            raise ValueError(
                "QACO requires at least one customer."
            )

        distance = self.inst.dist

        # =========================================================
        # STEP 1 — Initialize quantum rotation angles
        # =========================================================
        #
        # theta_initial = pi/4
        #
        # sin(pi/4)^2 = 0.5
        #
        # Therefore every edge starts with equal quantum
        # probability before heuristic information is applied.
        # =========================================================

        theta = np.full(
            (n + 1, n + 1),
            self.theta_initial,
            dtype=float,
        )

        np.fill_diagonal(
            theta,
            0.0,
        )

        # =========================================================
        # STEP 2 — Distance heuristic
        # =========================================================

        heuristic = np.zeros_like(
            distance,
            dtype=float,
        )

        mask = distance > 0

        heuristic[mask] = (
            1.0 / distance[mask]
        )

        np.fill_diagonal(
            heuristic,
            0.0,
        )

        start = time.perf_counter()

        # =========================================================
        # STEP 3 — Main QACO loop
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
            # Each quantum-inspired ant constructs one solution
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
                        theta,
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

                # -------------------------------------------------
                # Global best
                # -------------------------------------------------

                if cost < self.best_cost:

                    self.best_cost = cost
                    self.best_routes = routes
                    self.best_feasible = feasible
                    self.best_position = position
                    self.iterations_to_best = iteration

            if not ant_results:
                break

            # -----------------------------------------------------
            # Quantum rotation update
            # -----------------------------------------------------

            self._rotation_update(
                theta,
                ant_results,
                iteration,
            )

            # -----------------------------------------------------
            # Convergence
            # -----------------------------------------------------

            self.convergence.append(
                self.best_cost
            )

        # Safety
        if (
            self.best_cost == np.inf
            and self.best_routes is None
        ):
            self.best_feasible = False