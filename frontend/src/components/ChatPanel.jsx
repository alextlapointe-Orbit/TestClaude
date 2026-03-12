import { useState, useEffect, useRef } from 'react'
import Message from './Message.jsx'

const STARTER_PROMPTS = [
  'Calculate 15% tip on a $47.50 bill',
  'Read src/calculator.py and explain the divide method',
  'Add "Learn FastAPI" and "Build a React app" to my todo list',
  'Run Python to generate the first 10 Fibonacci numbers',
  'List all project files, then read the README',
  'Use the calculator to compute (144 / 12) * 7, then show history',
]

export default function ChatPanel({ conversationId, onConversationCreated }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  // Load existing conversation
  useEffect(() => {
    if (!conversationId) {
      setMessages([])
      return
    }
    fetch(`/api/conversations/${conversationId}/messages`)
      .then((r) => r.json())
      .then((stored) => {
        const display = []
        for (const m of stored) {
          if (m.role === 'user') {
            const text = Array.isArray(m.content)
              ? (m.content.find((b) => b.type === 'text')?.text ?? '')
              : m.content
            display.push({ role: 'user', content: text })
          } else if (m.role === 'assistant') {
            display.push({ role: 'assistant', blocks: m.content })
          }
          // skip tool_results rows (results shown inline via tool_use blocks)
        }
        setMessages(display)
      })
      .catch(() => setMessages([]))
  }, [conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (text) => {
    text = (text ?? input).trim()
    if (!text || streaming) return
    setInput('')
    setStreaming(true)

    // Optimistically add user + empty assistant
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: text },
      { role: 'assistant', blocks: [], streaming: true },
    ])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversation_id: conversationId }),
      })

      if (!res.ok) {
        const err = await res.text()
        throw new Error(err)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      const updateLast = (updater) =>
        setMessages((prev) => {
          const msgs = [...prev]
          msgs[msgs.length - 1] = updater(msgs[msgs.length - 1])
          return msgs
        })

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() // hold incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          let event
          try {
            event = JSON.parse(line.slice(6))
          } catch {
            continue
          }

          if (event.type === 'conv_id' && !conversationId) {
            onConversationCreated(event.id)
          }

          else if (event.type === 'text') {
            updateLast((last) => {
              const blocks = [...(last.blocks ?? [])]
              const tail = blocks[blocks.length - 1]
              if (tail?.type === 'text') {
                blocks[blocks.length - 1] = { ...tail, text: tail.text + event.content }
              } else {
                blocks.push({ type: 'text', text: event.content })
              }
              return { ...last, blocks }
            })
          }

          else if (event.type === 'tool_start') {
            updateLast((last) => ({
              ...last,
              blocks: [
                ...(last.blocks ?? []),
                { type: 'tool_call', id: event.id, name: event.name, result: null },
              ],
            }))
          }

          else if (event.type === 'tool_result') {
            updateLast((last) => ({
              ...last,
              blocks: (last.blocks ?? []).map((b) =>
                b.type === 'tool_call' && b.id === event.id
                  ? { ...b, result: event.result }
                  : b
              ),
            }))
          }

          else if (event.type === 'done') {
            updateLast((last) => ({ ...last, streaming: false }))
          }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const msgs = [...prev]
        msgs[msgs.length - 1] = {
          role: 'assistant',
          blocks: [{ type: 'text', text: '' }],
          error: err.message,
          streaming: false,
        }
        return msgs
      })
    } finally {
      setStreaming(false)
      textareaRef.current?.focus()
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-800 px-6 py-3 flex items-center gap-3 bg-[#0a0a0a]">
        <div className="w-8 h-8 bg-[#e8692a] rounded-xl flex items-center justify-center text-sm font-bold">C</div>
        <div>
          <h1 className="font-semibold text-sm">Claude Demo</h1>
          <p className="text-xs text-gray-500">Streaming · Tool Use · Agentic Loop</p>
        </div>
        <div className="ml-auto flex gap-2 text-xs text-gray-600">
          <span className="px-2 py-1 rounded-md bg-gray-900 border border-gray-800">claude-opus-4-6</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin py-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 px-6 text-center">
            <div className="w-16 h-16 bg-[#e8692a]/20 rounded-2xl flex items-center justify-center text-3xl">
              🤖
            </div>
            <div>
              <h2 className="text-lg font-semibold mb-1">What can Claude do?</h2>
              <p className="text-gray-500 text-sm max-w-sm">
                This demo showcases streaming, tool use, and agentic loops — all powered by the Anthropic API.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
              {STARTER_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="text-left p-3 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-600 text-xs text-gray-300 transition-colors leading-snug"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => <Message key={i} message={msg} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-gray-800 px-4 py-4 bg-[#0a0a0a]">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Message Claude… (Enter to send, Shift+Enter for newline)"
            rows={1}
            disabled={streaming}
            className="flex-1 bg-gray-900 border border-gray-700 focus:border-[#e8692a] rounded-xl px-4 py-3 text-sm resize-none outline-none transition-colors disabled:opacity-50 leading-relaxed"
          />
          <button
            onClick={() => send()}
            disabled={streaming || !input.trim()}
            className="px-4 py-3 bg-[#e8692a] hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-bold transition-colors"
          >
            {streaming ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              '↑'
            )}
          </button>
        </div>
        <p className="text-xs text-gray-700 text-center mt-2">
          Tool calls are shown inline · Results stream in real time
        </p>
      </div>
    </div>
  )
}
