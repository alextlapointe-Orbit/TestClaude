import { useState } from 'react'
import Landing from './components/Landing.jsx'
import ModuleGrid from './components/ModuleGrid.jsx'
import LessonView from './components/LessonView.jsx'
import { MODULES } from './data/curriculum.js'

export default function App() {
  const [view, setView] = useState('landing') // 'landing' | 'modules' | 'lesson'
  const [activeModule, setActiveModule] = useState(null)
  const [activeLesson, setActiveLesson] = useState(null)
  const [completed, setCompleted] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('claude101_progress') || '{}')
    } catch {
      return {}
    }
  })

  const markComplete = (lessonId) => {
    const next = { ...completed, [lessonId]: true }
    setCompleted(next)
    localStorage.setItem('claude101_progress', JSON.stringify(next))
  }

  const totalLessons = MODULES.reduce((s, m) => s + m.lessons.length, 0)
  const completedCount = Object.keys(completed).length

  const goToLesson = (mod, lesson) => {
    setActiveModule(mod)
    setActiveLesson(lesson)
    setView('lesson')
    window.scrollTo(0, 0)
  }

  if (view === 'landing') {
    return (
      <Landing
        modules={MODULES}
        onStart={() => setView('modules')}
        onSelectLesson={goToLesson}
        completedCount={completedCount}
        totalLessons={totalLessons}
      />
    )
  }

  if (view === 'modules') {
    return (
      <ModuleGrid
        modules={MODULES}
        completed={completed}
        onSelect={goToLesson}
        onBack={() => setView('landing')}
        completedCount={completedCount}
        totalLessons={totalLessons}
      />
    )
  }

  return (
    <LessonView
      module={activeModule}
      lesson={activeLesson}
      modules={MODULES}
      completed={completed}
      onComplete={markComplete}
      onSelectLesson={goToLesson}
      onBack={() => setView('modules')}
    />
  )
}
