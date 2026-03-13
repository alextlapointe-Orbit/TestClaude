/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Deep maritime dark palette — ECDIS / ops center inspired
        navy: {
          950: '#010810',
          900: '#020b18',
          800: '#071525',
          700: '#0c1e35',
          600: '#112844',
          500: '#163354',
          400: '#1e4268',
          300: '#2a5580',
        },
        // Cyan — primary interactive / AIS live
        cyan: {
          maritime: '#00d4ff',
          glow:     '#00b8e0',
          dim:      '#0090b8',
          faint:    '#003d5c',
        },
        // Amber — operational urgency / warnings
        amber: {
          ops: '#f59e0b',
          dim: '#b45309',
        },
        // Status
        status: {
          low:      '#10b981',
          medium:   '#f59e0b',
          high:     '#f97316',
          critical: '#ef4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      backgroundImage: {
        'gradient-maritime': 'linear-gradient(135deg, #010810 0%, #020b18 50%, #071525 100%)',
      },
      boxShadow: {
        'glow-cyan':   '0 0 20px rgba(0,212,255,0.25)',
        'glow-cyan-sm':'0 0 8px rgba(0,212,255,0.2)',
        'glow-amber':  '0 0 20px rgba(245,158,11,0.3)',
        'glow-red':    '0 0 16px rgba(239,68,68,0.35)',
        'glow-green':  '0 0 16px rgba(16,185,129,0.3)',
        'panel':       '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,180,255,0.08)',
      },
      animation: {
        'pulse-slow':  'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in':     'fadeIn 0.25s ease-out',
        'slide-in':    'slideIn 0.25s ease-out',
        'slide-up':    'slideUp 0.25s ease-out',
        'ping-slow':   'ping 2s cubic-bezier(0,0,0.2,1) infinite',
        'glow-pulse':  'glowPulse 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { '0%': { opacity: '0' },                               '100%': { opacity: '1' } },
        slideIn:   { '0%': { transform: 'translateX(-12px)', opacity: '0' },'100%': { transform: 'translateX(0)', opacity: '1' } },
        slideUp:   { '0%': { transform: 'translateY(8px)',   opacity: '0' },'100%': { transform: 'translateY(0)',  opacity: '1' } },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(0,212,255,0.2)' },
          '50%':      { boxShadow: '0 0 20px rgba(0,212,255,0.5)' },
        },
      },
    },
  },
  plugins: [],
}
