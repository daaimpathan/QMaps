"""A* search baseline for Solomon VRPTW.

A* searches over customer permutations using a bitmask state.

The resulting customer sequence is passed through the existing
Prins split implementation for capacity and time-window handling.

This implementation uses a feasible incumbent solution first,
then performs time-limited A* search to improve it.
"""

import heapq
import time

import numpy as np

from algorithms.base import Optimizer


class AStar(Optimizer):
    name = "A*"

    def __init__(
        self,
        inst,
        max_iter=300,
        time_limit=5.0,
        seed=0,
    ):
        super().__init__(
            inst,
            max_iter,
            time_limit,
            seed,
        )

    def _heuristic(self, current, unvisited_mask):
        """Lower-bound style estimate for remaining travel."""

        if unvisited_mask == 0:
            return float(self.inst.dist[current, 0])

        n = self.inst.n_customers
        dist = self.inst.dist

        customers = [
            i + 1
            for i in range(n)
            if unvisited_mask & (1 << i)
        ]

        # Current node -> nearest unvisited customer
        current_to_unvisited = min(
            dist[current, c]
            for c in customers
        )

        # Lower bound from outgoing edges of
        # all unvisited customers.
        outgoing_lb = 0.0

        for c in customers:
            min_outgoing = np.min(
                np.delete(dist[c], c)
            )
            outgoing_lb += min_outgoing

        return float(
            current_to_unvisited + outgoing_lb
        )

    def _sequence_to_position(self, sequence):
        """Convert customer permutation to random-key representation."""

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

    def _evaluate_sequence(self, sequence):
        """Evaluate a customer permutation using common VRPTW evaluator."""

        position = self._sequence_to_position(
            sequence
        )

        return self.evaluate(position)

    def _find_initial_solution(self, start_time):
        """Find a feasible initial solution before A* search.

        Several deterministic and randomized customer orders are tested.
        This prevents A* from starting with an infinite incumbent.
        """

        n = self.inst.n_customers
        rng = self.rng

        candidates = []

        # ---------------------------------------------------------
        # Candidate 1: nearest-neighbour order
        # ---------------------------------------------------------

        unvisited = set(range(1, n + 1))
        sequence = []
        current = 0

        while unvisited:
            next_customer = min(
                unvisited,
                key=lambda c: self.inst.dist[current, c],
            )

            sequence.append(next_customer)
            unvisited.remove(next_customer)
            current = next_customer

        candidates.append(sequence)

        # ---------------------------------------------------------
        # Candidate 2: earliest due-date order
        # ---------------------------------------------------------

        earliest_due = sorted(
            range(1, n + 1),
            key=lambda c: (
                self.inst.due[c],
                self.inst.ready[c],
            ),
        )

        candidates.append(earliest_due)

        # ---------------------------------------------------------
        # Candidate 3: earliest ready-time order
        # ---------------------------------------------------------

        earliest_ready = sorted(
            range(1, n + 1),
            key=lambda c: (
                self.inst.ready[c],
                self.inst.due[c],
            ),
        )

        candidates.append(earliest_ready)

        # ---------------------------------------------------------
        # Randomized candidates
        # ---------------------------------------------------------

        n_random = min(
            100,
            max(20, n * 3),
        )

        customers = np.arange(
            1,
            n + 1,
        )

        for _ in range(n_random):
            if time.perf_counter() - start_time >= self.time_limit:
                break

            shuffled = customers.copy()
            rng.shuffle(shuffled)
            candidates.append(
                shuffled.tolist()
            )

        best = None

        # ---------------------------------------------------------
        # Evaluate candidates
        # ---------------------------------------------------------

        for sequence in candidates:

            if time.perf_counter() - start_time >= self.time_limit:
                break

            cost, routes, feasible = (
                self._evaluate_sequence(sequence)
            )

            if feasible and np.isfinite(cost):
                if best is None or cost < best[0]:
                    best = (
                        cost,
                        routes,
                        feasible,
                    )

        return best

    def run(self):
        n = self.inst.n_customers

        if n <= 0:
            raise ValueError(
                "A* requires at least one customer."
            )

        start = time.perf_counter()

        # =========================================================
        # STEP 1 — Find an initial feasible solution
        # =========================================================

        initial = self._find_initial_solution(
            start
        )

        if initial is not None:
            (
                cost,
                routes,
                feasible,
            ) = initial

            self.best_cost = cost
            self.best_routes = routes
            self.best_feasible = feasible
            self.iterations_to_best = 0

            self.convergence.append(
                self.best_cost
            )

        # If no feasible solution was found within the time limit,
        # return without pretending that A* solved the instance.
        if time.perf_counter() - start >= self.time_limit:
            return

        # =========================================================
        # STEP 2 — A* search
        # =========================================================

        full_mask = (1 << n) - 1

        open_heap = []

        initial_mask = 0
        initial_current = 0
        initial_sequence = ()

        h0 = self._heuristic(
            initial_current,
            full_mask,
        )

        heapq.heappush(
            open_heap,
            (
                h0,
                0.0,
                initial_mask,
                initial_current,
                initial_sequence,
            ),
        )

        # Best g-value discovered for each state.
        best_g = {
            (
                initial_mask,
                initial_current,
            ): 0.0
        }

        iterations = 0

        # =========================================================
        # STEP 3 — Search
        # =========================================================

        while open_heap:

            if (
                time.perf_counter() - start
                >= self.time_limit
            ):
                break

            (
                f_score,
                g_score,
                visited_mask,
                current,
                sequence,
            ) = heapq.heappop(
                open_heap
            )

            iterations += 1

            state = (
                visited_mask,
                current,
            )

            # Ignore stale queue entries.
            if (
                g_score
                > best_g.get(
                    state,
                    np.inf,
                ) + 1e-12
            ):
                continue

            # =====================================================
            # Goal state
            # =====================================================

            if visited_mask == full_mask:

                cost, routes, feasible = (
                    self._evaluate_sequence(
                        sequence
                    )
                )

                if (
                    feasible
                    and np.isfinite(cost)
                    and cost < self.best_cost
                ):
                    self.best_cost = cost
                    self.best_routes = routes
                    self.best_feasible = feasible
                    self.iterations_to_best = iterations

                self.convergence.append(
                    self.best_cost
                )

                continue

            # =====================================================
            # Expand unvisited customers
            # =====================================================

            for customer in range(1, n + 1):

                if (
                    time.perf_counter() - start
                    >= self.time_limit
                ):
                    break

                bit = 1 << (customer - 1)

                if visited_mask & bit:
                    continue

                new_mask = (
                    visited_mask | bit
                )

                new_g = (
                    g_score
                    + self.inst.dist[
                        current,
                        customer,
                    ]
                )

                new_sequence = (
                    sequence + (customer,)
                )

                new_state = (
                    new_mask,
                    customer,
                )

                # Skip if this state was already reached
                # with a cheaper path.
                if (
                    new_g
                    >= best_g.get(
                        new_state,
                        np.inf,
                    ) - 1e-12
                ):
                    continue

                best_g[new_state] = new_g

                remaining_mask = (
                    full_mask ^ new_mask
                )

                h = self._heuristic(
                    customer,
                    remaining_mask,
                )

                new_f = new_g + h

                heapq.heappush(
                    open_heap,
                    (
                        new_f,
                        new_g,
                        new_mask,
                        customer,
                        new_sequence,
                    ),
                )

            # Record convergence periodically.
            if iterations % 100 == 0:
                self.convergence.append(
                    self.best_cost
                )

        # =========================================================
        # STEP 4 — Safety
        # =========================================================

        if (
            self.best_cost == np.inf
            and self.best_routes is None
        ):
            self.best_feasible = False