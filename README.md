# Learn Claude Code

A project for learning [Claude Code](https://claude.ai/code) — and for running a
real demo app that showcases Claude's streaming, tool use, and agentic capabilities.

## Structure

```
TestClaude/
├── CLAUDE.md               ← Instructions Claude reads automatically
├── README.md               ← This file
├── start.sh                ← Starts both servers with one command
├── src/
│   ├── calculator.py       ← Calculator class (used by the demo app as a tool)
│   └── todo.py             ← TodoManager class (used by the demo app as a tool)
├── tests/
│   ├── test_calculator.py
│   └── test_todo.py
├── backend/                ← FastAPI + Anthropic SDK
│   ├── main.py             ← Streaming chat, agentic tool loop, SQLite storage
│   ├── requirements.txt
│   └── .env.example
└── frontend/               ← React + Vite
    ├── src/
    │   ├── App.jsx
    │   └── components/
    │       ├── ChatPanel.jsx   ← SSE streaming + tool call display
    │       ├── Message.jsx     ← Renders text blocks + tool call blocks
    │       └── Sidebar.jsx     ← Conversation history
    └── package.json
```

## Quick Start — Demo App

```bash
# 1. Set your API key
echo "ANTHROPIC_API_KEY=sk-ant-..." > backend/.env

# 2. Install dependencies
pip install -r backend/requirements.txt
cd frontend && npm install && cd ..

# 3. Launch (both servers)
./start.sh
# → open http://localhost:5173
```

## Quick Start — Learning Exercises

```bash
pip install pytest
python -m pytest tests/ -v      # run tests
python -m src.todo               # run the todo demo
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
