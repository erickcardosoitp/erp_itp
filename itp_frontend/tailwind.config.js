/** @type {import('tailwindcss').Config} */
module.exports = {
  // ✅ ESSENCIAL: Habilita o modo escuro via classe 'dark'
  darkMode: "class", 
  
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // 🏛️ PALETA OFICIAL ITP
        brand: {
          purple: "#4c1d95", // Roxo ITP Principal
          indigo: "#1e1b4b", // Roxo Profundo para fundos Dark
          yellow: "#facc15", // Amarelo de Destaque
        },
        // Sugestão de tons para o Modo Dark
        dark: {
          bg: "#020617",     // slate-950 (Fundo total)
          card: "#0f172a",   // slate-900 (Cards e seções)
          border: "#1e293b", // slate-800 (Divisórias)
        }
      },
      // 📐 PADRÃO DE ARREDONDAMENTO ITP (Seus 40px e 32px)
      borderRadius: {
        'itp-xl': '40px',
        'itp-lg': '32px',
      }
    },
  },
  plugins: [],
};