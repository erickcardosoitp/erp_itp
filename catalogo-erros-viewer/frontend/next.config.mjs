/** @type {import('next').NextConfig} */
const nextConfig = {
  // Mesmo padrão do erp_itp: proxy interno pro backend, elimina CORS
  // em produção (dev usa a env var direto, ver page.tsx).
  async rewrites() {
    return [
      {
        source: "/backend-api/:path*",
        destination: `${process.env.BACKEND_INTERNAL_URL || "http://localhost:8000"}/:path*`,
      },
    ];
  },
};

export default nextConfig;
