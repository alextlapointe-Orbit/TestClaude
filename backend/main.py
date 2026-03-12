"""
Claude Demo Backend — FastAPI + Anthropic SDK

Showcases:
  - Streaming responses (SSE)
  - Agentic tool-use loop (Claude calls real tools)
  - Persistent conversation history (SQLite)
  - Five tools: calculator, todo, read_file, list_files, run_code
"""

import asyncio
import json
import os
import subprocess
import sys
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

import aiosqlite
import anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

load_dotenv()

# ─── Config ───────────────────────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).parent.parent
DB_PATH = Path(__file__).parent / "conversations.db"
MODEL = "claude-opus-4-6"

client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SYSTEM_PROMPT = """You are a helpful AI assistant demonstrating Claude's capabilities.
You have access to tools that interact with a real Python project called TestClaude.

The project contains:
- src/calculator.py  — Calculator class with add/subtract/multiply/divide + history
- src/todo.py        — TodoManager for managing todo items
- tests/             — pytest test suite

Use tools proactively to help the user. Show your reasoning. When asked to do
something that involves calculation, file reading, or code execution — use the
appropriate tool rather than just describing what you would do.

Be concise but thorough. Explain tool results when helpful."""

# ─── Database ─────────────────────────────────────────────────────────────────

async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id)
            )
        """)
        await db.commit()


async def db_get_conversations():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM conversations ORDER BY updated_at DESC"
        ) as cur:
            return [dict(r) for r in await cur.fetchall()]


async def db_get_messages(conv_id: str):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM messages WHERE conversation_id = ? ORDER BY id",
            (conv_id,),
        ) as cur:
            rows = await cur.fetchall()
    result = []
    for r in rows:
        m = dict(r)
        m["content"] = json.loads(m["content"])
        result.append(m)
    return result


async def db_save_conversation(conv_id: str, title: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT OR REPLACE INTO conversations (id, title, updated_at) "
            "VALUES (?, ?, CURRENT_TIMESTAMP)",
            (conv_id, title),
        )
        await db.commit()


async def db_append_message(conv_id: str, role: str, content):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)",
            (conv_id, role, json.dumps(content)),
        )
        await db.execute(
            "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (conv_id,),
        )
        await db.commit()


async def db_delete_conversation(conv_id: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM messages WHERE conversation_id = ?", (conv_id,))
        await db.execute("DELETE FROM conversations WHERE id = ?", (conv_id,))
        await db.commit()


# ─── Tools ────────────────────────────────────────────────────────────────────

# Per-conversation state (in-memory; resets on server restart)
_calculators: dict[str, object] = {}
_todos: dict[str, object] = {}


def tool_definitions() -> list[dict]:
    return [
        {
            "name": "calculator",
            "description": (
                "Perform arithmetic using the project's Calculator class. "
                "Keeps a running history of all operations."
            ),
            "input_schema": {
                "type": "object",
                "properties": {
                    "operation": {
                        "type": "string",
                        "enum": ["add", "subtract", "multiply", "divide", "history", "clear_history"],
                    },
                    "a": {"type": "number", "description": "First operand"},
                    "b": {"type": "number", "description": "Second operand"},
                },
                "required": ["operation"],
            },
        },
        {
            "name": "todo",
            "description": "Manage a todo list using the project's TodoManager class.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["add", "complete", "remove", "list", "pending", "summary"],
                    },
                    "title": {"type": "string", "description": "Item title (for add/complete/remove)"},
                    "tags": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Optional tags (for add)",
                    },
                },
                "required": ["action"],
            },
        },
        {
            "name": "read_file",
            "description": "Read any file in the TestClaude project.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Path relative to project root, e.g. 'src/calculator.py'",
                    }
                },
                "required": ["path"],
            },
        },
        {
            "name": "list_files",
            "description": "List files in the TestClaude project.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "directory": {
                        "type": "string",
                        "description": "Sub-directory to list (default: project root)",
                    }
                },
            },
        },
        {
            "name": "run_code",
            "description": (
                "Execute Python code and return stdout/stderr. "
                "Has access to the project's src/ modules. 10-second timeout."
            ),
            "input_schema": {
                "type": "object",
                "properties": {
                    "code": {"type": "string", "description": "Python code to run"}
                },
                "required": ["code"],
            },
        },
    ]


async def execute_tool(name: str, inp: dict, conv_id: str) -> str:
    sys.path.insert(0, str(PROJECT_ROOT))

    if name == "calculator":
        from src.calculator import Calculator

        if conv_id not in _calculators:
            _calculators[conv_id] = Calculator()
        calc = _calculators[conv_id]
        op, a, b = inp.get("operation"), inp.get("a"), inp.get("b")

        if op == "add":
            return str(calc.add(a, b))
        if op == "subtract":
            return str(calc.subtract(a, b))
        if op == "multiply":
            return str(calc.multiply(a, b))
        if op == "divide":
            try:
                return str(calc.divide(a, b))
            except ValueError as e:
                return f"Error: {e}"
        if op == "history":
            h = calc.get_history()
            return "\n".join(h) if h else "(no history yet)"
        if op == "clear_history":
            calc.clear_history()
            return "History cleared."

    elif name == "todo":
        from src.todo import TodoManager

        if conv_id not in _todos:
            _todos[conv_id] = TodoManager()
        mgr = _todos[conv_id]
        action = inp.get("action")
        title = inp.get("title", "")
        tags = inp.get("tags") or []

        if action == "add":
            mgr.add(title, tags=tags if tags else None)
            return f"Added: '{title}'"
        if action == "complete":
            return f"Completed: '{title}'" if mgr.complete(title) else f"Not found: '{title}'"
        if action == "remove":
            return f"Removed: '{title}'" if mgr.remove(title) else f"Not found: '{title}'"
        if action == "list":
            return str(mgr) if mgr.all_items() else "(empty list)"
        if action == "pending":
            items = mgr.pending()
            return "\n".join(str(i) for i in items) if items else "(nothing pending)"
        if action == "summary":
            return mgr.summary()

    elif name == "read_file":
        path = inp.get("path", "")
        target = (PROJECT_ROOT / path).resolve()
        if not str(target).startswith(str(PROJECT_ROOT)):
            return "Error: path outside project"
        if not target.exists():
            return f"Error: '{path}' not found"
        if target.stat().st_size > 100_000:
            return "Error: file too large (>100 KB)"
        return target.read_text()

    elif name == "list_files":
        directory = inp.get("directory", "")
        target = (PROJECT_ROOT / directory).resolve() if directory else PROJECT_ROOT
        if not str(target).startswith(str(PROJECT_ROOT)):
            return "Error: path outside project"
        if not target.exists():
            return "Error: directory not found"
        files = sorted(
            str(p.relative_to(PROJECT_ROOT))
            for p in target.rglob("*")
            if p.is_file()
            and "__pycache__" not in str(p)
            and ".git" not in str(p)
        )
        return "\n".join(files) if files else "(empty)"

    elif name == "run_code":
        code = inp.get("code", "")
        preamble = "import sys; sys.path.insert(0, '.')\n"

        def _run():
            return subprocess.run(
                [sys.executable, "-c", preamble + code],
                capture_output=True,
                text=True,
                timeout=10,
                cwd=str(PROJECT_ROOT),
            )

        try:
            result = await asyncio.to_thread(_run)
            out = result.stdout
            if result.stderr:
                out += f"\n[stderr]\n{result.stderr}"
            return out.strip() or "(no output)"
        except subprocess.TimeoutExpired:
            return "Error: timed out after 10 seconds"
        except Exception as e:
            return f"Error: {e}"

    return f"Unknown tool: {name}"


# ─── Agent Loop ───────────────────────────────────────────────────────────────

async def run_agent(
    messages: list, conv_id: str
) -> AsyncGenerator[str, None]:
    """
    Agentic loop: stream Claude's response, execute any tool calls,
    feed results back, repeat until stop_reason == 'end_turn'.
    Yields SSE-formatted strings.
    """
    tools = tool_definitions()

    while True:
        async with client.messages.stream(
            model=MODEL,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=messages,
            tools=tools,
        ) as stream:
            async for event in stream:
                etype = event.type

                if etype == "content_block_start":
                    block = event.content_block
                    if block.type == "tool_use":
                        yield _sse(
                            {"type": "tool_start", "id": block.id, "name": block.name}
                        )

                elif etype == "content_block_delta":
                    delta = event.delta
                    if delta.type == "text_delta":
                        yield _sse({"type": "text", "content": delta.text})

            final = await stream.get_final_message()

        # Build assistant content for history
        assistant_content = []
        for block in final.content:
            if block.type == "text":
                assistant_content.append({"type": "text", "text": block.text})
            elif block.type == "tool_use":
                assistant_content.append(
                    {
                        "type": "tool_use",
                        "id": block.id,
                        "name": block.name,
                        "input": dict(block.input) if block.input else {},
                    }
                )

        messages.append({"role": "assistant", "content": assistant_content})
        await db_append_message(conv_id, "assistant", assistant_content)

        if final.stop_reason != "tool_use":
            yield _sse({"type": "done"})
            break

        # Execute tools and loop
        tool_results = []
        for block in final.content:
            if block.type != "tool_use":
                continue
            tool_input = dict(block.input) if block.input else {}
            result = await execute_tool(block.name, tool_input, conv_id)
            yield _sse(
                {
                    "type": "tool_result",
                    "id": block.id,
                    "name": block.name,
                    "result": str(result)[:3000],
                }
            )
            tool_results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": str(result),
                }
            )

        messages.append({"role": "user", "content": tool_results})
        await db_append_message(conv_id, "tool_results", tool_results)


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


# ─── FastAPI ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Claude Demo", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None


@app.post("/api/chat")
async def chat(req: ChatRequest):
    conv_id = req.conversation_id or str(uuid.uuid4())

    stored = await db_get_messages(conv_id)
    if not stored:
        await db_save_conversation(conv_id, req.message[:70])
        messages = []
    else:
        messages = []
        for m in stored:
            if m["role"] in ("user", "assistant"):
                messages.append({"role": m["role"], "content": m["content"]})
            elif m["role"] == "tool_results":
                messages.append({"role": "user", "content": m["content"]})

    user_content = [{"type": "text", "text": req.message}]
    messages.append({"role": "user", "content": user_content})
    await db_append_message(conv_id, "user", user_content)

    async def event_stream():
        yield _sse({"type": "conv_id", "id": conv_id})
        async for chunk in run_agent(messages, conv_id):
            yield chunk

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/conversations")
async def list_conversations():
    return await db_get_conversations()


@app.get("/api/conversations/{conv_id}/messages")
async def get_messages_route(conv_id: str):
    msgs = await db_get_messages(conv_id)
    if not msgs:
        raise HTTPException(status_code=404, detail="Not found")
    return msgs


@app.delete("/api/conversations/{conv_id}")
async def delete_conv(conv_id: str):
    await db_delete_conversation(conv_id)
    return {"ok": True}
