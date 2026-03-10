// ecosystem.config.js — PM2 para rodar frontend + backend no servidor VPS
// Uso: pm2 start ecosystem.config.js --env production
// Consulta: pm2 status | pm2 logs | pm2 restart all

module.exports = {
  apps: [
    {
      name: 'itp-backend',
      cwd: './apps/backend',
      script: 'dist/api/main.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
        // ⚠️  Coloque o DATABASE_URL e JWT_SECRET em /etc/environment ou num
        //     arquivo .env do servidor — NÃO commite segredos aqui.
      },
      error_file: './logs/backend-err.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'itp-frontend',
      cwd: './apps/frontend',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        BACKEND_INTERNAL_URL: 'http://localhost:3001',
        APP_URL: 'https://itp.institutotiapretinha.org',
      },
      error_file: './logs/frontend-err.log',
      out_file: './logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
