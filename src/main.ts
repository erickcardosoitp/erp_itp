import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
// ✅ CORREÇÃO DO IMPORT: Tente usar o caminho absoluto ou garanta que o arquivo existe
import { AppModule } from '../api/app.module'; 
// ✅ CORREÇÃO DO COOKIE-PARSER: Importação robusta para evitar erro de callable
import * as cookieParser from 'cookie-parser';

const logger = new Logger('Bootstrap');

// 1. Função de Configuração Compartilhada
export const setupApp = async (app: NestExpressApplication) => {
  // ✅ Forma correta de usar o middleware em ambientes híbridos
  const cookieMiddleware = (cookieParser as any).default || cookieParser;
  app.use(cookieMiddleware());
  
  app.setGlobalPrefix('api');

  app.useStaticAssets(join(process.cwd(), 'public'), {
    prefix: '/public/',
  });

  app.enableCors({
    origin: [
      'https://itp.institutotiapretinha.org',
      'https://api.itp.institutotiapretinha.org',
      'https://institutotiapretinha.org',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
    ],
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Cookie', 'X-Requested-With'],
    exposedHeaders: ['Set-Cookie'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  return app;
};

// 2. Lógica para Servidor Local (npm run start:dev)
async function bootstrapLocal() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  await setupApp(app);
  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`🚀 SERVIDOR LOCAL ONLINE: http://localhost:${port}/api`);
}

// 3. Lógica para Handler Serverless (Vercel)
let cachedServer: any;

export default async function handler(req: any, res: any) {
  if (!cachedServer) {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    await setupApp(app);
    await app.init();
    cachedServer = app.getHttpAdapter().getInstance();
  }
  return cachedServer(req, res);
}

// ✅ Executa o listen apenas se NÃO estivermos no ambiente de handler (Serverless)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  bootstrapLocal();
}