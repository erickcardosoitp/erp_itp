import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  // Ajustamos os caminhos para garantir que ele foque na pasta src do frontend
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    // Adicionado para garantir que componentes na raiz do src também sejam lidos
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'itp-roxo': '#6B21A8',
        'itp-amarelo': '#FACC15',
        'itp-preto': '#111827',
        'itp-cinza': '#F9FAFB',
      },
    },
  },
  plugins: [],
};

export default config;