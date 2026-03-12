import { useState } from 'react'

const TOOL_ICONS = {
  calculator: '🧮',
  todo: '📋',
  read_file: '📄',
  list_files: '🗂',
  run_code: '⚡',
}

function ToolBlock({ block }) {
  const [open, setOpen] = useState(true)
  const icon = TOOL_ICONS[block.name] ?? '🔧'
  const running = block.result === null || block.result === undefined

  return (
    <div className="rounded-lg border border-amber-800/40 bg-amber-950/30 overflow-hidden text-xs my-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-amber-950/50 transition-colors"
      >
        <span>{icon}</span>
        <span className="font-mono text-amber-300 font-medium">{block.name}</span>
        {running ? (
          <span className="ml-auto text-amber-600 animate-pulse">running…</span>
        ) : (
          <span className="ml-auto text-gray-500">{open ? '▲' : '▼'}</span>
        )}
      </button>

      {open && !running && (
        <div className="px-3 pb-2 border-t border-amber-800/30 pt-2">
          <pre className="text-green-300 whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto scrollbar-thin">
            {block.result}
          </pre>
        </div>
      )}
    </div>
  )
}

export default function Message({ message }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end px-4">
        <div className="max-w-[78%] bg-[#e8692a] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed">
          {message.content}
        </div>
      </div>
    )
  }

  // Assistant
  return (
    <div className="flex gap-3 px-4 max-w-[90%]">
      <div className="w-6 h-6 bg-[#e8692a] rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5">
        C
      </div>
      <div className="flex-1 min-w-0">
        {(message.blocks ?? []).map((block, i) => {
          if (block.type === 'text' || block.type === undefined) {
            return (
              <p
                key={i}
                className="text-sm text-gray-100 leading-relaxed whitespace-pre-wrap"
              >
                {block.text ?? block}
                {message.streaming && i === (message.blocks?.length ?? 1) - 1 && (
                  <span className="inline-block w-1.5 h-[1em] bg-[#e8692a] ml-0.5 animate-pulse align-middle rounded-sm" />
                )}
              </p>
            )
          }
          if (block.type === 'tool_use' || block.type === 'tool_call') {
            return <ToolBlock key={i} block={block} />
          }
          return null
        })}
        {message.streaming && (!message.blocks || message.blocks.length === 0) && (
          <span className="inline-block w-1.5 h-4 bg-[#e8692a] animate-pulse rounded-sm" />
        )}
        {message.error && (
          <p className="text-red-400 text-sm">Error: {message.error}</p>
        )}
      </div>
    </div>
  )
}
