import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';
import express from 'express';
// ✅ CORREÇÃO DO IMPORT: Remova o * as e use o import padrão
import cookieParser from 'cookie-parser'; 
import { join } from 'path';

const server = express();
const logger = new Logger('Bootstrap');

export const setupApp = async (app: NestExpressApplication) => {
  // ✅ Agora a chamada funcionará sem erro de tipagem
  app.use(cookieParser());
  
  app.setGlobalPrefix('api');

  app.useStaticAssets(join(process.cwd(), 'public'), {
    prefix: '/public/',
  });

  app.enableCors({
    origin: [
      'https://itp.institutotiapretinha.org',
      'https://api.itp.institutotiapretinha.org', // Adicionado para o domínio da API em produção
      'https://institutotiapretinha.org',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001'
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

  app.useGlobalPipes(new ValidationPipe({ 
    transform: true, 
    whitelist: true,
    forbidNonWhitelisted: false 
  }));

  return app;
};

async function bootstrap() {
  try {
    const app = await NestFactory.create<NestExpressApplication>(
      AppModule, 
      new ExpressAdapter(server)
    );
    
    await setupApp(app);
    app.getHttpAdapter().getInstance().set('trust proxy', 1);

    const port = process.env.PORT || 3001;

    await app.listen(port, '0.0.0.0');
    logger.log(`✅ SERVIDOR ITP ONLINE: http://localhost:${port}/api`);
  } catch (error: any) {
    if (error.code === 'EADDRINUSE') {
      logger.error(`❌ PORTA ${process.env.PORT || 3001} EM USO.`);
    } else {
      logger.error(`❌ FALHA AO INICIAR: ${error.message}`);
    }
    process.exit(1);
  }
}
bootstrap();