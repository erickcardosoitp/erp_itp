/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    externalDir: false,
  },
  // Garante que o Next.js transpile pacotes do workspace se necessário
  transpilePackages: [], 
};

export default nextConfig;