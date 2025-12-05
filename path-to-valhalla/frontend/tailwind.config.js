/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // --- AGREGAMOS ESTO ---
      animation: {
        'float': 'float 6s ease-in-out infinite', // Flotar suave (6 segundos)
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite', // Pulso lento
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-15px)' }, // Se mueve 15px arriba
        }
      }
      // ----------------------
    },
  },
  plugins: [],
}