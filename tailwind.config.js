/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        'surface': '#1a1a1a',
        'surface-light': '#2a2a2a',
        'surface-lighter': '#3a3a3a',
        'yes': '#22c55e',
        'no': '#ef4444',
      }
    },
  },
  plugins: [],
}
