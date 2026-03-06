import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { join } from 'path';

// Mova o logger para o escopo global para que possa ser usado fora de 'bootstrap'
const logger = new Logger('Bootstrap');

// A função de configuração permanece a mesma
export const setupApp = async (app: NestExpressApplication) => {
  app.use(cookieParser());
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
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  await setupApp(app);
  await app.init(); // Inicializa o app sem escutar em uma porta
  return app;
}

// Crie uma instância do aplicativo NestJS e exporte o handler
let app: NestExpressApplication;

export default async function handler(req: any, res: any) {
  if (!app) {
    app = await bootstrap();
  }
  const server = app.getHttpAdapter().getInstance();
  return server(req, res);
}

// O antigo bootstrap() é removido para evitar que o servidor inicie diretamente
// bootstrap();