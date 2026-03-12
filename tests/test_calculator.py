"""Tests for the Calculator class."""

import pytest
from src.calculator import Calculator


@pytest.fixture
def calc():
    return Calculator()


def test_add(calc):
    assert calc.add(2, 3) == 5
    assert calc.add(-1, 1) == 0
    assert calc.add(0, 0) == 0


def test_subtract(calc):
    assert calc.subtract(10, 4) == 6
    assert calc.subtract(0, 5) == -5


def test_multiply(calc):
    assert calc.multiply(3, 4) == 12
    assert calc.multiply(-2, 5) == -10
    assert calc.multiply(0, 100) == 0


def test_divide(calc):
    assert calc.divide(10, 2) == 5
    assert calc.divide(9, 3) == 3
    assert calc.divide(7, 2) == 3.5


def test_divide_by_zero(calc):
    with pytest.raises(ValueError, match="Cannot divide by zero"):
        calc.divide(5, 0)


def test_history_records_operations(calc):
    calc.add(1, 2)
    calc.subtract(5, 3)
    history = calc.get_history()
    assert len(history) == 2
    assert "1 + 2 = 3" in history
    assert "5 - 3 = 2" in history


def test_clear_history(calc):
    calc.add(1, 1)
    calc.clear_history()
    assert calc.get_history() == []


def test_history_divide_entry(calc):
    calc.divide(8, 4)
    assert "8 / 4 = 2.0" in calc.get_history() or "8 / 4 = 2" in calc.get_history()
