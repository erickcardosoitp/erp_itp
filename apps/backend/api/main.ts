import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as cookieParser from 'cookie-parser';
import { join } from 'path';
import { existsSync } from 'fs';

const logger = new Logger('Bootstrap');

export const setupApp = async (app: NestExpressApplication) => {
  const cookieMiddleware = (cookieParser as any).default || cookieParser;
  app.use(cookieMiddleware());
  app.setGlobalPrefix('api');

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

// Tempo máximo para NestFactory.create() antes de responder 503 e deixar o Neon acordar
const BOOTSTRAP_TIMEOUT_MS = 25000;

async function bootstrap() {
  const t0 = Date.now();
  console.log('[BOOTSTRAP] NestFactory.create iniciando...');

  let timeoutHandle: NodeJS.Timeout | null = null;
  const createPromise = NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error('BOOTSTRAP_TIMEOUT')),
      BOOTSTRAP_TIMEOUT_MS,
    );
  });

  const app = await Promise.race([createPromise, timeoutPromise]).finally(() => {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }) as NestExpressApplication;

  console.log(`[BOOTSTRAP] NestFactory.create OK — ${Date.now() - t0}ms`);
  await setupApp(app);
  await app.init();
  console.log(`[BOOTSTRAP] app.init() OK — ${Date.now() - t0}ms total`);
  return app;
}

process.on('unhandledRejection', (reason: any) => {
  console.error('[UNHANDLED REJECTION]', reason?.stack || reason);
});

let app: NestExpressApplication | null = null;
let bootstrapError: Error | null = null;
let bootstrapping = false;

export default async function handler(req: any, res: any) {
  // Erro permanente de bootstrap — não vai resolver com retry
  if (bootstrapError) {
    return res.status(500).json({
      error: 'Bootstrap failed',
      message: bootstrapError.message,
      stack: bootstrapError.stack?.split('\n').slice(0, 8).join('\n'),
    });
  }

  if (!app) {
    // Outro request já está inicializando — retorna 503 imediatamente
    if (bootstrapping) {
      return res.status(503).json({
        error: 'Service starting',
        message: 'Backend inicializando, tente novamente em alguns segundos',
      });
    }

    bootstrapping = true;
    try {
      app = await bootstrap();
    } catch (err: any) {
      bootstrapping = false;

      if (err?.message === 'BOOTSTRAP_TIMEOUT') {
        // Timeout transitório: Neon está acordando. Permite retry na próxima request.
        console.log(`[BOOTSTRAP] Timeout ${BOOTSTRAP_TIMEOUT_MS}ms — Neon cold start em progresso`);
        return res.status(503).json({
          error: 'Service starting',
          message: 'Backend inicializando (Neon cold start), tente novamente',
        });
      }

      // Erro permanente
      bootstrapError = err;
      console.error('[BOOTSTRAP ERROR]', err?.message);
      console.error('[BOOTSTRAP STACK]', err?.stack);
      return res.status(500).json({
        error: 'Bootstrap failed',
        message: err?.message,
        stack: err?.stack?.split('\n').slice(0, 10).join('\n'),
      });
    }
    bootstrapping = false;
  }

  const server = app.getHttpAdapter().getInstance();
  return server(req, res);
}
