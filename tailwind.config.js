/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/index.tsx",
    "./src/App.tsx",
    "./src/types.ts",
    "./src/components/**/*.{ts,tsx}",
    "./src/utils/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      animation: {
        'pulse-slow-delay': 'pulse-slow 3s infinite ease-in-out',
        'fade-in-up-delay': 'fade-in-up 0.6s ease-out forwards',
      },
    },
  },
  plugins: [],
}