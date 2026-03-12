# Learn Claude Code

A small Python project designed to help you learn [Claude Code](https://claude.ai/code) —
Anthropic's AI-powered CLI for software development.

## Structure

```
TestClaude/
├── CLAUDE.md               ← Instructions Claude reads automatically
├── README.md               ← This file
├── src/
│   ├── calculator.py       ← Simple calculator (contains a bug!)
│   └── todo.py             ← Todo list manager
└── tests/
    ├── test_calculator.py  ← Tests for the calculator
    └── test_todo.py        ← Tests for the todo manager
```

## Quick Start

```bash
# Install pytest if you don't have it
pip install pytest

# Run all tests (some will fail — that's intentional!)
python -m pytest tests/ -v

# Run the todo demo
python -m src.todo
```

## Learning Exercises

Work through these with Claude Code to explore its capabilities:

### 1. Understand the codebase
Ask Claude: _"Explain how the TodoManager works"_

### 2. Find and fix a bug
Ask Claude: _"Run the tests and fix any failures"_

The calculator has an intentional bug in `divide()`. Claude can find and fix it.

### 3. Add a new feature
Ask Claude: _"Add a `completed_items()` method to TodoManager that returns only done items"_

### 4. Write more tests
Ask Claude: _"Write a test that verifies the history entry for divide is correct after the fix"_

### 5. Refactor
Ask Claude: _"Refactor calculator.py to reduce repetition in the history-recording logic"_

## Key Claude Code Concepts

| Concept | Description |
|---|---|
| `CLAUDE.md` | Persistent project instructions Claude reads every session |
| Slash commands | `/help`, `/clear`, `/compact` and more |
| Tool approval | Claude asks before editing files or running commands |
| Context | Claude reads files you reference automatically |
| Agentic tasks | "Run tests, find failures, fix them" — Claude does it end-to-end |
