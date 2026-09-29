import numpy as np
import pytest

from vrp_loader import load_instance
from encoding import decode_sequence, prins_split, evaluate, routes_feasible, route_cost

RC101 = "data/instances/RC101.csv"


def test_decode_random_key():
    """decode: any real vector -> valid permutation."""
    position = np.random.rand(100)
    seq = decode_sequence(position)
    assert len(seq) == 100
    assert set(seq) == set(range(1, 101))  # all 1..100 exactly once


def test_prins_split_capacity():
    """Prins split guarantees capacity feasibility."""
    inst = load_instance(RC101, n_customers=25)
    seq = np.arange(1, 26)  # 1..25 in order
    routes = prins_split(inst, seq, enforce_tw=False)
    for r in routes:
        assert sum(inst.demand[c] for c in r) <= inst.capacity


def test_prins_split_known():
    """Prins split on a known sequence produces valid output."""
    inst = load_instance(RC101, n_customers=10)
    seq = np.array([3, 1, 5, 2, 9, 4, 6, 7, 8, 10])
    routes = prins_split(inst, seq, enforce_tw=False)
    # All customers appear once
    served = [c for r in routes for c in r]
    assert sorted(served) == list(range(1, 11))


def test_prins_split_tw():
    """Prins split with TW enforcement may produce different splits."""
    inst = load_instance(RC101, n_customers=25)
    seq = np.arange(1, 26)
    routes_tw = prins_split(inst, seq, enforce_tw=True)
    routes_cap = prins_split(inst, seq, enforce_tw=False)
    # Both are feasible in their own sense
    assert routes_feasible(inst, routes_tw)
    for r in routes_cap:
        assert sum(inst.demand[c] for c in r) <= inst.capacity


def test_evaluate():
    """evaluate() returns cost, routes, feasibility."""
    inst = load_instance(RC101, n_customers=10)
    position = np.random.rand(10)
    cost, routes, feasible = evaluate(inst, position)
    assert isinstance(cost, float)
    assert cost >= 0
    assert isinstance(routes, list)
    assert isinstance(feasible, bool)
    # Check reconstruction
    served = [c for r in routes for c in r]
    assert set(served) == set(range(1, 11))


def test_deterministic_decode():
    """Same seed gives same permutation."""
    np.random.seed(42)
    pos1 = np.random.rand(20)
    np.random.seed(42)
    pos2 = np.random.rand(20)
    assert np.array_equal(decode_sequence(pos1), decode_sequence(pos2))