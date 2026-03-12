export default function Sidebar({ conversations, activeId, onNew, onSelect, onDelete }) {
  return (
    <div className="w-64 flex-shrink-0 bg-[#111111] border-r border-gray-800 flex flex-col h-screen">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 bg-[#e8692a] rounded-lg flex items-center justify-center text-xs font-bold">C</div>
          <span className="font-semibold text-sm">Claude Demo</span>
        </div>
        <button
          onClick={onNew}
          className="w-full py-2 px-3 bg-[#e8692a] hover:bg-orange-400 rounded-lg text-sm font-medium transition-colors text-center"
        >
          + New Chat
        </button>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
        {conversations.length === 0 && (
          <p className="text-gray-600 text-xs text-center mt-6 px-4">
            Start a conversation to see it here
          </p>
        )}
        {conversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`group flex items-center justify-between gap-1 px-3 py-2.5 rounded-lg cursor-pointer mb-0.5 transition-colors ${
              activeId === conv.id
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
            }`}
          >
            <span className="text-xs truncate flex-1 leading-snug">{conv.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(conv.id)
              }}
              className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 text-xs w-4 h-4 flex items-center justify-center flex-shrink-0 transition-all"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-800">
        <p className="text-xs text-gray-600 text-center">Powered by Claude API</p>
      </div>
    </div>
  )
}
