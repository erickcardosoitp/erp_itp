import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ✅ Remova o serverExternalPackages: o Tailwind v4 precisa ser processado internamente
  
  // ✅ standalone é ótimo para o deploy futuro na Vercel/Docker
  output: 'standalone',

  // ✅ Configurações experimentais padrão (limpas)
  experimental: {
    // Se você tiver problemas com o monorepo (pasta pai), mantenha o externalDir como false
    externalDir: false,
  },
};

export default nextConfig;