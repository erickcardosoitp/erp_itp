import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

// Entities
import { Materia } from './materia.entity';
import { Usuario } from './usuarios/usuario.entity';
import { Aluno } from './alunos/aluno.entity'; // ADICIONADO
import { Inscricao } from './matriculas/inscricao.entity'; // ADICIONADO

// Services
import { MateriasService } from './materias/materias.service';
import { AuthService } from './auth/auth.service';
import { MatriculasService } from './matriculas/matriculas.service'; // ADICIONADO

// Controllers
import { MateriasController } from './materias/materias.controller';
import { AuthController } from './auth/auth.controller';
import { MatriculasController } from './matriculas/matriculas.controller'; // ADICIONADO

@Module({
  imports: [
    // 1. Configuração Global
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // 2. Configuração do JWT
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        global: true,
        secret: configService.get<string>('JWT_SECRET') || 'ITP_SECRET_KEY_2026',
        signOptions: { expiresIn: '8h' },
      }),
    }),

    // 3. Conexão com o Banco de Dados Neon
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        // IMPORTANTE: Adicionadas as novas entidades aqui para o TypeORM criar as tabelas
        entities: [Materia, Usuario, Aluno, Inscricao], 
        synchronize: true, 
        ssl: true,
        extra: {
          ssl: {
            rejectUnauthorized: false,
          },
        },
      }),
    }),

    // 4. Registro para Injeção de Repositórios
    // Adicione Aluno e Inscricao aqui para poder usar o Repository no Service
    TypeOrmModule.forFeature([Materia, Usuario, Aluno, Inscricao]),
  ],
  controllers: [
    MateriasController, 
    AuthController,
    MatriculasController // ADICIONADO
  ],
  providers: [
    MateriasService, 
    AuthService,
    MatriculasService // ADICIONADO
  ],
})
export class AppModule {}