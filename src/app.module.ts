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
// ✅ AJUSTE 1: Mude o caminho do import para o arquivo onde está a classe MatriculasService
import { MatriculasService } from './matriculas/matriculas.service';

// Controllers
import { MateriasController } from './materias/materias.controller';
import { AuthController } from './auth/auth.controller';
import { MatriculasController } from './matriculas/matriculas.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        global: true,
        secret: configService.get<string>('JWT_SECRET') || 'ITP_SECRET_KEY_2026',
        signOptions: { expiresIn: '8h' },
      }),
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        entities: [Materia, Usuario, Aluno, Inscricao], 
        synchronize: true, // TypeORM tentará ajustar as colunas automaticamente
        ssl: true,
        extra: { ssl: { rejectUnauthorized: false } },
      }),
    }),
    TypeOrmModule.forFeature([Materia, Usuario, Aluno, Inscricao]),
  ],
  controllers: [AppController, MateriasController, AuthController, MatriculasController],
  providers: [AppService, MateriasService, AuthService, MatriculasService],
})
export class AppModule {}