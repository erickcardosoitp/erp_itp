import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // LISTA DE ORIGENS PERMITIDAS (Local + Produção)
  const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://itp.institutotiapretinha.org', // SEU DOMÍNIO DE PRODUÇÃO
    'https://institutotiapretinha.org',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Permite requisições sem origin (como mobile apps ou curl) ou se estiver na lista
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`Origin bloqueada pelo CORS: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // O Render/Railway/Heroku costumam passar a porta via variável de ambiente
  const port = process.env.PORT || 3001; 
  
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 BACKEND RODANDO NA PORTA: ${port}`);
}
bootstrap();