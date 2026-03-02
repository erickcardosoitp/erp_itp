import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

// Core
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Entities
import { Materia } from './materia.entity';
import { Usuario } from './usuarios/usuario.entity';
import { Aluno } from './alunos/aluno.entity';
import { Inscricao } from './matriculas/inscricao.entity';

// Services
import { MateriasService } from './materias/materias.service';
import { AuthService } from './auth/auth.service';
import { MatriculasService } from './matriculas/matriculas.service';

// Controllers
import { MateriasController } from './materias/materias.controller';
import { AuthController } from './auth/auth.controller';
import { MatriculasController } from './matriculas/matriculas.controller';

@Module({
  imports: [
    // Configura o carregamento do .env (local) e variáveis da Vercel (produção)
    ConfigModule.forRoot({ 
      isGlobal: true,
      envFilePath: '.env', // Garante que ignore se não existir em produção
    }),
    
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        global: true,
        // ✅ AJUSTE 1: Prioriza a variável do painel da Vercel. 
        // O fallback deve ser apenas para desenvolvimento.
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '8h' },
      }),
    }),
    
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        // ✅ AJUSTE 2: Verifica se a URL do banco existe antes de tentar conectar
        url: configService.get<string>('DATABASE_URL'),
        entities: [Materia, Usuario, Aluno, Inscricao], 
        synchronize: process.env.NODE_ENV !== 'production', // ✅ AJUSTE 3: Evita mudanças acidentais em prod
        ssl: {
          rejectUnauthorized: false, // Necessário para a maioria dos DBs cloud (Neon/Supabase)
        },
      }),
    }),
    TypeOrmModule.forFeature([Materia, Usuario, Aluno, Inscricao]),
  ],
  controllers: [AppController, MateriasController, AuthController, MatriculasController],
  providers: [AppService, MateriasService, AuthService, MatriculasService],
})
export class AppModule {}