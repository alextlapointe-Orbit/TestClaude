"""Tests for the TodoManager and TodoItem classes."""

import pytest
from src.todo import TodoItem, TodoManager


def test_todo_item_defaults():
    item = TodoItem(title="Buy milk")
    assert item.title == "Buy milk"
    assert item.done is False
    assert item.tags == []


def test_todo_item_complete():
    item = TodoItem(title="Read docs")
    item.complete()
    assert item.done is True


def test_todo_item_str_pending():
    item = TodoItem(title="Write tests")
    assert str(item) == "[ ] Write tests"


def test_todo_item_str_done():
    item = TodoItem(title="Write tests")
    item.complete()
    assert str(item) == "[x] Write tests"


def test_todo_item_str_with_tags():
    item = TodoItem(title="Deploy", tags=["ops", "urgent"])
    assert "[ops, urgent]" in str(item)


# --- TodoManager tests ---


@pytest.fixture
def manager():
    return TodoManager()


def test_add_item(manager):
    item = manager.add("Task A")
    assert item.title == "Task A"
    assert len(manager.all_items()) == 1


def test_add_item_with_tags(manager):
    item = manager.add("Task B", tags=["work", "python"])
    assert item.tags == ["work", "python"]


def test_complete_item(manager):
    manager.add("Task C")
    result = manager.complete("Task C")
    assert result is True
    assert manager.all_items()[0].done is True


def test_complete_missing_item(manager):
    result = manager.complete("Ghost task")
    assert result is False


def test_remove_item(manager):
    manager.add("Task D")
    result = manager.remove("Task D")
    assert result is True
    assert len(manager.all_items()) == 0


def test_remove_missing_item(manager):
    result = manager.remove("Ghost task")
    assert result is False


def test_pending_filters_done(manager):
    manager.add("Task E")
    manager.add("Task F")
    manager.complete("Task E")
    pending = manager.pending()
    assert len(pending) == 1
    assert pending[0].title == "Task F"


def test_by_tag(manager):
    manager.add("Task G", tags=["alpha"])
    manager.add("Task H", tags=["beta"])
    manager.add("Task I", tags=["alpha", "beta"])
    alpha = manager.by_tag("alpha")
    assert len(alpha) == 2
    assert all("alpha" in item.tags for item in alpha)


def test_summary(manager):
    manager.add("Task J")
    manager.add("Task K")
    manager.complete("Task J")
    assert manager.summary() == "1/2 items completed"


def test_empty_str(manager):
    assert str(manager) == "(empty todo list)"
