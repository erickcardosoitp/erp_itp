/** @type {import('next').NextConfig} */
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig = {
  experimental: {
    turbo: {
      resolveAlias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      '@radix-ui/react-avatar',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-label',
      '@radix-ui/react-select',
      '@radix-ui/react-slot',
      '@radix-ui/react-switch',
      'sonner',
    ],
  },
  transpilePackages: [],

  webpack: (config) => {
    // Força uma única instância de react/react-dom (evita conflito com root node_modules)
    config.resolve.alias['react'] = path.resolve(__dirname, 'node_modules/react');
    config.resolve.alias['react-dom'] = path.resolve(__dirname, 'node_modules/react-dom');
    return config;
  },

  // Proxy: o browser chama /backend-api/* → Next.js server repassa para localhost:3001/api/*
  // Elimina CORS e problemas de IP — funciona em qualquer máquina/rede
  async rewrites() {
    const backendUrl = process.env.BACKEND_INTERNAL_URL || 'http://localhost:3001';
    return [
      {
        source: '/backend-api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      // Arquivos estáticos do backend (fotos de perfil, uploads)
      {
        source: '/uploads/:path*',
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;