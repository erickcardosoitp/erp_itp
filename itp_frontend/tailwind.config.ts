// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
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