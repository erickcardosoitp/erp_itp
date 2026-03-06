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

// Modules
import { GruposModule } from './grupos/grupos.module';
import { UsersModule } from './modules/users/users.module'; 

@Module({
  imports: [
    // 1. Configuração Global
    ConfigModule.forRoot({ 
      isGlobal: true,
      envFilePath: '.env',
      cache: true,
    }),
    
    // 2. JWT Global - Centralizado
    JwtModule.registerAsync({
      global: true, 
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '8h' },
      }),
    }),
    
    // 3. Conexão com Banco de Dados
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [Materia, Usuario, Aluno, Inscricao, Grupo], 
        autoLoadEntities: true, 
        synchronize: false, 
        ssl: { rejectUnauthorized: false },
      }),
    }),

    // 4. Repositórios
    TypeOrmModule.forFeature([Materia, Usuario, Aluno, Inscricao, Grupo]),
    
    // 5. Módulos Encapsulados (Não adicione os services deles em providers!)
    GruposModule, 
    UsersModule, 
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
    // O UsersService NÃO deve estar aqui, pois já está dentro do UsersModule
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}