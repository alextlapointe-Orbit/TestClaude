"""
Todo list manager module.

Try asking Claude Code:
  "Add a method to TodoManager that returns only completed items"
  "Add due-date support to TodoItem"
"""

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class TodoItem:
    """Represents a single todo item."""

    title: str
    done: bool = False
    tags: List[str] = field(default_factory=list)

    def complete(self):
        """Mark this item as done."""
        self.done = True

    def __str__(self):
        status = "x" if self.done else " "
        tag_str = f"  [{', '.join(self.tags)}]" if self.tags else ""
        return f"[{status}] {self.title}{tag_str}"


class TodoManager:
    """Manages a collection of todo items."""

    def __init__(self):
        self._items: List[TodoItem] = []

    def add(self, title: str, tags: Optional[List[str]] = None) -> TodoItem:
        """Add a new todo item and return it."""
        item = TodoItem(title=title, tags=tags or [])
        self._items.append(item)
        return item

    def complete(self, title: str) -> bool:
        """Mark the first item matching title as done. Returns True if found."""
        for item in self._items:
            if item.title == title:
                item.complete()
                return True
        return False

    def remove(self, title: str) -> bool:
        """Remove the first item matching title. Returns True if found."""
        for i, item in enumerate(self._items):
            if item.title == title:
                self._items.pop(i)
                return True
        return False

    def pending(self) -> List[TodoItem]:
        """Return all items that are not yet done."""
        return [item for item in self._items if not item.done]

    def all_items(self) -> List[TodoItem]:
        """Return all items."""
        return list(self._items)

    def by_tag(self, tag: str) -> List[TodoItem]:
        """Return all items that have the given tag."""
        return [item for item in self._items if tag in item.tags]

    def summary(self) -> str:
        """Return a human-readable summary of the todo list."""
        total = len(self._items)
        done = sum(1 for item in self._items if item.done)
        return f"{done}/{total} items completed"

    def __str__(self):
        if not self._items:
            return "(empty todo list)"
        return "\n".join(str(item) for item in self._items)


if __name__ == "__main__":
    # Quick demo — run with: python -m src.todo
    manager = TodoManager()
    manager.add("Read the Claude Code docs", tags=["learning"])
    manager.add("Try out /help command", tags=["learning"])
    manager.add("Fix the bug in calculator.py", tags=["exercise"])
    manager.add("Add a new feature to todo.py", tags=["exercise"])
    manager.add("Push changes to GitHub", tags=["git"])

    print("=== My Learning Todo List ===")
    print(manager)
    print()

    manager.complete("Read the Claude Code docs")
    print("After completing first task:")
    print(manager)
    print()
    print(manager.summary())
