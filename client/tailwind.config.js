/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        black: {
          DEFAULT: '#0A0A0A',
          card: '#111111',
          border: '#1A1A1A',
          elevated: '#161616',
        },
        neon: {
          DEFAULT: '#00FF85',
          dim: '#00CC6A',
          glow: 'rgba(0, 255, 133, 0.15)',
          faint: 'rgba(0, 255, 133, 0.06)',
        },
        gold: {
          DEFAULT: '#F0C040',
          dim: '#C9A030',
          glow: 'rgba(240, 192, 64, 0.15)',
        }
      },
      fontFamily: {
        sans: ['Manrope', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
      },
      boxShadow: {
        neon: '0 0 20px rgba(0, 255, 133, 0.25), 0 0 40px rgba(0, 255, 133, 0.1)',
        'neon-sm': '0 0 10px rgba(0, 255, 133, 0.2)',
        gold: '0 0 20px rgba(240, 192, 64, 0.2)',
      }
    },
  },
  plugins: [],
};
