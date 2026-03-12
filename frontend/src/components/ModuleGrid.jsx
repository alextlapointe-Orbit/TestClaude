export default function ModuleGrid({ modules, completed, onSelect, onBack, completedCount, totalLessons }) {
  const pct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100">
      {/* Nav */}
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center gap-4 sticky top-0 bg-[#0a0a0a]/95 backdrop-blur z-10">
        <button onClick={onBack} className="text-gray-400 hover:text-white text-sm transition-colors">
          ← Home
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#e8692a] rounded-lg flex items-center justify-center font-bold text-xs">C</div>
          <span className="font-semibold text-sm">Claude Code 101</span>
        </div>
        <div className="ml-auto text-xs text-gray-500">{completedCount}/{totalLessons} completed</div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-2">All Modules</h1>
          <p className="text-gray-400">Choose a module to start — or pick up where you left off.</p>

          {completedCount > 0 && (
            <div className="mt-4 flex items-center gap-4">
              <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden max-w-xs">
                <div
                  className="h-full bg-[#e8692a] rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">{pct}% complete</span>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {modules.map((mod, modIdx) => {
            const modCompleted = mod.lessons.filter((l) => completed[l.id]).length
            const allDone = modCompleted === mod.lessons.length

            return (
              <div
                key={mod.id}
                className="rounded-2xl border border-gray-800 bg-gray-900/40 overflow-hidden"
              >
                {/* Module header */}
                <div className="px-6 py-5 flex items-center gap-4">
                  <span className="text-3xl">{mod.emoji}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs text-gray-500">Module {modIdx + 1}</span>
                      {allDone && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-400 border border-green-800/40">
                          ✓ Complete
                        </span>
                      )}
                    </div>
                    <h2 className="font-semibold">{mod.title}</h2>
                    <p className="text-sm text-gray-500 mt-0.5">{mod.description}</p>
                  </div>
                  <div className="text-right text-xs text-gray-500 flex-shrink-0">
                    <div
                      className="font-semibold"
                      style={{ color: modCompleted > 0 ? mod.color : undefined }}
                    >
                      {modCompleted}/{mod.lessons.length}
                    </div>
                    <div>lessons</div>
                  </div>
                </div>

                {/* Lessons */}
                <div className="border-t border-gray-800 divide-y divide-gray-800/50">
                  {mod.lessons.map((lesson, lessonIdx) => {
                    const done = completed[lesson.id]
                    return (
                      <button
                        key={lesson.id}
                        onClick={() => onSelect(mod, lesson)}
                        className="w-full text-left px-6 py-4 flex items-center gap-4 hover:bg-gray-800/40 transition-colors group"
                      >
                        <div
                          className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all"
                          style={{
                            borderColor: done ? mod.color : '#374151',
                            background: done ? mod.color : 'transparent',
                            color: done ? '#fff' : '#6b7280',
                          }}
                        >
                          {done ? '✓' : lessonIdx + 1}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium group-hover:text-white transition-colors">
                            {lesson.title}
                          </div>
                          <div className="text-xs text-gray-600 mt-0.5">
                            {lesson.duration} · Live demo + exercise
                          </div>
                        </div>
                        <span className="text-gray-600 group-hover:text-gray-300 transition-colors text-sm">→</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
