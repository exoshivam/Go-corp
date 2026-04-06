/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#F29400',
          hover: '#D98300',
        },
      },
      borderRadius: {
        'button': '40px',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'pulse-custom': 'pulse-animation 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-animation': {
          '0%': { transform: 'translate(-50%, -50%) scale(1)', opacity: '1' },
          '100%': { transform: 'translate(-50%, -50%) scale(1.5)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}

