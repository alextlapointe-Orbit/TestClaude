import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar.jsx'
import ChatPanel from './components/ChatPanel.jsx'

export default function App() {
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState(null)

  const loadConversations = async () => {
    try {
      const res = await fetch('/api/conversations')
      setConversations(await res.json())
    } catch {
      // backend not running yet
    }
  }

  useEffect(() => {
    loadConversations()
  }, [])

  const handleDelete = async (id) => {
    await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
    if (activeId === id) setActiveId(null)
    loadConversations()
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0a]">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onNew={() => setActiveId(null)}
        onSelect={setActiveId}
        onDelete={handleDelete}
      />
      <ChatPanel
        key={activeId ?? '__new__'}
        conversationId={activeId}
        onConversationCreated={(id) => {
          setActiveId(id)
          loadConversations()
        }}
      />
    </div>
  )
}
