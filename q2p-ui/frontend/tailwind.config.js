/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary:  { DEFAULT: '#6366f1', hover: '#4f46e5' },
        surface:  '#161b2e',
        'surface-alt': '#1e2235',
        border:   '#2a2f45',
        accent:   '#2dd4bf',
      },
      fontFamily: {
        sans:     ['DM Sans', 'sans-serif'],
        display:  ['Syne', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
