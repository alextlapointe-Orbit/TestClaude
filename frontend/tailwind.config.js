/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // OrbitMI-inspired dark maritime palette
        navy: {
          950: '#020912',
          900: '#050d1a',
          800: '#0a1628',
          700: '#0f1f38',
          600: '#152840',
          500: '#1a3050',
          400: '#244268',
          300: '#2d5480',
        },
        cyan: {
          maritime: '#00d4ff',
          glow: '#00b4e0',
          dim: '#0090b8',
        },
        // Status colors
        status: {
          low: '#00c48c',
          medium: '#ffb800',
          high: '#ff6b35',
          critical: '#ff4757',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-maritime': 'linear-gradient(135deg, #050d1a 0%, #0a1628 50%, #0f1f38 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
