"""
Simple calculator module.

Learning exercise: this file contains a bug. Try asking Claude Code:
  "Run the tests and fix any failures in calculator.py"
"""


class Calculator:
    """A simple calculator that keeps a history of operations."""

    def __init__(self):
        self.history = []

    def add(self, a, b):
        """Return the sum of a and b."""
        result = a + b
        self.history.append(f"{a} + {b} = {result}")
        return result

    def subtract(self, a, b):
        """Return a minus b."""
        result = a - b
        self.history.append(f"{a} - {b} = {result}")
        return result

    def multiply(self, a, b):
        """Return the product of a and b."""
        result = a * b
        self.history.append(f"{a} * {b} = {result}")
        return result

    def divide(self, a, b):
        """Return a divided by b.

        Raises:
            ValueError: if b is zero.
        """
        if b == 0:
            raise ValueError("Cannot divide by zero")
        # BUG: the result is computed incorrectly — can you spot it?
        result = a * b
        self.history.append(f"{a} / {b} = {result}")
        return result

    def get_history(self):
        """Return a list of all past calculations."""
        return list(self.history)

    def clear_history(self):
        """Clear the calculation history."""
        self.history = []
