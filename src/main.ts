import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // 1. Configuração de CORS Otimizada para o ITP
  app.enableCors({
    // Permite tanto o endereço local quanto o loopback para evitar erros de F5
    origin: ['http://localhost:3001', 'http://127.0.0.1:3001'], 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'X-Requested-With'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // 2. Definindo a porta e host
  const port = process.env.PORT ?? 3000;

  // Ouvir em 0.0.0.0 ajuda o Docker e resoluções de IP locais problemáticas
  await app.listen(port, '0.0.0.0');

  const url = await app.getUrl();
  logger.log(`\n🚀 BACKEND ERP_ITP ATIVO: ${url}`);
  logger.log(`📢 CORS configurado para: http://localhost:3001`);
}
bootstrap();