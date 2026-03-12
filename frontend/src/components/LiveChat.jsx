import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

// ─── Sub-components ────────────────────────────────────────────────────────

function ToolBlock({ block }) {
  const [open, setOpen] = useState(false)
  const icons = { calculator: '🔢', todo: '📝', read_file: '📖', list_files: '📂', run_code: '▶️' }
  const icon = icons[block.name] || '🔧'
  return (
    <div className="my-3 rounded-xl border border-gray-700 overflow-hidden text-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-gray-800/60 hover:bg-gray-800 text-left transition-colors"
      >
        <span className="text-base">{icon}</span>
        <span className="font-mono text-gray-300">Tool called: <strong className="text-white">{block.name}</strong></span>
        {block.result !== null
          ? <span className="ml-auto text-green-400 text-xs font-semibold">✓ Result ready</span>
          : <span className="ml-auto text-yellow-400 text-xs animate-pulse">⟳ Running…</span>}
        <span className="text-gray-600 text-xs ml-2">{open ? '▲ hide' : '▼ show'}</span>
      </button>
      {open && block.result !== null && (
        <pre className="px-4 py-3 bg-gray-950 text-gray-300 font-mono text-xs overflow-x-auto whitespace-pre-wrap max-h-60 leading-relaxed">
          {typeof block.result === 'string' ? block.result : JSON.stringify(block.result, null, 2)}
        </pre>
      )}
    </div>
  )
}

function RichText({ text }) {
  const parts = []
  let key = 0
  const codeBlockRe = /```(\w*)\n?([\s\S]*?)```/g
  let lastIdx = 0
  let m
  while ((m = codeBlockRe.exec(text)) !== null) {
    if (m.index > lastIdx) parts.push(<InlineText key={key++} text={text.slice(lastIdx, m.index)} />)
    parts.push(
      <pre key={key++} className="my-4 p-4 bg-gray-950 border border-gray-700 rounded-xl overflow-x-auto text-sm font-mono text-gray-200 leading-relaxed">
        <code>{m[2].trim()}</code>
      </pre>
    )
    lastIdx = m.index + m[0].length
  }
  if (lastIdx < text.length) parts.push(<InlineText key={key++} text={text.slice(lastIdx)} />)
  return parts.length > 0 ? <>{parts}</> : <InlineText text={text} />
}

function InlineText({ text }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/)
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('`') && p.endsWith('`'))
          return <code key={i} className="px-1.5 py-0.5 bg-gray-800 rounded text-[#e8692a] font-mono text-sm">{p.slice(1, -1)}</code>
        if (p.startsWith('**') && p.endsWith('**'))
          return <strong key={i} className="font-semibold text-white">{p.slice(2, -2)}</strong>
        return <span key={i}>{p}</span>
      })}
    </>
  )
}

function MessageBubble({ msg }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end mb-6">
        <div className="max-w-2xl px-5 py-4 rounded-2xl bg-[#e8692a]/15 border border-[#e8692a]/25 text-base leading-relaxed whitespace-pre-wrap text-gray-100">
          {msg.content}
        </div>
      </div>
    )
  }
  return (
    <div className="flex gap-4 mb-6">
      <div className="w-9 h-9 bg-[#e8692a] rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">C</div>
      <div className="flex-1 min-w-0">
        {(msg.blocks || []).map((b, i) => {
          if (b.type === 'text')
            return <div key={i} className="text-base leading-relaxed text-gray-200"><RichText text={b.text} /></div>
          if (b.type === 'tool_call')
            return <ToolBlock key={i} block={b} />
          return null
        })}
        {msg.streaming && <span className="inline-block w-2.5 h-5 bg-[#e8692a] rounded-sm animate-pulse ml-1" />}
        {msg.error && (
          <div className="mt-3 text-sm text-red-400 bg-red-900/20 border border-red-800/30 rounded-xl px-4 py-3">
            ⚠️ {msg.error}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Chat logic hook ───────────────────────────────────────────────────────

function useChat() {
  const [messages, setMessages] = useState([])
  const [streaming, setStreaming] = useState(false)
  const [convId, setConvId] = useState(null)

  const send = async (text) => {
    text = text.trim()
    if (!text || streaming) return
    setStreaming(true)
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
          if (event.type === 'conv_id' && !convId) setConvId(event.id)
          else if (event.type === 'text') {
            updateLast((last) => {
              const blocks = [...(last.blocks ?? [])]
              const tail = blocks[blocks.length - 1]
              if (tail?.type === 'text') blocks[blocks.length - 1] = { ...tail, text: tail.text + event.content }
              else blocks.push({ type: 'text', text: event.content })
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
        msgs[msgs.length - 1] = { role: 'assistant', blocks: [{ type: 'text', text: '' }], error: err.message, streaming: false }
        return msgs
      })
    } finally {
      setStreaming(false)
    }
  }

  return { messages, streaming, send }
}

// ─── Modal chat window ─────────────────────────────────────────────────────

function ChatModal({ title, isDemo, messages, streaming, onSend, onClose }) {
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Prevent body scroll while modal open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const submit = () => {
    if (!input.trim() || streaming) return
    onSend(input)
    setInput('')
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="flex flex-col bg-[#111] border border-gray-700 rounded-2xl shadow-2xl w-full"
        style={{ maxWidth: '860px', height: '85vh', maxHeight: '900px' }}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#e8692a] rounded-xl flex items-center justify-center font-bold text-sm">C</div>
            <div>
              <div className="font-semibold text-sm">{title}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-gray-500 font-mono">claude-opus-4-6 · Live streaming</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {streaming && <span className="text-sm text-[#e8692a] animate-pulse font-medium">Generating…</span>}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center text-lg transition-colors"
            >
              ×
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-thin">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="text-5xl">⟳</div>
              <p className="text-gray-500">Starting…</p>
            </div>
          ) : (
            messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-800 px-6 py-4 flex-shrink-0">
          {messages.length > 0 && !streaming && (
            <p className="text-xs text-gray-600 mb-3 text-center">
              Follow up — ask a question, request a change, or try a variation
            </p>
          )}
          <div className="flex gap-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={isDemo ? 'Ask a follow-up or try a variation… (Enter to send)' : 'Type your message… (Enter to send)'}
              rows={2}
              disabled={streaming}
              className="flex-1 bg-gray-900 border border-gray-700 focus:border-[#e8692a] rounded-xl px-4 py-3 text-base resize-none outline-none transition-colors disabled:opacity-50 text-gray-200 placeholder-gray-600 leading-relaxed"
            />
            <button
              onClick={submit}
              disabled={streaming || !input.trim()}
              className="px-5 bg-[#e8692a] hover:bg-orange-400 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl text-xl font-bold transition-colors flex-shrink-0"
            >
              {streaming
                ? <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : '↑'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Main exported component ───────────────────────────────────────────────

export default function LiveChat({ initialPrompt, demoLabel, placeholder, isDemo }) {
  const { messages, streaming, send } = useChat()
  const [modalOpen, setModalOpen] = useState(false)
  const hasRun = messages.length > 0

  const openAndRun = () => {
    setModalOpen(true)
    if (!hasRun && initialPrompt) {
      send(initialPrompt)
    }
  }

  const openExisting = () => setModalOpen(true)

  if (isDemo) {
    // Demo mode: compact launch card
    return (
      <>
        <div className="rounded-2xl border border-gray-700 bg-gray-900/60 overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#e8692a]/15 border border-[#e8692a]/20 flex items-center justify-center text-xl flex-shrink-0">
                {hasRun ? '✅' : '▶'}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-200">
                  {hasRun ? 'Demo complete — click to review' : (demoLabel || 'Live Claude Demo')}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {hasRun
                    ? `${messages.filter(m => m.role === 'assistant').length} response(s) · Opens in full view`
                    : 'Opens in a large window · Real Claude API · Streaming'}
                </p>
              </div>
            </div>
            <button
              onClick={hasRun ? openExisting : openAndRun}
              className="flex-shrink-0 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all"
              style={hasRun
                ? { background: 'transparent', border: '1px solid #e8692a', color: '#e8692a' }
                : { background: '#e8692a', color: '#fff' }}
            >
              {hasRun ? '↗ View Demo' : '▶ Run Demo'}
            </button>
          </div>
          {hasRun && (
            <div className="border-t border-gray-800 px-5 py-3 bg-gray-900/40">
              <p className="text-xs text-gray-500">
                💡 The demo ran successfully. Reopen it to read the full response or ask follow-up questions.
              </p>
            </div>
          )}
        </div>

        {modalOpen && (
          <ChatModal
            title={demoLabel || 'Live Demo'}
            isDemo
            messages={messages}
            streaming={streaming}
            onSend={send}
            onClose={() => setModalOpen(false)}
          />
        )}
      </>
    )
  }

  // Exercise mode: compact launch card (no auto-prompt)
  return (
    <>
      <div className="rounded-2xl border border-gray-700 bg-gray-900/60 overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-900/30 border border-purple-800/30 flex items-center justify-center text-xl flex-shrink-0">
              {hasRun ? '✅' : '✋'}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-200">
                {hasRun ? 'Exercise in progress — click to continue' : 'Open exercise sandbox'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {hasRun
                  ? `${messages.filter(m => m.role === 'user').length} message(s) sent`
                  : 'Your own conversation with Claude · Full screen · No limits'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex-shrink-0 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all border border-purple-700 text-purple-400 hover:bg-purple-900/20"
          >
            {hasRun ? '↗ Continue' : '✋ Try It'}
          </button>
        </div>
      </div>

      {modalOpen && (
        <ChatModal
          title="Exercise — Try It Yourself"
          isDemo={false}
          messages={messages}
          streaming={streaming}
          onSend={send}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}
