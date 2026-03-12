export default function Landing({ modules, onStart, onSelectLesson, completedCount, totalLessons }) {
  const pct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100">
      {/* Nav */}
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 bg-[#0a0a0a]/95 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#e8692a] rounded-lg flex items-center justify-center font-bold text-sm">C</div>
          <span className="font-semibold text-sm">Claude Code 101</span>
        </div>
        {completedCount > 0 && (
          <span className="text-xs text-gray-400">{completedCount}/{totalLessons} lessons completed</span>
        )}
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e8692a]/10 border border-[#e8692a]/20 text-[#e8692a] text-xs font-medium mb-8">
          ✨ Free · Interactive · Hands-on
        </div>
        <h1 className="text-5xl font-bold mb-6 leading-tight">
          Learn Claude Code<br />
          <span className="text-[#e8692a]">from zero to productive</span>
        </h1>
        <p className="text-xl text-gray-400 mb-4 max-w-2xl mx-auto leading-relaxed">
          A step-by-step interactive course for non-developers. Every lesson includes a live demo powered by real Claude AI — you see it work, then you try it yourself.
        </p>
        <p className="text-sm text-gray-600 mb-10">
          No coding experience required · 7 modules · 21 hands-on lessons
        </p>

        {completedCount > 0 && (
          <div className="mb-6 max-w-xs mx-auto">
            <div className="flex justify-between text-xs text-gray-500 mb-2">
              <span>Your progress</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#e8692a] rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        <button
          onClick={onStart}
          className="px-8 py-4 bg-[#e8692a] hover:bg-orange-400 rounded-xl font-semibold text-base transition-all hover:scale-105 shadow-lg shadow-orange-900/30"
        >
          {completedCount > 0 ? 'Continue Learning →' : 'Start Learning — It\'s Free →'}
        </button>
      </section>

      {/* Stats */}
      <section className="border-y border-gray-800 py-8">
        <div className="max-w-3xl mx-auto px-6 grid grid-cols-3 gap-6 text-center">
          {[
            { value: '7', label: 'Modules', sub: 'From basics to workflows' },
            { value: '21', label: 'Lessons', sub: 'With live Claude demos' },
            { value: '100%', label: 'Interactive', sub: 'Real AI, real responses' },
          ].map(({ value, label, sub }) => (
            <div key={label}>
              <div className="text-3xl font-bold text-[#e8692a]">{value}</div>
              <div className="font-semibold text-sm mt-1">{label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Modules grid */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold mb-2 text-center">What you'll learn</h2>
        <p className="text-gray-500 text-center text-sm mb-10">Click any module to jump straight in</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((mod) => (
            <button
              key={mod.id}
              onClick={() => onSelectLesson(mod, mod.lessons[0])}
              className="text-left p-5 rounded-2xl border border-gray-800 hover:border-gray-600 bg-gray-900/50 hover:bg-gray-900 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-3xl">{mod.emoji}</span>
                <span
                  className="text-xs px-2 py-1 rounded-full font-medium"
                  style={{ background: mod.color + '20', color: mod.color }}
                >
                  {mod.lessons.length} lessons
                </span>
              </div>
              <h3 className="font-semibold text-sm mb-1 group-hover:text-white transition-colors">
                {mod.title}
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">{mod.tagline}</p>
            </button>
          ))}
        </div>
      </section>

      {/* What makes it special */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-bold mb-10 text-center">How it works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              icon: '📖',
              title: 'Read the concept',
              desc: 'Each lesson opens with a clear, jargon-free explanation of the concept. No coding background needed.',
            },
            {
              icon: '👀',
              title: 'Watch a live demo',
              desc: 'Click "Run Demo" and watch Claude respond in real-time. You\'re not reading about AI — you\'re watching it work.',
            },
            {
              icon: '✋',
              title: 'Try it yourself',
              desc: 'Each lesson ends with an exercise. Write your own prompt and see Claude respond to YOUR specific request.',
            },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="text-center p-6 rounded-2xl bg-gray-900 border border-gray-800">
              <div className="text-4xl mb-4">{icon}</div>
              <h3 className="font-semibold mb-2">{title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center pb-20 px-6">
        <button
          onClick={onStart}
          className="px-8 py-4 bg-[#e8692a] hover:bg-orange-400 rounded-xl font-semibold text-base transition-all hover:scale-105"
        >
          View All Modules →
        </button>
        <p className="text-xs text-gray-600 mt-3">No account required · Progress saved in your browser</p>
      </section>
    </div>
  )
}
