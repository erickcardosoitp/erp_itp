import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import { join } from 'path';
import { existsSync } from 'fs';
import { PayloadSizeInterceptor } from '../src/common/payload-size.interceptor';

const logger = new Logger('Bootstrap');

export const setupApp = async (app: NestExpressApplication) => {
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  const cookieMiddleware = (cookieParser as any).default || cookieParser;
  app.use(cookieMiddleware());

  // Guard: intercepta respostas grandes antes que o Vercel retorne 413
  // Cobre res.json() E res.send() para capturar TODOS os caminhos de resposta
  const PAYLOAD_LIMIT = 1_000_000; // 1MB — bem abaixo do limite do Vercel (4.5MB)
  app.use((req: any, res: any, next: any) => {
    const checkSize = (body: any, via: string): { truncated: boolean; bytes?: number } => {
      try {
        const str = typeof body === 'string' ? body : JSON.stringify(body);
        const bytes = Buffer.byteLength(str, 'utf8');
        if (bytes > PAYLOAD_LIMIT) {
          console.error(`[PAYLOAD_GUARD] ${req.method} ${req.path}: ${bytes} bytes (via ${via}) — TRUNCATING`);
          return { truncated: true, bytes };
        }
        if (bytes > 50_000) {
          console.warn(`[PAYLOAD_SIZE] ${req.method} ${req.path}: ${bytes} bytes`);
        }
      } catch (e: any) {
        console.error(`[PAYLOAD_GUARD] serialize error (${via}): ${e?.message}`);
      }
      return { truncated: false };
    };

    const originalJson = (res.json as Function).bind(res);
    (res as any).json = function(body: any) {
      const { truncated, bytes } = checkSize(body, 'json');
      if (truncated) {
        if (Array.isArray(body)) {
          return originalJson(body.map((item: any) => ({
            id: item?.id, tipo: item?.tipo,
            fisico: item?.fisico ?? false,
            signed_url: null, source: item?.source,
          })));
        }
        return originalJson({ error: 'PAYLOAD_TOO_LARGE', path: req.path, bytes });
      }
      return originalJson(body);
    };

    const originalSend = (res.send as Function).bind(res);
    (res as any).send = function(body: any) {
      if (body && typeof body !== 'number') {
        const { truncated, bytes } = checkSize(body, 'send');
        if (truncated) {
          (res as any).set('Content-Type', 'application/json');
          return originalSend(JSON.stringify({ error: 'PAYLOAD_TOO_LARGE', path: req.path, bytes }));
        }
      }
      return originalSend(body);
    };

    next();
  });

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

  // Interceptor global: trunca respostas > 1MB antes que o Vercel retorne 413
  // Roda DENTRO do pipeline NestJS, antes de qualquer res.json() — independente da implementação do res
  app.useGlobalInterceptors(new PayloadSizeInterceptor());

  return app;
};

// Tempo máximo para NestFactory.create() antes de responder 503 e deixar o Neon acordar
const BOOTSTRAP_TIMEOUT_MS = 55000; // maior que connect_timeout=50 do Neon

async function bootstrap() {
  const t0 = Date.now();
  // Diagnóstico de variáveis de ambiente críticas
  const hasDb  = !!process.env.DATABASE_URL;
  const hasJwt = !!process.env.JWT_SECRET;
  console.log(`[BOOTSTRAP] NestFactory.create iniciando... DB=${hasDb} JWT=${hasJwt} NODE_ENV=${process.env.NODE_ENV}`);

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

const CORS_ORIGIN = 'https://institutotiapretinha.org';
const CORS_METHODS = 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS';
const CORS_HEADERS = 'Content-Type,Authorization,Accept,Cookie,X-Requested-With';

export default async function handler(req: any, res: any) {
  // Log imediato — aparece mesmo que o Lambda não chegue ao NestJS
  // Confirma se o Lambda FOI invocado para requests que retornam 413
  console.log(`[HANDLER_EARLY] ${req.method} ${req.url} cookies=${Object.keys(req.cookies || {}).join(',')} auth=${req.headers?.authorization ? 'yes:' + String(req.headers.authorization).length : 'no'}`);

  // Preflight: responde imediatamente sem precisar do NestJS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', CORS_METHODS);
    res.setHeader('Access-Control-Allow-Headers', CORS_HEADERS);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
    return;
  }

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
