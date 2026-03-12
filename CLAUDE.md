# Claude Code Learning Project

This file is read automatically by Claude Code at the start of every session.
Use it to give Claude persistent instructions about your project.

## Project Overview

A small Python project for learning Claude Code. It includes a calculator and
a todo list manager, along with tests you can run to verify correctness.

## Development Commands

```bash
# Run all tests
python -m pytest tests/ -v

# Run a specific test file
python -m pytest tests/test_calculator.py -v

# Run the todo app interactively
python -m src.todo

# Check code style
python -m flake8 src/ tests/
```

## Project Conventions

- All source code lives in `src/`
- All tests live in `tests/`
- Functions should have docstrings
- Tests use `pytest`

## Known Issues to Fix (Learning Exercises)

There are intentional bugs in this codebase for you to find and fix with
Claude Code's help. Try asking Claude:

- "Run the tests and fix any failures"
- "Find and fix the bug in calculator.py"
- "Add a new feature: subtraction history to the todo manager"

## Claude Code Tips

1. **CLAUDE.md** — This file! Put project-wide instructions here so Claude
   always has context without you having to repeat yourself.

2. **Slash commands** — Type `/help` to see available commands.

3. **Ask Claude to explore** — "How does the todo manager work?"

4. **Ask Claude to fix bugs** — "Run the tests and fix any failures."

5. **Ask Claude to add features** — "Add a `clear_done` method to TodoManager."

6. **Review changes** — Claude will show diffs before editing. You approve them.
