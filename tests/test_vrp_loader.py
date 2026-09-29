import numpy as np
import pytest

from vrp_loader import load_instance

RC101 = "data/instances/RC101.csv"
C101 = "data/instances/C101.csv"
RC201 = "data/instances/RC201.csv"


def test_load_full_rc101():
    inst = load_instance(RC101)
    assert inst.n_customers == 100
    assert inst.capacity == 200
    # Depot at (40, 50), due 240
    assert np.allclose(inst.coords[0], (40, 50))
    assert inst.due[0] == 240
    # First customer from file: (25, 85), demand 20, window [145, 175]
    assert np.allclose(inst.coords[1], (25, 85))
    assert inst.demand[1] == 20
    assert inst.ready[1] == 145
    assert inst.due[1] == 175


def test_distance_matrix():
    inst = load_instance(RC101)
    assert inst.dist.shape == (101, 101)
    # Symmetric, zero diagonal
    assert np.allclose(inst.dist, inst.dist.T)
    assert np.allclose(np.diag(inst.dist), 0)
    # Known: depot (40,50) to customer 1 (25,85) = sqrt(15^2+35^2)
    expected = np.sqrt(15**2 + 35**2)
    assert abs(inst.dist[0, 1] - expected) < 1e-9


def test_subset():
    inst = load_instance(RC101, n_customers=25)
    assert inst.n_customers == 25
    assert inst.dist.shape == (26, 26)
    # Sub-instance distances match the full one
    full = load_instance(RC101)
    assert np.allclose(inst.dist, full.dist[:26, :26])


def test_capacities():
    assert load_instance(C101).capacity == 200
    assert load_instance(RC201).capacity == 1000


def test_all_demands_within_capacity():
    for path in (RC101, C101, RC201):
        inst = load_instance(path)
        assert inst.demand[1:].max() <= inst.capacity
