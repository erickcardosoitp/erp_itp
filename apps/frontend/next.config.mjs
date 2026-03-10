/** @type {import('next').NextConfig} */
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const monorepoRoot = path.resolve(__dirname, '../..');

const nextConfig = {
  outputFileTracingRoot: monorepoRoot,
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
    // npm workspaces hoists packages to the monorepo root node_modules
    config.resolve.modules.push(path.resolve(monorepoRoot, 'node_modules'));
    // Follow symlinks (needed for Vercel where node_modules is symlinked)
    config.resolve.symlinks = true;
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