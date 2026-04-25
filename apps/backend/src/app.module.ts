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
import { Curso } from './academico/entities/curso.entity';
import { Turma } from './academico/entities/turma.entity';

// Services / Controllers
import { MateriasService } from './materias/materias.service';
import { MateriasController } from './materias/materias.controller';
import { MatriculasModule } from './matriculas/matriculas.module';
import { UsuariosController } from './usuarios/usuarios.controller'; 
import { EmailModule } from './email.module';

// Modules
import { GruposModule } from './grupos/grupos.module';
import { UsersModule } from './modules/users/users.module'; 
import { AcademicoModule } from './academico/academico.module';
import { CadastroModule } from './cadastro/cadastro.module';
import { FuncionariosModule } from './funcionarios/funcionarios.module';
import { FinanceiroModule } from './financeiro/financeiro.module';
import { EstoqueModule } from './estoque/estoque.module';
import { NotificacoesModule } from './notificacoes/notificacoes.module';
import { RelatoriosModule } from './relatorios/relatorios.module';
import { PesquisasModule } from './pesquisas/pesquisas.module';
import { GenteModule } from './gente/gente.module';

@Module({
  imports: [
    // 1. Config - Variáveis de Ambiente
    ConfigModule.forRoot({
      isGlobal: true,
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
        signOptions: { expiresIn: '3h' },
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
    TypeOrmModule.forFeature([Materia, Usuario, Aluno, Grupo, DocumentoInscricao]),
    
    // 5. Módulos Encapsulados (Não adicione os services deles em providers!)
    GruposModule, 
    UsersModule,
    AcademicoModule,
    CadastroModule,
    FuncionariosModule,
    FinanceiroModule,
    EstoqueModule,
    NotificacoesModule,
    RelatoriosModule,
    PesquisasModule,
    GenteModule,
    MatriculasModule,
    EmailModule,
  ],
  controllers: [
    AppController, 
    MateriasController, 
    AuthController, 
    UsuariosController,
    require('./funcionarios/funcionarios.controller').FuncionariosController
  ],
  providers: [
    AppService,
    MateriasService,
    AuthService,
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

      // Coluna usuario_nome em movimentacoes_financeiras
      await this.dataSource.query(`ALTER TABLE movimentacoes_financeiras ADD COLUMN IF NOT EXISTS usuario_nome VARCHAR`);
      this.logger.log('✅ usuario_nome em movimentacoes_financeiras aplicado');

      // Remove FK indevida em grade_horaria (professor_id pode ser de usuarios, não só professores)
      await this.dataSource.query(`ALTER TABLE grade_horaria DROP CONSTRAINT IF EXISTS grade_horaria_professor_id_fkey`);
      // Remove hora_inicio/hora_fim da turma (horários ficam apenas por dia na grade_horaria)
      await this.dataSource.query(`ALTER TABLE turmas DROP COLUMN IF EXISTS hora_inicio`);
      await this.dataSource.query(`ALTER TABLE turmas DROP COLUMN IF EXISTS hora_fim`);
      this.logger.log('✅ grade_horaria FK removida e hora_inicio/hora_fim de turmas removidos');

      // ── Colunas faltantes em funcionarios (schema drift) ─────────────────
      await this.dataSource.query(`
        ALTER TABLE IF EXISTS funcionarios
          ADD COLUMN IF NOT EXISTS raca_cor            TEXT,
          ADD COLUMN IF NOT EXISTS escolaridade        TEXT,
          ADD COLUMN IF NOT EXISTS cep                 TEXT,
          ADD COLUMN IF NOT EXISTS logradouro          TEXT,
          ADD COLUMN IF NOT EXISTS numero_residencia   TEXT,
          ADD COLUMN IF NOT EXISTS bairro              TEXT,
          ADD COLUMN IF NOT EXISTS cidade              TEXT,
          ADD COLUMN IF NOT EXISTS complemento         TEXT,
          ADD COLUMN IF NOT EXISTS estado              TEXT,
          ADD COLUMN IF NOT EXISTS telefone_emergencia_1 TEXT,
          ADD COLUMN IF NOT EXISTS telefone_emergencia_2 TEXT,
          ADD COLUMN IF NOT EXISTS possui_deficiencia  BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS deficiencia_descricao TEXT,
          ADD COLUMN IF NOT EXISTS possui_alergias     BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS alergias_descricao  TEXT,
          ADD COLUMN IF NOT EXISTS usa_medicamentos    BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS medicamentos_descricao TEXT,
          ADD COLUMN IF NOT EXISTS interesse_cursos    BOOLEAN DEFAULT false
      `);
      this.logger.log('✅ Colunas funcionarios (endereço, emergência, saúde) aplicadas (IF NOT EXISTS)');

      // Tabelas de Estoque
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS estoque_produtos (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          nome TEXT NOT NULL,
          categoria TEXT DEFAULT 'Geral',
          unidade_medida TEXT NOT NULL DEFAULT 'un',
          quantidade_atual NUMERIC(12,3) NOT NULL DEFAULT 0,
          estoque_minimo NUMERIC(12,3) NOT NULL DEFAULT 0,
          ativo BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS estoque_movimentos (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          produto_id UUID NOT NULL REFERENCES estoque_produtos(id) ON DELETE CASCADE,
          tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'baixa')),
          quantidade NUMERIC(12,3) NOT NULL,
          observacao TEXT,
          usuario_nome TEXT,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS estoque_categorias (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          nome TEXT NOT NULL UNIQUE,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      // Seed categorias padrão se a tabela estiver vazia
      await this.dataSource.query(`
        INSERT INTO estoque_categorias (nome)
        VALUES ('Insumos - Cozinha'), ('Insumos - Limpeza'), ('Insumos - Material')
        ON CONFLICT (nome) DO NOTHING
      `);
      // Garante colunas adicionadas em versões posteriores (migrations idempotentes)
      await this.dataSource.query(`
        ALTER TABLE IF EXISTS estoque_movimentos
          ADD COLUMN IF NOT EXISTS usuario_nome TEXT,
          ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      `);
      await this.dataSource.query(`
        ALTER TABLE IF EXISTS estoque_categorias
          ADD COLUMN IF NOT EXISTS codigo TEXT UNIQUE
      `);
      await this.dataSource.query(`
        ALTER TABLE IF EXISTS doadores
          ADD COLUMN IF NOT EXISTS codigo_interno TEXT UNIQUE
      `);
      await this.dataSource.query(`
        ALTER TABLE IF EXISTS contas_bancarias
          ADD COLUMN IF NOT EXISTS codigo_interno TEXT UNIQUE
      `);
      await this.dataSource.query(`
        ALTER TABLE IF EXISTS usuarios
          ADD COLUMN IF NOT EXISTS reset_token TEXT,
          ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ
      `);
      await this.dataSource.query(`
        ALTER TABLE IF EXISTS estoque_produtos
          ADD COLUMN IF NOT EXISTS codigo_interno TEXT UNIQUE
      `);

      // ── Tabelas do módulo Acadêmico ───────────────────────────────────────
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS grade_horaria (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          dia_semana INT,
          horario_inicio TIME NOT NULL,
          horario_fim TIME NOT NULL,
          materia_id TEXT,
          nome_curso TEXT,
          professor_id TEXT,
          nome_professor TEXT,
          turma_id TEXT,
          sala TEXT,
          cor TEXT NOT NULL DEFAULT '#7c3aed'
        )
      `);
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS presenca_sessoes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          turma_id TEXT NOT NULL,
          turma_nome TEXT,
          data DATE NOT NULL,
          tema_aula TEXT,
          conteudo_abordado TEXT,
          usuario_id TEXT,
          usuario_nome TEXT,
          total_presentes INT NOT NULL DEFAULT 0,
          total_ausentes INT NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS diario_academico (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tipo TEXT NOT NULL,
          titulo TEXT,
          descricao TEXT,
          aluno_id TEXT,
          aluno_nome TEXT,
          turma_id TEXT,
          data DATE NOT NULL DEFAULT CURRENT_DATE,
          usuario_id TEXT,
          usuario_nome TEXT,
          sessao_id TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      // Garante colunas adicionais em instâncias existentes
      await this.dataSource.query(`
        ALTER TABLE IF EXISTS diario_academico
          ADD COLUMN IF NOT EXISTS sessao_id TEXT,
          ADD COLUMN IF NOT EXISTS aluno_nome TEXT
      `);
      this.logger.log('✅ Tabelas acadêmicas criadas/verificadas (IF NOT EXISTS)');
      this.logger.log('✅ Tabelas de estoque criadas (IF NOT EXISTS)');

      // ── Tabela de Notificações ─────────────────────────────────────────────
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS notificacoes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tipo TEXT NOT NULL,
          titulo TEXT NOT NULL,
          mensagem TEXT NOT NULL,
          lida BOOLEAN NOT NULL DEFAULT false,
          referencia_id TEXT,
          referencia_tipo TEXT,
          usuario_id TEXT,
          criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await this.dataSource.query(`
        ALTER TABLE IF EXISTS notificacoes
          ADD COLUMN IF NOT EXISTS cargo_minimo INT
      `);
      this.logger.log('✅ Tabela notificacoes criada/verificada');

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
          const rolePrefix: Record<string, string> = {
            admin: 'ITP-ADM', vp: 'ITP-VP', drt: 'ITP-DRT', adjunto: 'ITP-ADJ',
            prof: 'ITP-PROF', monitor: 'ITP-MNT', assist: 'ITP-AST', cozinha: 'ITP-CZNH',
          };
          const prefix = rolePrefix[u.role?.toLowerCase()] ?? 'ITP-USR';
          const seq = String(i + 1).padStart(3, '0');
          const matricula = `${prefix}-${yyyymm}-${seq}`;
          await this.dataSource.query(
            `UPDATE usuarios SET matricula = $1 WHERE id = $2 AND matricula IS NULL`,
            [matricula, u.id]
          );
        }
        this.logger.log('✅ Matrículas atribuídas aos usuários existentes.');
      }

      // ── Novas colunas (funcionários + usuários) ───────────────────────────
      await this.dataSource.query(`
        ALTER TABLE IF EXISTS funcionarios
          ADD COLUMN IF NOT EXISTS possui_plano_saude BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS plano_saude TEXT,
          ADD COLUMN IF NOT EXISTS numero_sus TEXT,
          ADD COLUMN IF NOT EXISTS usuario_id UUID UNIQUE
      `);
      await this.dataSource.query(`
        ALTER TABLE IF EXISTS usuarios
          ADD COLUMN IF NOT EXISTS funcionario_id UUID UNIQUE,
          ADD COLUMN IF NOT EXISTS deve_trocar_senha BOOLEAN NOT NULL DEFAULT false
      `);
      // Email pode ser NULL para contas admin que só acessam via matrícula
      await this.dataSource.query(`ALTER TABLE IF EXISTS usuarios ALTER COLUMN email DROP NOT NULL`);
      this.logger.log('✅ Migrations de funcionários/usuários (novas colunas) aplicadas');

      // ── email_responsavel em inscricoes e alunos ───────────────────────────
      await this.dataSource.query(`
        ALTER TABLE IF EXISTS inscricoes
          ADD COLUMN IF NOT EXISTS email_responsavel VARCHAR
      `);
      await this.dataSource.query(`
        ALTER TABLE IF EXISTS alunos
          ADD COLUMN IF NOT EXISTS email_responsavel VARCHAR
      `);
      this.logger.log('✅ Colunas email_responsavel aplicadas (IF NOT EXISTS)');

      // ── Colunas faltantes em turma_alunos (schema drift) ─────────────────
      await this.dataSource.query(`
        ALTER TABLE IF EXISTS turma_alunos
          ADD COLUMN IF NOT EXISTS inscricao_id INT,
          ADD COLUMN IF NOT EXISTS nome_candidato VARCHAR,
          ADD COLUMN IF NOT EXISTS tipo_vinculo VARCHAR NOT NULL DEFAULT 'aluno'
      `);
      this.logger.log('✅ Colunas turma_alunos (inscricao_id, nome_candidato, tipo_vinculo) aplicadas (IF NOT EXISTS)');

      // ── Colunas faltantes em diario_academico (schema drift) ──────────────
      await this.dataSource.query(`
        ALTER TABLE IF EXISTS diario_academico
          ADD COLUMN IF NOT EXISTS inscricao_id INT,
          ADD COLUMN IF NOT EXISTS pessoa_nome TEXT
      `);
      this.logger.log('✅ Colunas diario_academico (inscricao_id, pessoa_nome) aplicadas (IF NOT EXISTS)');

      // ── Coluna cor em turmas ───────────────────────────────────────────────
      await this.dataSource.query(`
        ALTER TABLE IF EXISTS turmas
          ADD COLUMN IF NOT EXISTS cor VARCHAR DEFAULT '#7c3aed'
      `);
      this.logger.log('✅ Coluna turmas.cor aplicada (IF NOT EXISTS)');

      // ── Tabelas de Pesquisas de Satisfação ───────────────────────────────────
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS pesquisas (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          titulo TEXT NOT NULL,
          tipo TEXT NOT NULL,
          perguntas JSONB,
          data_limite TIMESTAMPTZ,
          status TEXT NOT NULL DEFAULT 'aberta',
          link_unico TEXT UNIQUE NOT NULL,
          criado_por_id TEXT,
          criado_por_nome TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS pesquisas_respostas (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          pesquisa_id UUID NOT NULL REFERENCES pesquisas(id) ON DELETE CASCADE,
          respostas JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      this.logger.log('✅ Tabelas pesquisas/pesquisas_respostas criadas (IF NOT EXISTS)');

      // ── Remover FK turmas→professores (professor_id agora referencia usuarios) ──
      await this.dataSource.query(`
        ALTER TABLE IF EXISTS turmas
          DROP CONSTRAINT IF EXISTS turmas_professor_id_fkey
      `);
      this.logger.log('✅ FK turmas_professor_id_fkey removida (IF EXISTS)');

      // ── Coluna nome_turma em grade_horaria ────────────────────────────────
      await this.dataSource.query(`
        ALTER TABLE IF EXISTS grade_horaria
          ADD COLUMN IF NOT EXISTS nome_turma TEXT
      `);
      this.logger.log('✅ Coluna grade_horaria.nome_turma aplicada (IF NOT EXISTS)');

      // ── Colunas de valor/preço no estoque ────────────────────────────────
      await this.dataSource.query(`
        ALTER TABLE IF EXISTS estoque_produtos
          ADD COLUMN IF NOT EXISTS valor_compra NUMERIC(12,2)
      `);
      await this.dataSource.query(`
        ALTER TABLE IF EXISTS estoque_movimentos
          ADD COLUMN IF NOT EXISTS preco_pago NUMERIC(12,2)
      `);
      this.logger.log('✅ Colunas valor_compra/preco_pago aplicadas (IF NOT EXISTS)');

      // ── Coluna categoria em pesquisas ─────────────────────────────────────
      await this.dataSource.query(`
        ALTER TABLE IF EXISTS pesquisas
          ADD COLUMN IF NOT EXISTS categoria TEXT
      `);
      this.logger.log('✅ Coluna pesquisas.categoria aplicada (IF NOT EXISTS)');

      // ── Coluna expurgado em pesquisas_respostas ────────────────────────────
      await this.dataSource.query(`
        ALTER TABLE IF EXISTS pesquisas_respostas
          ADD COLUMN IF NOT EXISTS expurgado BOOLEAN NOT NULL DEFAULT false
      `);
      this.logger.log('✅ Coluna pesquisas_respostas.expurgado aplicada (IF NOT EXISTS)');

      // ── Módulo Gente ──────────────────────────────────────────────────────
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS gente_colaboradores (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          funcionario_id UUID NOT NULL UNIQUE,
          tipo TEXT NOT NULL DEFAULT 'funcionario',
          horario_entrada TEXT,
          horario_saida TEXT,
          dias_trabalho JSONB,
          latitude_permitida NUMERIC(10,7),
          longitude_permitida NUMERIC(10,7),
          raio_metros INT DEFAULT 100,
          ativo BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS gente_ponto (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          colaborador_id UUID NOT NULL,
          tipo TEXT NOT NULL,
          data_hora TIMESTAMPTZ NOT NULL DEFAULT now(),
          latitude NUMERIC(10,7),
          longitude NUMERIC(10,7),
          distancia_metros NUMERIC,
          dentro_area BOOLEAN,
          observacao TEXT,
          registrado_por TEXT DEFAULT 'system',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS gente_recibos (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          colaborador_id UUID NOT NULL,
          mes_referencia TEXT NOT NULL,
          valor NUMERIC(12,2) NOT NULL DEFAULT 0,
          descricao TEXT,
          data_pagamento DATE,
          status TEXT NOT NULL DEFAULT 'pendente',
          observacao TEXT,
          criado_por_id TEXT,
          criado_por_nome TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS gente_vales (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          colaborador_id UUID NOT NULL,
          tipo TEXT NOT NULL DEFAULT 'outro',
          valor NUMERIC(12,2) NOT NULL,
          data DATE NOT NULL,
          descricao TEXT,
          descontado BOOLEAN NOT NULL DEFAULT false,
          criado_por_id TEXT,
          criado_por_nome TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS gente_advertencias (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          colaborador_id UUID NOT NULL,
          data DATE NOT NULL,
          motivo TEXT NOT NULL,
          descricao TEXT,
          nivel TEXT NOT NULL DEFAULT 'escrita',
          criado_por_id TEXT,
          criado_por_nome TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS gente_suspensoes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          colaborador_id UUID NOT NULL,
          data_inicio DATE NOT NULL,
          data_fim DATE NOT NULL,
          motivo TEXT NOT NULL,
          com_desconto BOOLEAN NOT NULL DEFAULT true,
          criado_por_id TEXT,
          criado_por_nome TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS gente_faltas (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          colaborador_id UUID NOT NULL,
          data DATE NOT NULL,
          justificada BOOLEAN NOT NULL DEFAULT false,
          motivo TEXT,
          com_desconto BOOLEAN NOT NULL DEFAULT true,
          observacao TEXT,
          criado_por_id TEXT,
          criado_por_nome TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS gente_codigos_ajuda (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          codigo TEXT NOT NULL UNIQUE,
          descricao TEXT NOT NULL,
          valor_base NUMERIC(12,2) NOT NULL DEFAULT 0,
          ativo BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS gente_colaborador_codigos (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          colaborador_id UUID NOT NULL,
          codigo_id UUID NOT NULL REFERENCES gente_codigos_ajuda(id) ON DELETE CASCADE,
          valor_personalizado NUMERIC(12,2),
          ativo BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await this.dataSource.query(`
        ALTER TABLE IF EXISTS funcionarios
          ADD COLUMN IF NOT EXISTS foto TEXT,
          ADD COLUMN IF NOT EXISTS estado_civil TEXT,
          ADD COLUMN IF NOT EXISTS pais TEXT DEFAULT 'Brasil',
          ADD COLUMN IF NOT EXISTS rg TEXT,
          ADD COLUMN IF NOT EXISTS orgao_emissor_rg TEXT,
          ADD COLUMN IF NOT EXISTS data_emissao_rg DATE
      `);
      await this.dataSource.query(`
        ALTER TABLE IF EXISTS gente_colaboradores
          ADD COLUMN IF NOT EXISTS salario_base NUMERIC(12,2)
      `);
      await this.dataSource.query(`
        ALTER TABLE IF EXISTS gente_colaboradores
          ADD COLUMN IF NOT EXISTS jornada_flexivel BOOLEAN NOT NULL DEFAULT false
      `);
      await this.dataSource.query(`ALTER TABLE gente_ponto ADD COLUMN IF NOT EXISTS assinatura TEXT`);
      await this.dataSource.query(`ALTER TABLE gente_colaboradores ADD COLUMN IF NOT EXISTS horas_dia_flex INT`);
      await this.dataSource.query(`ALTER TABLE gente_colaboradores ADD COLUMN IF NOT EXISTS horario_flexivel_semana JSONB`);
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS gente_folga_solicitacoes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          colaborador_id UUID NOT NULL REFERENCES gente_colaboradores(id) ON DELETE CASCADE,
          data DATE NOT NULL,
          status TEXT NOT NULL DEFAULT 'pendente',
          motivo TEXT,
          respondido_por TEXT,
          respondido_em TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS gente_trabalho_externo (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          colaborador_id UUID NOT NULL REFERENCES gente_colaboradores(id) ON DELETE CASCADE,
          data DATE NOT NULL,
          autorizado_por TEXT NOT NULL,
          autorizado_por_id UUID,
          ativo BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS gente_colaborador_locais (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          colaborador_id UUID NOT NULL REFERENCES gente_colaboradores(id) ON DELETE CASCADE,
          nome TEXT NOT NULL,
          latitude NUMERIC(10,7) NOT NULL,
          longitude NUMERIC(10,7) NOT NULL,
          raio_metros INT NOT NULL DEFAULT 100,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await this.dataSource.query(`
        ALTER TABLE IF EXISTS gente_faltas
          ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'falta',
          ADD COLUMN IF NOT EXISTS data_fim DATE
      `);
      this.logger.log('✅ Colunas gente_faltas (tipo, data_fim) aplicadas (IF NOT EXISTS)');
      await this.dataSource.query(`
        ALTER TABLE IF EXISTS gente_faltas
          ADD COLUMN IF NOT EXISTS percentual_desconto FLOAT
      `);
      this.logger.log('✅ Coluna gente_faltas.percentual_desconto aplicada (IF NOT EXISTS)');
      await this.dataSource.query(`
        ALTER TABLE IF EXISTS gente_faltas
          ADD COLUMN IF NOT EXISTS anexo TEXT,
          ADD COLUMN IF NOT EXISTS anexo_nome TEXT
      `);
      this.logger.log('✅ Colunas gente_faltas (anexo, anexo_nome) aplicadas (IF NOT EXISTS)');
      await this.dataSource.query(`
        ALTER TABLE IF EXISTS funcionarios
          ADD COLUMN IF NOT EXISTS genero TEXT,
          ADD COLUMN IF NOT EXISTS pertence_comunidade_tradicional BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS comunidade_tradicional TEXT,
          ADD COLUMN IF NOT EXISTS possui_cad_unico BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS baixo_idh BOOLEAN DEFAULT false
      `);
      this.logger.log('✅ Colunas funcionarios (genero, comunidade, cad_unico, baixo_idh) aplicadas (IF NOT EXISTS)');
      await this.dataSource.query(`
        ALTER TABLE IF EXISTS gente_folga_solicitacoes
          ADD COLUMN IF NOT EXISTS realizada BOOLEAN
      `);
      this.logger.log('✅ Coluna gente_folga_solicitacoes.realizada aplicada (IF NOT EXISTS)');
      await this.dataSource.query(`
        ALTER TABLE IF EXISTS gente_colaboradores
          ADD COLUMN IF NOT EXISTS valor_passagem NUMERIC(10,2)
      `);
      this.logger.log('✅ Coluna gente_colaboradores.valor_passagem aplicada (IF NOT EXISTS)');
      await this.dataSource.query(`
        ALTER TABLE IF EXISTS funcionarios
          ADD COLUMN IF NOT EXISTS data_nascimento DATE,
          ADD COLUMN IF NOT EXISTS celular TEXT,
          ADD COLUMN IF NOT EXISTS sexo TEXT
      `);
      this.logger.log('✅ Colunas funcionarios (data_nascimento, celular, sexo) garantidas (IF NOT EXISTS)');
      await this.dataSource.query(`
        ALTER TABLE IF EXISTS gente_advertencias
          ADD COLUMN IF NOT EXISTS valor_desconto NUMERIC(10,2)
      `);
      this.logger.log('✅ Coluna gente_advertencias.valor_desconto aplicada (IF NOT EXISTS)');
      await this.dataSource.query(`
        ALTER TABLE IF EXISTS gente_vales
          ADD COLUMN IF NOT EXISTS forma_pagamento TEXT,
          ADD COLUMN IF NOT EXISTS movimentacao_saida_id TEXT,
          ADD COLUMN IF NOT EXISTS movimentacao_entrada_id TEXT
      `);
      this.logger.log('✅ Colunas gente_vales (forma_pagamento, movimentacao_saida_id, movimentacao_entrada_id) aplicadas (IF NOT EXISTS)');
      this.logger.log('✅ Tabelas do módulo Gente criadas (IF NOT EXISTS)');

      // ── CPF, email e celular opcionais em inscricoes ───────────────────────
      await this.dataSource.query(`ALTER TABLE IF EXISTS inscricoes ALTER COLUMN cpf DROP NOT NULL`);
      await this.dataSource.query(`ALTER TABLE IF EXISTS inscricoes ALTER COLUMN email DROP NOT NULL`);
      await this.dataSource.query(`ALTER TABLE IF EXISTS inscricoes ALTER COLUMN celular DROP NOT NULL`);
      this.logger.log('✅ cpf/email/celular em inscricoes passaram a ser opcionais (DROP NOT NULL)');

    } catch (err: any) {
      this.logger.error(`❌ Erro nas migrations automáticas: ${err.message}`);
    }
  }
}