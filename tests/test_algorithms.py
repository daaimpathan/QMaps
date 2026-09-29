"""Unit tests for all QMaps optimization algorithms."""

import numpy as np
import pytest

from vrp_loader import load_instance

from algorithms.pso import PSO
from algorithms.qpso import QPSO
from algorithms.astar import AStar
from algorithms.aco import ACO
from algorithms.qaco import QACO


# Small Solomon instance for fast unit testing.
INSTANCE_PATH = "data/instances/RC101.csv"


@pytest.fixture
def instance():
    """Load a small RC101 instance for unit tests."""
    return load_instance(
        INSTANCE_PATH,
        n_customers=10,
    )


@pytest.fixture(
    params=[
        PSO,
        QPSO,
        AStar,
        ACO,
        QACO,
    ]
)
def algorithm_class(request):
    """Run the same correctness tests for every algorithm."""
    return request.param


def create_optimizer(algorithm_class, instance):
    """Create an optimizer with a short test configuration."""

    return algorithm_class(
        instance,
        max_iter=20,
        time_limit=2.0,
        seed=42,
    )


def test_algorithm_returns_result(
    algorithm_class,
    instance,
):
    """Every algorithm must return the standard result dictionary."""

    optimizer = create_optimizer(
        algorithm_class,
        instance,
    )

    result = optimizer.optimize()

    required_keys = {
        "algorithm",
        "cost",
        "best_cost",
        "routes",
        "convergence",
        "iterations_to_best",
        "time",
        "feasible",
    }

    assert required_keys.issubset(
        result.keys()
    )


def test_algorithm_finds_finite_solution(
    algorithm_class,
    instance,
):
    """Every algorithm must find a finite solution."""

    optimizer = create_optimizer(
        algorithm_class,
        instance,
    )

    result = optimizer.optimize()

    assert np.isfinite(
        result["cost"]
    )

    assert np.isfinite(
        result["best_cost"]
    )

    assert result["cost"] == result["best_cost"]


def test_algorithm_solution_is_feasible(
    algorithm_class,
    instance,
):
    """Every algorithm must produce a feasible CVRPTW solution."""

    optimizer = create_optimizer(
        algorithm_class,
        instance,
    )

    result = optimizer.optimize()

    assert result["feasible"] is True
    assert result["routes"] is not None


def test_all_customers_are_served(
    algorithm_class,
    instance,
):
    """Every customer must appear exactly once in the solution."""

    optimizer = create_optimizer(
        algorithm_class,
        instance,
    )

    result = optimizer.optimize()

    routes = result["routes"]

    assert routes is not None

    served = []

    for route in routes:
        served.extend(route)

    served = [
        int(customer)
        for customer in served
    ]

    expected = list(
        range(
            1,
            instance.n_customers + 1,
        )
    )

    assert sorted(served) == expected


def test_routes_are_not_empty(
    algorithm_class,
    instance,
):
    """Every generated route must contain at least one customer."""

    optimizer = create_optimizer(
        algorithm_class,
        instance,
    )

    result = optimizer.optimize()

    routes = result["routes"]

    assert routes is not None
    assert len(routes) > 0

    for route in routes:
        assert len(route) > 0


def test_convergence_is_recorded(
    algorithm_class,
    instance,
):
    """Every algorithm must record a convergence history."""

    optimizer = create_optimizer(
        algorithm_class,
        instance,
    )

    result = optimizer.optimize()

    convergence = result["convergence"]

    assert convergence is not None
    assert len(convergence) > 0

    for value in convergence:
        assert np.isfinite(value)


def test_runtime_is_recorded(
    algorithm_class,
    instance,
):
    """Every algorithm must report execution time."""

    optimizer = create_optimizer(
        algorithm_class,
        instance,
    )

    result = optimizer.optimize()

    assert result["time"] >= 0.0
    assert np.isfinite(
        result["time"]
    )