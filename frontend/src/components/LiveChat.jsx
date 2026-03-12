import { useState, useRef, useEffect } from 'react'

function ToolBlock({ block }) {
  const [open, setOpen] = useState(false)
  const icons = {
    calculator: '🔢',
    todo: '📝',
    read_file: '📖',
    list_files: '📂',
    run_code: '▶️',
  }
  const icon = icons[block.name] || '🔧'

  return (
    <div className="my-2 rounded-xl border border-gray-700 overflow-hidden text-xs">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-gray-800/60 hover:bg-gray-800 text-left transition-colors"
      >
        <span>{icon}</span>
        <span className="font-mono text-gray-300">Tool: {block.name}</span>
        {block.result !== null ? (
          <span className="ml-auto text-green-400 text-xs">✓ done</span>
        ) : (
          <span className="ml-auto text-yellow-400 text-xs animate-pulse">running…</span>
        )}
        <span className="text-gray-600">{open ? '▲' : '▼'}</span>
      </button>
      {open && block.result !== null && (
        <pre className="px-3 py-2 bg-gray-900 text-gray-400 font-mono text-xs overflow-x-auto whitespace-pre-wrap max-h-48">
          {typeof block.result === 'string' ? block.result : JSON.stringify(block.result, null, 2)}
        </pre>
      )}
    </div>
  )
}

function MessageBubble({ msg }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-2xl px-4 py-3 rounded-2xl bg-[#e8692a]/20 border border-[#e8692a]/30 text-sm leading-relaxed whitespace-pre-wrap">
          {msg.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3 mb-4">
      <div className="w-7 h-7 bg-[#e8692a] rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
        C
      </div>
      <div className="flex-1 min-w-0">
        {(msg.blocks || []).map((b, i) => {
          if (b.type === 'text') {
            return (
              <div key={i} className="text-sm leading-relaxed text-gray-200 whitespace-pre-wrap">
                <RichText text={b.text} />
              </div>
            )
          }
          if (b.type === 'tool_call') {
            return <ToolBlock key={i} block={b} />
          }
          return null
        })}
        {msg.streaming && (
          <span className="inline-block w-2 h-4 bg-[#e8692a] rounded-sm animate-pulse ml-0.5" />
        )}
        {msg.error && (
          <div className="mt-2 text-xs text-red-400 bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-2">
            ⚠️ {msg.error}
          </div>
        )}
      </div>
    </div>
  )
}

function RichText({ text }) {
  // Basic markdown: code blocks, inline code, bold
  const parts = []
  let remaining = text
  let key = 0

  // Split on code blocks first
  const codeBlockRe = /```(\w*)\n?([\s\S]*?)```/g
  let lastIdx = 0
  let m

  while ((m = codeBlockRe.exec(text)) !== null) {
    if (m.index > lastIdx) {
      parts.push(<InlineText key={key++} text={text.slice(lastIdx, m.index)} />)
    }
    parts.push(
      <pre key={key++} className="my-3 p-3 bg-gray-900 border border-gray-700 rounded-xl overflow-x-auto text-xs font-mono text-gray-300 leading-relaxed">
        <code>{m[2].trim()}</code>
      </pre>
    )
    lastIdx = m.index + m[0].length
  }

  if (lastIdx < text.length) {
    parts.push(<InlineText key={key++} text={text.slice(lastIdx)} />)
  }

  return parts.length > 0 ? <>{parts}</> : <InlineText text={text} />
}

function InlineText({ text }) {
  // bold and inline code
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/)
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('`') && p.endsWith('`')) {
          return <code key={i} className="px-1 py-0.5 bg-gray-800 rounded text-[#e8692a] font-mono text-xs">{p.slice(1, -1)}</code>
        }
        if (p.startsWith('**') && p.endsWith('**')) {
          return <strong key={i} className="font-semibold text-white">{p.slice(2, -2)}</strong>
        }
        return <span key={i}>{p}</span>
      })}
    </>
  )
}

export default function LiveChat({ initialPrompt, placeholder, onFirstMessage }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [convId, setConvId] = useState(null)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)
  const hasAutoRun = useRef(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (text) => {
    text = (text ?? input).trim()
    if (!text || streaming) return
    setInput('')
    setStreaming(true)
    if (onFirstMessage && messages.length === 0) onFirstMessage()

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: text },
      { role: 'assistant', blocks: [], streaming: true },
    ])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversation_id: convId }),
      })

      if (!res.ok) throw new Error(await res.text())

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      const updateLast = (fn) =>
        setMessages((prev) => {
          const msgs = [...prev]
          msgs[msgs.length - 1] = fn(msgs[msgs.length - 1])
          return msgs
        })

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          let event
          try { event = JSON.parse(line.slice(6)) } catch { continue }

          if (event.type === 'conv_id' && !convId) {
            setConvId(event.id)
          } else if (event.type === 'text') {
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
          } else if (event.type === 'tool_start') {
            updateLast((last) => ({
              ...last,
              blocks: [...(last.blocks ?? []), { type: 'tool_call', id: event.id, name: event.name, result: null }],
            }))
          } else if (event.type === 'tool_result') {
            updateLast((last) => ({
              ...last,
              blocks: (last.blocks ?? []).map((b) =>
                b.type === 'tool_call' && b.id === event.id ? { ...b, result: event.result } : b
              ),
            }))
          } else if (event.type === 'done') {
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

  const runDemo = () => {
    if (initialPrompt && !streaming) {
      send(initialPrompt)
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col rounded-2xl border border-gray-700 bg-[#0d0d0d] overflow-hidden">
      {/* Chat header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900/50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-gray-400 font-mono">claude-opus-4-6 · Live</span>
        </div>
        {streaming && (
          <span className="text-xs text-[#e8692a] animate-pulse">Generating…</span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 min-h-[200px] max-h-[500px] scrollbar-thin">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-8 text-center">
            <div className="text-4xl">💬</div>
            <p className="text-sm text-gray-500 max-w-xs">
              {initialPrompt
                ? 'Click "Run Demo" to see Claude respond live, or type your own message below.'
                : 'Type your message below to start the conversation.'}
            </p>
          </div>
        ) : (
          messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 p-3">
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder || 'Type your message… (Enter to send)'}
            rows={2}
            disabled={streaming}
            className="flex-1 bg-gray-800 border border-gray-700 focus:border-[#e8692a] rounded-xl px-3 py-2 text-sm resize-none outline-none transition-colors disabled:opacity-50 text-gray-200 placeholder-gray-600"
          />
          <div className="flex flex-col gap-2">
            {initialPrompt && isEmpty && (
              <button
                onClick={runDemo}
                disabled={streaming}
                className="px-3 py-2 bg-[#e8692a] hover:bg-orange-400 disabled:opacity-40 rounded-xl text-xs font-bold transition-colors whitespace-nowrap"
              >
                ▶ Run Demo
              </button>
            )}
            <button
              onClick={() => send()}
              disabled={streaming || !input.trim()}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl text-sm font-bold transition-colors"
            >
              {streaming ? (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : '↑'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
