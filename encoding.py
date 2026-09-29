"""Random-key encoding + Prins split for VRPTW.

Pipeline: real vector --argsort--> customer sequence --Prins split--> feasible routes.
"""

import numpy as np


def decode_sequence(position):
    """Random-key decode: any real vector -> permutation of 1..n (customer IDs)."""
    return np.argsort(position) + 1  # +1 because customers are 1-indexed


def route_cost(inst, route):
    """Total distance of a single route (route = list of customer IDs, depot implicit)."""
    if not route:
        return 0.0
    d = inst.dist
    path = [0] + list(route) + [0]
    distance_cost = sum(d[path[i], path[i + 1]] for i in range(len(path) - 1))

    # Live dispatch requests may include Admin-selected delivery priorities.
    # They softly prefer earlier service at high-priority stops while leaving
    # Solomon benchmark objective values untouched (no weights are attached).
    priority_weights = getattr(inst, "priority_weights", None)
    if priority_weights is None:
        return distance_cost

    travel_time = getattr(inst, "travel_time", d)
    clock = 0.0
    previous = 0
    weighted_arrival_hours = 0.0
    for customer in route:
        clock = max(clock + travel_time[previous, customer], inst.ready[customer])
        weighted_arrival_hours += priority_weights[customer] * clock / 60.0
        clock += inst.service[customer]
        previous = customer

    return distance_cost + getattr(inst, "priority_arrival_cost", 0.5) * weighted_arrival_hours


def routes_cost(inst, routes):
    """Total cost = sum of route distances. Fewer vehicles is implied by shorter total."""
    return sum(route_cost(inst, r) for r in routes)


def routes_feasible(inst, routes):
    """Check capacity AND time-window feasibility of a solution (list of routes)."""
    # Solomon instances express distance in the same unit as time. Live Navi
    # Mumbai requests provide a separate, congestion-aware travel-time matrix.
    travel_time = getattr(inst, "travel_time", inst.dist)
    for route in routes:
        if sum(inst.demand[c] for c in route) > inst.capacity + 1e-9:
            return False
        t = 0.0
        prev = 0
        for c in route:
            t = max(t + travel_time[prev, c], inst.ready[c])
            if t > inst.due[c] + 1e-9:
                return False
            t += inst.service[c]
            prev = c
        # Depot return time is enforced against the depot's due date
        if t + travel_time[prev, 0] > inst.due[0] + 1e-9:
            return False
    return True


def _prins_split_with_vehicle_limit(inst, seq, max_vehicles, enforce_tw):
    """Return the least-cost Prins split that uses at most the fleet size."""
    n = len(seq)
    d, dem, ready, due, serv = (
        inst.dist, inst.demand, inst.ready, inst.due, inst.service,
    )
    travel_time = getattr(inst, "travel_time", d)
    inf = np.inf

    for status in ("tw", "cap") if enforce_tw else ("cap",):
        # dp[k][j] is the least cost to serve seq[:j] using exactly k routes.
        dp = [[inf] * (n + 1) for _ in range(max_vehicles + 1)]
        parent = [[None] * (n + 1) for _ in range(max_vehicles + 1)]
        dp[0][0] = 0.0

        for k in range(1, max_vehicles + 1):
            for i in range(n):
                if not np.isfinite(dp[k - 1][i]):
                    continue
                load = 0.0
                cost = 0.0
                t = 0.0
                prev = 0
                for j in range(i, n):
                    c = seq[j]
                    load += dem[c]
                    if load > inst.capacity:
                        break
                    cost += d[prev, c] + d[c, 0] - d[prev, 0]
                    t = max(t + travel_time[prev, c], ready[c])
                    if status == "tw" and t > due[c]:
                        break
                    t += serv[c]
                    prev = c
                    candidate = dp[k - 1][i] + cost
                    if candidate < dp[k][j + 1]:
                        dp[k][j + 1] = candidate
                        parent[k][j + 1] = i

        possible = [k for k in range(1, max_vehicles + 1) if np.isfinite(dp[k][n])]
        if possible:
            route_count = min(possible, key=lambda k: dp[k][n])
            routes = []
            j = n
            while j > 0:
                i = parent[route_count][j]
                if i is None:
                    return None
                routes.append(seq[i:j])
                j = i
                route_count -= 1
            routes.reverse()
            return routes
    return None


def prins_split(inst, sequence, enforce_tw=True):
    """Prins (2004) split: optimally divide a customer sequence into feasible routes.

    Builds an auxiliary DAG where arc (i, j) = a feasible route serving
    sequence[i:j], then finds the shortest path from node 0 to node n.
    Guaranteed capacity-feasible; time windows enforced when enforce_tw=True.

    Args:
        inst: VRPInstance
        sequence: array of customer IDs (a permutation of 1..n)
        enforce_tw: if True, arcs violating time windows are removed.
            If no TW-feasible split exists, falls back to capacity-only.

    Returns:
        List of routes (each a list of customer IDs).
    """
    seq = list(sequence)
    n = len(seq)
    d, dem, ready, due, serv = (
        inst.dist, inst.demand, inst.ready, inst.due, inst.service,
    )
    travel_time = getattr(inst, "travel_time", d)
    Q = inst.capacity

    max_vehicles = getattr(inst, "max_vehicles", None)
    if max_vehicles is not None:
        return _prins_split_with_vehicle_limit(
            inst, seq, int(max_vehicles), enforce_tw
        )

    # V[j] = cost of best split of seq[:j]; parent[j] = start index of last route
    INF = np.inf

    # Try TW-feasible split first (if requested); fall back to capacity-only.
    for j_status in ("tw", "cap") if enforce_tw else ("cap",):
        V = [INF] * (n + 1)
        V[0] = 0.0
        parent = [0] * (n + 1)
        for i in range(n):
            # Incrementally extend the route starting at seq[i], one customer
            # at a time — load, time and cost update in O(1) per step.
            load = 0.0
            cost = 0.0
            t = 0.0
            prev = 0
            for j in range(i, n):
                c = seq[j]
                load += dem[c]
                if load > Q:
                    break
                # append c, return leg now goes c->0 instead of prev->0
                cost += d[prev, c] + d[c, 0] - d[prev, 0]
                t = max(t + travel_time[prev, c], ready[c])
                if j_status == "tw" and t > due[c]:
                    break  # TW broken: no longer extension can fix it
                t += serv[c]
                prev = c
                if V[i] + cost < V[j + 1]:
                    V[j + 1] = V[i] + cost
                    parent[j + 1] = i
        if V[n] < INF:
            break  # tw pass succeeded

    if V[n] == INF:
        raise RuntimeError("No capacity-feasible split exists (demand > Q for some customer?)")

    # Reconstruct routes
    routes = []
    j = n
    while j > 0:
        i = parent[j]
        routes.append(seq[i:j])
        j = i
    routes.reverse()
    return routes


def evaluate(inst, position):
    """Full evaluation for optimizers: vector -> (cost, routes, feasible)."""
    seq = decode_sequence(position)
    routes = prins_split(inst, seq)
    if routes is None:
        return float("inf"), [], False
    cost = routes_cost(inst, routes)
    feasible = routes_feasible(inst, routes)
    return cost, routes, feasible
