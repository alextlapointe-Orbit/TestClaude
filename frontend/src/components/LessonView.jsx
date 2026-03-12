import { useState } from 'react'
import LiveChat from './LiveChat.jsx'

export default function LessonView({ module: mod, lesson, modules, completed, onComplete, onSelectLesson, onBack }) {
  const [demoStarted, setDemoStarted] = useState(false)
  const [exerciseKey, setExerciseKey] = useState(0)

  // Find next lesson
  const allLessons = modules.flatMap((m) => m.lessons.map((l) => ({ mod: m, lesson: l })))
  const currentIdx = allLessons.findIndex((x) => x.lesson.id === lesson.id)
  const next = allLessons[currentIdx + 1] || null
  const prev = allLessons[currentIdx - 1] || null

  const isDone = completed[lesson.id]

  const handleNext = () => {
    if (next) onSelectLesson(next.mod, next.lesson)
  }

  const handlePrev = () => {
    if (prev) onSelectLesson(prev.mod, prev.lesson)
  }

  // Reset demo/exercise chat when lesson changes
  const lessonKey = lesson.id

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 flex flex-col">
      {/* Nav */}
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center gap-4 sticky top-0 bg-[#0a0a0a]/95 backdrop-blur z-10">
        <button onClick={onBack} className="text-gray-400 hover:text-white text-sm transition-colors">
          ← Modules
        </button>
        <div className="flex items-center gap-2">
          <span className="text-lg">{mod.emoji}</span>
          <span className="font-semibold text-sm hidden sm:block">{mod.title}</span>
        </div>
        <span className="text-gray-600 text-sm hidden sm:block">›</span>
        <span className="text-sm text-gray-300 hidden sm:block truncate">{lesson.title}</span>
        {isDone && (
          <span className="ml-auto text-xs px-2 py-1 rounded-full bg-green-900/30 text-green-400 border border-green-800/30">
            ✓ Completed
          </span>
        )}
      </nav>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-72 border-r border-gray-800 p-4 sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto flex-shrink-0">
          {modules.map((m) => (
            <div key={m.id} className="mb-4">
              <div className="flex items-center gap-2 px-2 py-1 mb-1">
                <span className="text-base">{m.emoji}</span>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{m.title}</span>
              </div>
              {m.lessons.map((l, idx) => {
                const active = l.id === lesson.id
                const done = completed[l.id]
                return (
                  <button
                    key={l.id}
                    onClick={() => onSelectLesson(m, l)}
                    className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg mb-0.5 text-xs transition-all ${
                      active
                        ? 'bg-[#e8692a]/15 text-[#e8692a] border border-[#e8692a]/20'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                    }`}
                  >
                    <span
                      className="w-5 h-5 rounded-full border flex items-center justify-center text-xs flex-shrink-0"
                      style={{
                        borderColor: done ? m.color : active ? '#e8692a' : '#374151',
                        background: done ? m.color : 'transparent',
                        color: done ? '#fff' : active ? '#e8692a' : '#6b7280',
                      }}
                    >
                      {done ? '✓' : idx + 1}
                    </span>
                    <span className="truncate">{l.title}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </aside>

        {/* Main content */}
        <main className="flex-1 max-w-3xl mx-auto px-6 py-10 w-full">
          {/* Lesson header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <span style={{ color: mod.color }}>{mod.emoji} {mod.title}</span>
              <span>›</span>
              <span>Lesson {lesson.id}</span>
              <span>·</span>
              <span>{lesson.duration}</span>
            </div>
            <h1 className="text-3xl font-bold mb-3">{lesson.title}</h1>
          </div>

          {/* Concept card */}
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">📖</span>
              <h2 className="font-semibold text-lg">The Concept</h2>
            </div>
            <div className="p-5 rounded-2xl bg-gray-900 border border-gray-800">
              {lesson.concept.split('\n\n').map((para, i) => (
                <p key={i} className={`text-gray-300 leading-relaxed text-sm ${i > 0 ? 'mt-4' : ''}`}>
                  {para}
                </p>
              ))}
            </div>
          </section>

          {/* Key points */}
          <section className="mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {lesson.keyPoints.map((point, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl bg-gray-900/50 border border-gray-800 text-sm text-gray-300 leading-relaxed"
                >
                  {point}
                </div>
              ))}
            </div>
          </section>

          {/* Live Demo */}
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">👀</span>
              <h2 className="font-semibold text-lg">Live Demo</h2>
              <span className="text-xs px-2 py-1 rounded-full bg-green-900/30 text-green-400 border border-green-800/30">
                Real Claude · Real Response
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-gray-900 border border-gray-800 mb-3">
              <p className="text-sm text-gray-400 mb-1 font-medium">What we're demonstrating:</p>
              <p className="text-sm text-gray-300">{lesson.demoLabel}</p>
            </div>
            <LiveChat
              key={`demo-${lessonKey}`}
              initialPrompt={lesson.demoPrompt}
              placeholder="Or ask your own variation of this demo…"
            />
          </section>

          {/* Pro Tip */}
          {lesson.tip && (
            <div className="mb-8 flex gap-3 p-4 rounded-xl bg-[#e8692a]/5 border border-[#e8692a]/15">
              <span className="text-lg flex-shrink-0">💡</span>
              <div>
                <p className="text-xs font-semibold text-[#e8692a] mb-1">Pro Tip</p>
                <p className="text-sm text-gray-300 leading-relaxed">{lesson.tip}</p>
              </div>
            </div>
          )}

          {/* Exercise */}
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">✋</span>
              <h2 className="font-semibold text-lg">Your Turn</h2>
              <span className="text-xs px-2 py-1 rounded-full bg-purple-900/30 text-purple-400 border border-purple-800/30">
                Exercise
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-gray-900 border border-gray-800 mb-3">
              <p className="text-sm text-gray-300 leading-relaxed">{lesson.exercise}</p>
              {lesson.exerciseStarter && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <p className="text-xs text-gray-500 mb-2">Starter template (edit to fit your needs):</p>
                  <pre className="text-xs text-gray-400 font-mono bg-gray-800 p-3 rounded-lg whitespace-pre-wrap leading-relaxed">
                    {lesson.exerciseStarter}
                  </pre>
                </div>
              )}
            </div>
            <LiveChat
              key={`exercise-${lessonKey}-${exerciseKey}`}
              placeholder="Write your prompt here… (Enter to send)"
            />
          </section>

          {/* Mark complete + navigation */}
          <div className="border-t border-gray-800 pt-8 flex flex-col gap-4">
            {!isDone && (
              <button
                onClick={() => onComplete(lesson.id)}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all border-2"
                style={{
                  borderColor: mod.color,
                  color: mod.color,
                  background: 'transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = mod.color
                  e.currentTarget.style.color = '#fff'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = mod.color
                }}
              >
                ✓ Mark as Complete
              </button>
            )}

            <div className="flex gap-3">
              <button
                onClick={handlePrev}
                disabled={!prev}
                className="flex-1 py-3 rounded-xl font-medium text-sm bg-gray-900 border border-gray-700 hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ← Previous
              </button>
              <button
                onClick={handleNext}
                disabled={!next}
                className="flex-1 py-3 rounded-xl font-semibold text-sm bg-[#e8692a] hover:bg-orange-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                {next ? `Next: ${next.lesson.title} →` : 'Course Complete! 🎉'}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
