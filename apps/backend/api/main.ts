import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as cookieParser from 'cookie-parser';
import { join } from 'path';
import { existsSync } from 'fs';

// Mova o logger para o escopo global para que possa ser usado fora de 'bootstrap'
const logger = new Logger('Bootstrap');

// A função de configuração permanece a mesma
export const setupApp = async (app: NestExpressApplication) => {
  const cookieMiddleware = (cookieParser as any).default || cookieParser;
  app.use(cookieMiddleware());
  app.setGlobalPrefix('api');

  // Apenas registra o diretório de assets se ele existir (não existe em serverless)
  const publicDir = join(__dirname, '..', '..', 'public');
  if (existsSync(publicDir)) {
    app.useStaticAssets(publicDir);
  }

  const isDev = process.env.NODE_ENV !== 'production';

  app.enableCors({
    origin: isDev
      ? (origin: string | undefined, cb: (err: Error | null, allow: boolean) => void) => {
          if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.|10\.)/.test(origin)) {
            cb(null, true);
          } else {
            cb(new Error('CORS bloqueado: ' + origin), false);
          }
        }
      : [
          'https://itp.institutotiapretinha.org',
          'https://api.itp.institutotiapretinha.org',
          'https://institutotiapretinha.org',
        ],
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Cookie',
      'X-Requested-With',
    ],
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

// Função para inicializar o app (sem o listen)
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  await setupApp(app);
  await app.init();
  return app;
}

// Crie uma instância do aplicativo NestJS e exporte o handler
let app: NestExpressApplication;
let bootstrapError: Error | null = null;

export default async function handler(req: any, res: any) {
  if (bootstrapError) {
    res.status(500).json({ error: 'Bootstrap failed', message: bootstrapError.message });
    return;
  }
  if (!app) {
    try {
      app = await bootstrap();
    } catch (err: any) {
      bootstrapError = err;
      logger.error(`Bootstrap falhou: ${err.message}`, err.stack);
      res.status(500).json({ error: 'Bootstrap failed', message: err.message });
      return;
    }
  }
  const server = app.getHttpAdapter().getInstance();
  return server(req, res);
}

// O antigo bootstrap() é removido para evitar que o servidor inicie diretamente
// bootstrap();