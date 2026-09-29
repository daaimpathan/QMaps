"""Solomon VRPTW instance loader."""

import numpy as np

# Known vehicle capacities from the original Solomon benchmark headers
SOLOMON_CAPACITIES = {
    "C101": 200.0,
    "RC101": 200.0,
    "RC201": 1000.0,
}


class VRPInstance:
    """A Solomon-format VRPTW instance.

    Attributes:
        name: instance name (e.g. 'RC101')
        coords: (n+1, 2) array — row 0 is the depot
        demand: (n+1,) array — demand[0] = 0
        ready: (n+1,) array — time window start
        due: (n+1,) array — time window end
        service: (n+1,) array — service duration
        capacity: vehicle capacity Q
        dist: (n+1, n+1) Euclidean distance matrix
        n_customers: number of customers (excluding depot)
    """

    def __init__(self, name, coords, demand, ready, due, service, capacity):
        self.name = name
        self.coords = np.asarray(coords, dtype=float)
        self.demand = np.asarray(demand, dtype=float)
        self.ready = np.asarray(ready, dtype=float)
        self.due = np.asarray(due, dtype=float)
        self.service = np.asarray(service, dtype=float)
        self.capacity = float(capacity)

        self.n_customers = len(self.demand) - 1  # index 0 is depot

        # Euclidean distance matrix (Solomon convention: real-valued, not rounded)
        diff = self.coords[:, None, :] - self.coords[None, :, :]
        self.dist = np.sqrt((diff ** 2).sum(axis=-1))

    @property
    def customer_ids(self):
        """1-based customer indices (1..n)."""
        return np.arange(1, self.n_customers + 1)

    def load_subset(self, n):
        """Return a new instance with only the first n customers."""
        if not 1 <= n <= self.n_customers:
            raise ValueError(f"n must be in [1, {self.n_customers}], got {n}")
        keep = list(range(n + 1))  # depot + first n customers
        return VRPInstance(
            f"{self.name}_{n}",
            self.coords[keep],
            self.demand[keep],
            self.ready[keep],
            self.due[keep],
            self.service[keep],
            self.capacity,
        )

    def __repr__(self):
        return (
            f"VRPInstance({self.name}: {self.n_customers} customers, "
            f"Q={self.capacity:.0f})"
        )


def load_instance(path, n_customers=None, capacity=None):
    """Load a Solomon-format CSV instance.

    Args:
        path: CSV file with 7 columns:
            CUST NO., XCOORD., YCOORD., DEMAND, READY TIME, DUE DATE, SERVICE TIME
            Row 1 (after header) must be the depot.
        n_customers: optionally truncate to the first n customers.
        capacity: vehicle capacity override; if None, looked up from the
            filename in SOLOMON_CAPACITIES, falling back to max demand * 3.
    """
    data = np.genfromtxt(path, delimiter=",", skip_header=1)
    data = data[~np.isnan(data).any(axis=1)]  # drop blank trailing lines

    if data.shape[1] != 7:
        raise ValueError(f"Expected 7 columns, got {data.shape[1]} in {path}")
    if data[0, 3] != 0:
        raise ValueError("First data row must be the depot (demand=0)")

    cust_no, x, y, demand, ready, due, service = data.T
    # Re-index customers to 0=depot, 1..n in file order
    order = np.argsort(cust_no)
    for arr in (x, y, demand, ready, due, service):
        arr[:] = arr[order]

    name = str(path).rsplit("\\", 1)[-1].rsplit("/", 1)[-1].split(".")[0]
    if capacity is None:
        capacity = SOLOMON_CAPACITIES.get(name)
        if capacity is None:
            capacity = demand.max() * 3
            print(f"WARNING: unknown capacity for {name}, using {capacity}")

    coords = np.column_stack([x, y])
    inst = VRPInstance(name, coords, demand, ready, due, service, capacity)
    if n_customers is not None:
        inst = inst.load_subset(n_customers)
    return inst
