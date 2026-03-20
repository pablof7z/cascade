/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'surface': '#1a1a1a',
        'surface-light': '#2a2a2a',
        'surface-lighter': '#3a3a3a',
        'accent': '#3b82f6',
        'yes': '#22c55e',
        'no': '#ef4444',
      }
    },
  },
  plugins: [],
}
