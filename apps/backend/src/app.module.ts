import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { TypeOrmModule, InjectDataSource } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { join } from 'path';
import { DataSource } from 'typeorm';

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
import { InscricaoAnotacao } from './matriculas/inscricao-anotacao.entity';
import { InscricaoMovimentacao } from './matriculas/inscricao-movimentacao.entity';
import { Grupo } from './grupos/grupo.entity';
import { DocumentoInscricao } from './matriculas/documento-inscricao.entity';
import { TurmaAluno } from './academico/entities/turma-aluno.entity';

// Services / Controllers
import { MateriasService } from './materias/materias.service';
import { MatriculasService } from './matriculas/matriculas.service';
import { MateriasController } from './materias/materias.controller';
import { MatriculasController } from './matriculas/matriculas.controller';
import { UsuariosController } from './usuarios/usuarios.controller'; 
import { EmailService } from './email.service';

// Modules
import { GruposModule } from './grupos/grupos.module';
import { UsersModule } from './modules/users/users.module'; 
import { AcademicoModule } from './academico/academico.module';
import { CadastroModule } from './cadastro/cadastro.module';
import { FuncionariosModule } from './funcionarios/funcionarios.module';
import { FinanceiroModule } from './financeiro/financeiro.module';

@Module({
  imports: [
    // 1. Configuração Global
    ConfigModule.forRoot({ 
      isGlobal: true,
      // Na Vercel, as env vars já são injetadas pelo sistema — o envFilePath é apenas para dev local
      envFilePath: process.env.VERCEL
        ? undefined
        : [
            join(process.cwd(), '.env'),
            join(process.cwd(), '..', '..', '.env'),
          ],
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
      useFactory: (config: ConfigService) => {
        const dbUrl = config.get<string>('DATABASE_URL');
        if (!dbUrl) {
          throw new Error('A variável de ambiente DATABASE_URL não foi definida.');
        }
        return {
          type: 'postgres',
          url: dbUrl,
          entities: [Materia, Usuario, Aluno, Inscricao, InscricaoAnotacao, InscricaoMovimentacao, Grupo, DocumentoInscricao],
          autoLoadEntities: true,
          synchronize: false,
          // Para conexões não-locais (produção), apenas habilita o SSL.
          // A modalidade específica ('require', 'verify-full') deve ser controlada
          // pelo parâmetro 'sslmode' na sua variável de ambiente DATABASE_URL.
          ssl: (dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1'))
            ? false
            : { rejectUnauthorized: false },
        };
      },
    }),

    // 4. Repositórios
    TypeOrmModule.forFeature([Materia, Usuario, Aluno, Inscricao, InscricaoAnotacao, InscricaoMovimentacao, Grupo, DocumentoInscricao, TurmaAluno]),
    
    // 5. Módulos Encapsulados (Não adicione os services deles em providers!)
    GruposModule, 
    UsersModule,
    AcademicoModule,
    CadastroModule,
    FuncionariosModule,
    FinanceiroModule,
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
    EmailService,
    // O UsersService NÃO deve estar aqui, pois já está dentro do UsersModule
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements OnModuleInit {
  private readonly logger = new Logger('AppModule');

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onModuleInit() {
    try {
      // Migrations idempotentes — executam na inicialização em produção ou dev
      await this.dataSource.query(`ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS matricula TEXT UNIQUE`);
      await this.dataSource.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS matricula TEXT UNIQUE`);
      this.logger.log('✅ Migrations de matrícula aplicadas (IF NOT EXISTS)');

      // Auto-atribuir matrícula a usuários existentes que não possuem
      const semMatricula: { id: string; role: string; createdAt: Date }[] = await this.dataSource.query(
        `SELECT id, role, "createdAt" FROM usuarios WHERE matricula IS NULL ORDER BY "createdAt" ASC`
      );
      if (semMatricula.length > 0) {
        this.logger.log(`🔄 Atribuindo matrícula a ${semMatricula.length} usuário(s) sem matrícula...`);
        for (let i = 0; i < semMatricula.length; i++) {
          const u = semMatricula[i];
          const d = u.createdAt ? new Date(u.createdAt) : new Date();
          const yyyymm = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
          const prefix = u.role === 'admin' ? 'ITP-ADM' : 'ITP-USR';
          const seq = String(i + 1).padStart(3, '0');
          const matricula = `${prefix}-${yyyymm}-${seq}`;
          await this.dataSource.query(
            `UPDATE usuarios SET matricula = $1 WHERE id = $2 AND matricula IS NULL`,
            [matricula, u.id]
          );
        }
        this.logger.log('✅ Matrículas atribuídas aos usuários existentes.');
      }
    } catch (err: any) {
      this.logger.error(`❌ Erro nas migrations automáticas: ${err.message}`);
    }
  }
}