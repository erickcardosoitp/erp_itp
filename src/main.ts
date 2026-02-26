import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Habilite o CORS (Essencial para receber Webhooks externos como o do Google)
  app.enableCors();

  // 2. Opcional: Prefixar com 'api' ajuda na organização da Vercel
  // app.setGlobalPrefix('api'); 

  const port = process.env.PORT ?? 3000;

  await app.listen(port);

  console.log(`\n🚀 ERP_ITP rodando com sucesso na porta ${port}`);
}
bootstrap();