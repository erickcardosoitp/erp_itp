import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';

// Core & Auth
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthService } from './auth/auth.service';
import { AuthController } from './auth/auth.controller';
import { JwtStrategy } from './auth/jwt.strategy';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

// Entities
import { Materia } from './materia.entity';
import { Usuario } from './usuarios/usuario.entity';
import { Aluno } from './alunos/aluno.entity';
import { Inscricao } from './matriculas/inscricao.entity';
import { Grupo } from './grupos/grupo.entity';

// Services / Controllers
import { MateriasService } from './materias/materias.service';
import { MatriculasService } from './matriculas/matriculas.service';
import { MateriasController } from './materias/materias.controller';
import { MatriculasController } from './matriculas/matriculas.controller';
import { UsuariosController } from './usuarios/usuarios.controller'; 
import { GruposModule } from './grupos/grupos.module';

@Module({
  imports: [
    // 1. Configuração Global de Variáveis de Ambiente
    ConfigModule.forRoot({ 
      isGlobal: true,
      envFilePath: '.env',
      cache: true,
    }),
    
    // 2. JWT Global - Centraliza a Secret para evitar 401 por divergência
    JwtModule.registerAsync({
      global: true, 
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '8h' },
      }),
    }),
    
    // 3. Conexão com Banco de Dados (Neon/Postgres)
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [Materia, Usuario, Aluno, Inscricao, Grupo], 
        autoLoadEntities: true, 
        synchronize: false, // Segurança: Não altera o banco automaticamente
        ssl: { rejectUnauthorized: false },
      }),
    }),

    // 4. Repositórios para injeção nos Services
    TypeOrmModule.forFeature([Materia, Usuario, Aluno, Inscricao, Grupo]),
    
    // 5. Módulos Externos
    GruposModule, 
  ],
  controllers: [
    AppController, 
    MateriasController, 
    AuthController, 
    MatriculasController,
    UsuariosController 
  ],
  providers: [
    AppService, 
    MateriasService, 
    AuthService, 
    MatriculasService,
    JwtStrategy,
    // Ordem dos Guards: Primeiro Autentica (JWT), depois Autoriza (Roles)
    { 
      provide: APP_GUARD, 
      useClass: JwtAuthGuard 
    },
    { 
      provide: APP_GUARD, 
      useClass: RolesGuard 
    },
  ],
})
export class AppModule {}