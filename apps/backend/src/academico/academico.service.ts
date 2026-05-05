import { Injectable, NotFoundException, ConflictException, BadRequestException, UnauthorizedException, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { Curso } from './entities/curso.entity';
import { Professor } from './entities/professor.entity';
import { Turma } from './entities/turma.entity';
import { TurmaAluno } from './entities/turma-aluno.entity';
import { GradeHoraria } from './entities/grade-horaria.entity';
import { DiarioAcademico } from './entities/diario.entity';
import { PresencaSessao } from './entities/presenca-sessao.entity';
import { ChamadoAcademico } from './entities/chamado.entity';
import { Aluno } from '../alunos/aluno.entity';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { InjectDataSource } from '@nestjs/typeorm';

@Injectable()
export class AcademicoService {
  private readonly logger = new Logger(AcademicoService.name);

  constructor(
    @InjectRepository(Curso)              private cursoRepo: Repository<Curso>,
    @InjectRepository(Professor)          private professorRepo: Repository<Professor>,
    @InjectRepository(Turma)              private turmaRepo: Repository<Turma>,
    @InjectRepository(GradeHoraria)       private gradeRepo: Repository<GradeHoraria>,
    @InjectRepository(DiarioAcademico)    private diarioRepo: Repository<DiarioAcademico>,
    @InjectRepository(PresencaSessao)     private sessaoRepo: Repository<PresencaSessao>,
    @InjectRepository(ChamadoAcademico)   private chamadoRepo: Repository<ChamadoAcademico>,
    @InjectRepository(Aluno)              private alunoRepo: Repository<Aluno>,
    @InjectRepository(TurmaAluno)         private turmaAlunoRepo: Repository<TurmaAluno>,
    private readonly notificacoes: NotificacoesService,
    @InjectDataSource()                   private readonly dataSource: DataSource,
  ) {}

  // ── UTILITÁRIOS ───────────────────────────────────────────────────────────

  /** Gera CRS-YYYYMMX onde X é sequência do mês */
  private async gerarCodigoCurso(): Promise<string> {
    const now = new Date();
    const base = `CRS-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const existentes = await this.cursoRepo
      .createQueryBuilder('c')
      .where('c.codigo LIKE :base', { base: `${base}%` })
      .getCount();
    return `${base}${existentes + 1}`;
  }

  /** Gera TRM-[SIGLA]-YYYYMMX onde X é sequência do mês para aquela sigla */
  private async gerarCodigoTurma(siglaCurso: string): Promise<string> {
    const now = new Date();
    const base = `TRM-${siglaCurso.toUpperCase()}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const existentes = await this.turmaRepo
      .createQueryBuilder('t')
      .where('t.codigo LIKE :base', { base: `${base}%` })
      .getCount();
    return `${base}${existentes + 1}`;
  }

  // ── CURSOS ────────────────────────────────────────────────────────────────

  listarCursos() {
    this.logger.log('Listando cursos');
    return this.cursoRepo.find({ order: { nome: 'ASC' } });
  }

  listarCursosAtivos() {
    this.logger.log('Listando cursos ativos');
    return this.cursoRepo.find({ 
      where: { status: 'Ativo' },
      order: { nome: 'ASC' } 
    });
  }

  async criarCurso(dto: Partial<Curso>) {
    this.logger.log(`Criando curso: ${dto.nome} | sigla: ${dto.sigla}`);
    if (!dto.nome || !dto.sigla) throw new BadRequestException('Nome e sigla são obrigatórios');

    const existente = await this.cursoRepo.findOne({ where: { sigla: dto.sigla.toUpperCase() } });
    if (existente) throw new ConflictException(`Já existe um curso com a sigla ${dto.sigla.toUpperCase()}`);

    const codigo = await this.gerarCodigoCurso();
    const curso = this.cursoRepo.create({ ...dto, sigla: dto.sigla.toUpperCase(), codigo });
    const salvo = await this.cursoRepo.save(curso);
    this.logger.log(`Curso criado: ${salvo.codigo} - ${salvo.nome}`);
    return salvo;
  }

  async editarCurso(id: string, dto: Partial<Curso>) {
    this.logger.log(`Editando curso id=${id}`);
    const curso = await this.cursoRepo.findOneBy({ id });
    if (!curso) throw new NotFoundException('Curso não encontrado');
    if (dto.sigla) dto.sigla = dto.sigla.toUpperCase();
    await this.cursoRepo.update(id, dto);
    return this.cursoRepo.findOneByOrFail({ id });
  }

  async deletarCurso(id: string) {
    this.logger.warn(`Deletando curso id=${id}`);
    const turmasVinculadas = await this.turmaRepo.count({ where: { curso_id: id } });
    if (turmasVinculadas > 0) throw new ConflictException('Não é possível excluir um curso com turmas vinculadas');
    await this.cursoRepo.delete(id);
  }

  // ── PROFESSORES ───────────────────────────────────────────────────────────

  async listarProfessores() {
    this.logger.log('Listando professores via funcionarios');
    const rows = await this.dataSource.query(`
      SELECT
        id::text       AS id,
        nome,
        cargo          AS especialidade,
        email,
        cpf,
        celular,
        ativo
      FROM funcionarios
      WHERE cargo ILIKE '%Professor%'
        AND (ativo IS NOT FALSE)
      ORDER BY nome ASC
    `);
    return rows;
  }

  async criarProfessor(dto: Partial<Professor>) {
    this.logger.log(`Criando professor: ${dto.nome}`);
    if (!dto.nome) throw new BadRequestException('Nome é obrigatório');
    const prof = this.professorRepo.create(dto);
    const salvo = await this.professorRepo.save(prof);
    this.logger.log(`Professor criado: ${salvo.id} - ${salvo.nome}`);
    return salvo;
  }

  async editarProfessor(id: string, dto: Partial<Professor>) {
    this.logger.log(`Editando professor id=${id}`);
    const prof = await this.professorRepo.findOneBy({ id });
    if (!prof) throw new NotFoundException('Professor não encontrado');
    await this.professorRepo.update(id, dto);
    return this.professorRepo.findOneByOrFail({ id });
  }

  async deletarProfessor(id: string) {
    this.logger.warn(`Deletando professor id=${id}`);
    await this.professorRepo.delete(id);
  }

  // ── TURMAS ────────────────────────────────────────────────────────────────

  async listarTurmas() {
    this.logger.log('Listando turmas');
    const turmas = await this.turmaRepo.find({ order: { nome: 'ASC' } });
    const counts: { turma_id: string; total: string }[] = await this.dataSource.query(
      `SELECT turma_id, COUNT(*) AS total FROM turma_alunos WHERE status = 'ativo' AND turma_id IS NOT NULL GROUP BY turma_id`
    );
    const countMap = Object.fromEntries(counts.map(c => [c.turma_id, parseInt(c.total, 10)]));
    return turmas.map(t => ({ ...t, total_alunos: countMap[t.id] ?? 0 }));
  }

  async criarTurma(dto: Partial<Turma>) {
    this.logger.log(`Criando turma: ${dto.nome} | curso_id=${dto.curso_id} | professor_id=${dto.professor_id}`);
    if (!dto.nome) throw new BadRequestException('Nome da turma é obrigatório');
    if (!dto.curso_id) throw new BadRequestException('É obrigatório selecionar um curso para a turma');

    const curso = await this.cursoRepo.findOneBy({ id: dto.curso_id });
    if (!curso) throw new NotFoundException('Curso não encontrado');

    const codigo = await this.gerarCodigoTurma(curso.sigla);
    const turma = this.turmaRepo.create({ ...dto, codigo });
    const salva = await this.turmaRepo.save(turma);
    this.logger.log(`Turma criada: ${salva.codigo} - ${salva.nome}`);
    return salva;
  }

  async editarTurma(id: string, dto: Partial<Turma>) {
    this.logger.log(`Editando turma id=${id}`);
    const turma = await this.turmaRepo.findOneBy({ id });
    if (!turma) throw new NotFoundException('Turma não encontrada');
    // Sanitize: empty string em campos UUID deve virar null (evita erro no PostgreSQL)
    if (dto.professor_id === '') (dto as any).professor_id = null;
    if (dto.curso_id === '') (dto as any).curso_id = null;
    // Remove campos virtuais que não existem na entidade
    const { total_alunos: _ta, ...dtoLimpo } = dto as any;
    await this.turmaRepo.update(id, dtoLimpo);
    return this.turmaRepo.findOneByOrFail({ id });
  }

  async deletarTurma(id: string) {
    this.logger.warn(`Deletando turma id=${id}`);
    const alunosNaTurma = await this.turmaAlunoRepo.count({ where: { turma_id: id, status: 'ativo' } });
    if (alunosNaTurma > 0) throw new ConflictException('Não é possível excluir uma turma com alunos ativos');
    await this.turmaRepo.delete(id);
  }

  // ── GRADE HORÁRIA ─────────────────────────────────────────────────────────

  async listarGrade() {
    this.logger.log('Listando grade horária');
    try {
      return await this.dataSource.query(`
        SELECT g.*,
          COALESCE(
            (SELECT nome FROM turmas WHERE id::text = g.turma_id::text LIMIT 1),
            g.nome_turma
          ) AS nome_turma,
          COALESCE(
            (SELECT nome FROM usuarios WHERE id::text = (
              SELECT professor_id::text FROM turmas WHERE id::text = g.turma_id::text LIMIT 1
            ) LIMIT 1),
            (SELECT nome FROM funcionarios WHERE id::text = (
              SELECT professor_id::text FROM turmas WHERE id::text = g.turma_id::text LIMIT 1
            ) LIMIT 1),
            g.nome_professor
          ) AS nome_professor
        FROM grade_horaria g
        ORDER BY g.dia_semana ASC, g.horario_inicio ASC NULLS LAST
      `);
    } catch (err: any) {
      this.logger.error(`[listarGrade] ERRO SQL: ${err.message}`);
      throw err;
    }
  }

  async criarCardGrade(dto: Partial<GradeHoraria>) {
    this.logger.log(`Criando card grade: dia=${dto.dia_semana} ${dto.horario_inicio}-${dto.horario_fim} turma=${dto.turma_id}`);
    if (dto.dia_semana === undefined || dto.dia_semana === null) throw new BadRequestException('Dia da semana é obrigatório');
    if (!dto.horario_inicio) throw new BadRequestException('Hora início é obrigatória');
    if (!dto.horario_fim)    throw new BadRequestException('Hora fim é obrigatória');
    if (!dto.turma_id)       throw new BadRequestException('Turma é obrigatória');

    // Validar que a turma existe
    const turma = await this.turmaRepo.findOneBy({ id: dto.turma_id });
    if (!turma) throw new NotFoundException('Turma não encontrada');

    // Buscar dados da turma para preencher automaticamente
    let nomeCurso = dto.nome_curso;
    let nomeProfessor = dto.nome_professor;
    let professorId = dto.professor_id;

    if (turma.curso_id) {
      const curso = await this.cursoRepo.findOneBy({ id: turma.curso_id });
      if (curso) nomeCurso = curso.nome;
    }
    if (turma.professor_id) {
      const prof = await this.professorRepo.findOneBy({ id: turma.professor_id });
      if (prof) { nomeProfessor = prof.nome; professorId = prof.id; }
      else {
        // Fallback: professor pode ser um usuário do sistema (tabela usuarios)
        const rows = await this.dataSource.query(
          `SELECT nome FROM usuarios WHERE id = $1 LIMIT 1`, [turma.professor_id]
        );
        if (rows[0]) { nomeProfessor = rows[0].nome; professorId = turma.professor_id; }
      }
    }

    // Usar cor da turma se não foi especificada explicitamente no dto
    const corCard = dto.cor || (turma as any).cor || '#7c3aed';
    const card = this.gradeRepo.create({
      ...dto,
      nome_turma: turma.nome,
      nome_curso: nomeCurso,
      nome_professor: nomeProfessor,
      professor_id: professorId,
      cor: corCard,
    });
    const salvo = await this.gradeRepo.save(card);
    this.logger.log(`Card grade criado: ${salvo.id}`);
    return salvo;
  }

  async moverCardGrade(id: string, dto: Partial<GradeHoraria>) {
    this.logger.log(`Movendo card grade id=${id}`);
    await this.gradeRepo.update(id, dto);
    return this.gradeRepo.findOneByOrFail({ id });
  }

  async deletarCardGrade(id: string) {
    this.logger.warn(`Deletando card grade id=${id}`);
    await this.gradeRepo.delete(id);
  }

  // ── ALUNOS ────────────────────────────────────────────────────────────────

  async statsAlunos() {
    const rows = await this.dataSource.query(
      `SELECT COUNT(*) FILTER (WHERE ativo = true)  AS ativos,
              COUNT(*) FILTER (WHERE ativo = false) AS inativos,
              COUNT(*)                               AS total
       FROM alunos`
    );
    const r = rows[0];
    return {
      ativos:   Number(r.ativos),
      inativos: Number(r.inativos),
      total:    Number(r.total),
    };
  }

  async listarAlunos(filtros: any) {
    this.logger.log(`Listando alunos filtros=${JSON.stringify(filtros)}`);
    let qb = this.alunoRepo.createQueryBuilder('a');
    // Alunos inativos nunca aparecem em listagens
    qb = qb.where('a.ativo = true');
    if (filtros.nome)     qb = qb.andWhere('LOWER(a.nome_completo) LIKE :nome', { nome: `%${filtros.nome.toLowerCase()}%` });
    if (filtros.cpf)      qb = qb.andWhere('a.cpf LIKE :cpf', { cpf: `%${filtros.cpf.replace(/\D/g, '')}%` });
    if (filtros.cidade)   qb = qb.andWhere('LOWER(a.cidade) LIKE :cidade', { cidade: `%${filtros.cidade.toLowerCase()}%` });
    if (filtros.turno)    qb = qb.andWhere('a.turno_escolar = :turno', { turno: filtros.turno });
    if (filtros.sexo)     qb = qb.andWhere('a.sexo = :sexo', { sexo: filtros.sexo });
    if (filtros.curso)    qb = qb.andWhere('LOWER(a.cursos_matriculados) LIKE :curso', { curso: `%${filtros.curso.toLowerCase()}%` });
    if (filtros.turma_id) {
      qb = qb
        .innerJoin('turma_alunos', 'ta', 'ta.aluno_id::text = a.id::text')
        .andWhere('ta.turma_id = :turmaId', { turmaId: filtros.turma_id })
        .andWhere('ta.status = :taStatus', { taStatus: 'ativo' });
    }
    const alunos = await qb.orderBy('a.ativo', 'DESC').addOrderBy('a.nome_completo', 'ASC').getMany();
    if (!alunos.length) return alunos;
    // Enriquece com turmas e foto separadamente (falhas independentes)
    const alunoIds = alunos.map(a => `'${a.id}'`).join(',');

    let turmaMap: Record<string, any[]> = {};
    try {
      const turmaRows = await this.dataSource.query(
        `SELECT ta.aluno_id::text AS aluno_id,
            jsonb_agg(jsonb_build_object('id', ta.turma_id::text, 'nome', t.nome, 'cor', COALESCE(t.cor,'#6d28d9'), 'status', ta.status))
            FILTER (WHERE ta.turma_id IS NOT NULL) AS turmas
         FROM turma_alunos ta
         LEFT JOIN turmas t ON ta.turma_id IS NOT NULL AND t.id::text = ta.turma_id::text
         WHERE ta.aluno_id::text IN (${alunoIds})
         GROUP BY ta.aluno_id`,
      );
      turmaRows.forEach((r: any) => {
        const parsed = typeof r.turmas === 'string' ? JSON.parse(r.turmas) : (r.turmas ?? []);
        turmaMap[r.aluno_id] = Array.isArray(parsed) ? parsed : [];
      });
    } catch (e: any) {
      this.logger.warn(`[listarAlunos] turmas falhou: ${e?.message}`);
    }

    let fotoMap: Record<string, string> = {};
    try {
      // Usa inscricoes.aluno_id para cobrir alunos onde alunos.inscricao_id ainda é NULL (registros antigos)
      const fotoRows = await this.dataSource.query(
        `SELECT DISTINCT ON (a.id) a.id::text AS aluno_id, d.url_arquivo AS foto_url
         FROM alunos a
         JOIN inscricoes i ON i.aluno_id::text = a.id::text
         JOIN documentos_inscricao d ON d.inscricao_id = i.id AND d.tipo = 'foto_aluno'
         WHERE a.id::text IN (${alunoIds})
         ORDER BY a.id, d.created_at DESC`,
      );
      fotoRows.forEach((r: any) => { fotoMap[r.aluno_id] = r.foto_url; });
    } catch (e: any) {
      this.logger.warn(`[listarAlunos] fotos falhou: ${e?.message}`);
    }

    // Fallback: preenche CPF (e email/celular) de inscricoes para alunos com campos vazios
    let inscMap: Record<string, any> = {};
    try {
      const inscRows = await this.dataSource.query(
        `SELECT i.aluno_id::text, i.cpf, i.email, i.celular, i.data_nascimento
         FROM inscricoes i
         WHERE i.aluno_id::text IN (${alunoIds})`,
      );
      inscRows.forEach((r: any) => { inscMap[r.aluno_id] = r; });
    } catch (e: any) {
      this.logger.warn(`[listarAlunos] inscricoes fallback falhou: ${e?.message}`);
    }

    return alunos.map(a => {
      const insc = inscMap[a.id];
      return {
        ...a,
        cpf:            a.cpf            || insc?.cpf            || null,
        email:          a.email          || insc?.email          || null,
        celular:        a.celular        || insc?.celular        || null,
        data_nascimento: a.data_nascimento || insc?.data_nascimento || null,
        turmas: turmaMap[a.id] ?? [],
        foto_url: fotoMap[a.id] ?? null,
        turma_status: (turmaMap[a.id] ?? []).find((t: any) => t.status === 'ativo') ? 'ativo' : ((turmaMap[a.id] ?? []).length ? 'backlog' : 'sem_turma'),
        turma_nome: (turmaMap[a.id] ?? []).find((t: any) => t.status === 'ativo')?.nome ?? null,
      };
    });
  }

  async fichaAluno(id: string) {
    this.logger.log(`Carregando ficha do aluno id=${id}`);
    const aluno = await this.alunoRepo.findOneBy({ id });
    if (!aluno) throw new NotFoundException('Aluno não encontrado');

    // Busca inscricao_id: direto na coluna OU via inscricoes.aluno_id (cobre alunos criados sem workflow)
    const [row] = await this.dataSource.query(
      `SELECT COALESCE(a.inscricao_id, i.id) AS inscricao_id
       FROM alunos a
       LEFT JOIN inscricoes i ON i.aluno_id::text = a.id::text
       WHERE a.id = $1
       LIMIT 1`,
      [id],
    );
    const inscricao_id: number | null = row?.inscricao_id ?? null;

    const [frequencia, historico, turmasDoAluno] = await Promise.all([
      this.diarioRepo.find({ where: { aluno_id: id, tipo: 'Presença' }, order: { data: 'DESC' } }),
      this.diarioRepo.find({ where: { aluno_id: id }, order: { created_at: 'DESC' } }),
      this.dataSource.query(
        `SELECT ta.id::text, ta.turma_id::text, ta.status, t.nome AS turma_nome, t.cor AS turma_cor, t.turno
         FROM turma_alunos ta
         LEFT JOIN turmas t ON ta.turma_id IS NOT NULL AND t.id::text = ta.turma_id::text
         WHERE ta.aluno_id::text = $1
         ORDER BY ta.status DESC, t.nome ASC`, [id]
      ),
    ]);

    const turmaInfo: Turma | null = turmasDoAluno.find((t: any) => t.status === 'ativo' && t.turma_id)
      ? await this.turmaRepo.findOneBy({ id: turmasDoAluno.find((t: any) => t.status === 'ativo' && t.turma_id).turma_id }).catch(() => null)
      : null;

    const totalPresencas = frequencia.filter(f => f.descricao?.toLowerCase().includes('presente')).length;
    const totalFaltas    = frequencia.filter(f => f.descricao?.toLowerCase().includes('falta') || !f.descricao?.toLowerCase().includes('presente')).length;

    let foto_url: string | null = null;
    try {
      // Tenta via inscricao_id direto ou via inscricoes.aluno_id (cobre registros antigos)
      const [fotoRow] = await this.dataSource.query(
        `SELECT url_arquivo FROM documentos_inscricao
         WHERE inscricao_id = COALESCE($1, (SELECT id FROM inscricoes WHERE aluno_id::text = $2 LIMIT 1))
           AND tipo = 'foto_aluno'
         ORDER BY created_at DESC LIMIT 1`,
        [inscricao_id, id],
      );
      foto_url = fotoRow?.url_arquivo ?? null;
    } catch { /* sem foto */ }

    // Fallback: preenche campos vazios do aluno com dados da inscrição original
    if (inscricao_id) {
      try {
        const [insc] = await this.dataSource.query(
          `SELECT cpf, email, celular, data_nascimento, nome_responsavel, cpf_responsavel,
                  email_responsavel, grau_parentesco, nome_completo,
                  logradouro, numero, complemento, bairro, cidade, estado_uf, cep,
                  possui_alergias, alergias_descricao, cuidado_especial, detalhes_cuidado,
                  uso_medicamento, medicamentos_descricao, sexo
           FROM inscricoes WHERE id = $1 LIMIT 1`,
          [inscricao_id],
        );
        if (insc) {
          const fields = [
            'cpf','email','celular','data_nascimento','nome_responsavel','cpf_responsavel',
            'email_responsavel','grau_parentesco','logradouro','numero','complemento',
            'bairro','cidade','estado_uf','cep','possui_alergias','alergias_descricao',
            'cuidado_especial','detalhes_cuidado','uso_medicamento','medicamentos_descricao','sexo',
          ];
          for (const f of fields) {
            if ((aluno as any)[f] == null && insc[f] != null) (aluno as any)[f] = insc[f];
          }
        }
      } catch { /* sem inscricao, ok */ }
    }

    this.logger.log(`Ficha do aluno ${aluno.nome_completo}: ${historico.length} registros no diário, inscricao_id=${inscricao_id}`);
    return { aluno, inscricao_id, frequencia, historico, turmaInfo, turmasDoAluno, totalPresencas, totalFaltas, foto_url };
  }

  async criarAluno(dto: Partial<Aluno>) {
    if (!dto.nome_completo) throw new BadRequestException('Nome completo é obrigatório');
    const hoje = new Date();
    const anoStr = String(hoje.getFullYear());
    const mesStr = String(hoje.getMonth() + 1).padStart(2, '0');
    const diaStr = String(hoje.getDate()).padStart(2, '0');

    // Gera número de matrícula seqüencial do dia usando SQL direto (mais robusto no serverless)
    const [{ count: contaHojeStr }] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM alunos WHERE data_matricula::date = CURRENT_DATE`,
    );
    const contaHoje = parseInt(contaHojeStr, 10) || 0;
    const numero_matricula = `ITP-${anoStr}-${mesStr}${diaStr}${contaHoje + 1}`;

    const cpfLimpo = dto.cpf ? dto.cpf.replace(/\D/g, '') : null;
    if (cpfLimpo) {
      const duplicado = await this.alunoRepo.findOneBy({ cpf: cpfLimpo });
      if (duplicado) throw new ConflictException(`CPF já cadastrado para o aluno: ${duplicado.nome_completo}`);
    } else if (dto.nome_completo && dto.data_nascimento) {
      const [dup] = await this.dataSource.query(
        `SELECT id, nome_completo FROM alunos WHERE LOWER(TRIM(nome_completo)) = LOWER(TRIM($1)) AND data_nascimento = $2 AND ativo = true LIMIT 1`,
        [dto.nome_completo, dto.data_nascimento],
      );
      if (dup) throw new ConflictException(`Aluno com mesmo nome e data de nascimento já cadastrado: ${dup.nome_completo}`);
    }

    // Insere apenas os campos escalares — sem spread de relações do TypeORM
    const [result] = await this.dataSource.query(
      `INSERT INTO alunos
        (numero_matricula, nome_completo, cpf, email, celular, data_nascimento,
         sexo, turno_escolar, cidade, bairro, nome_responsavel,
         maior_18_anos, ativo, data_matricula, lgpd_aceito, autoriza_imagem,
         cursos_matriculados, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,NOW(),false,false,$13,NOW(),NOW())
       RETURNING *`,
      [
        numero_matricula,
        dto.nome_completo,
        cpfLimpo || null,
        dto.email || null,
        dto.celular || null,
        dto.data_nascimento || null,
        dto.sexo || null,
        dto.turno_escolar || null,
        dto.cidade || null,
        dto.bairro || null,
        dto.nome_responsavel || null,
        dto.maior_18_anos !== undefined ? dto.maior_18_anos : null,
        dto.cursos_matriculados || null,
      ],
    );

    const salvo = result;
    this.logger.log(`Aluno criado diretamente: ${salvo.numero_matricula} – ${salvo.nome_completo}`);

    // Adiciona ao backlog automaticamente
    await this.dataSource.query(
      `INSERT INTO turma_alunos (id, aluno_id, status, tipo_vinculo, created_at)
       VALUES (gen_random_uuid(), $1, 'backlog', 'aluno', NOW())`,
      [salvo.id],
    ).catch((e: any) => this.logger.warn('Falha ao adicionar backlog: ' + e?.message));

    await this.notificacoes.criar({
      tipo: 'novo_aluno',
      titulo: `Novo aluno cadastrado: ${salvo.nome_completo}`,
      mensagem: `O aluno "${salvo.nome_completo}" foi cadastrado com matrícula ${salvo.numero_matricula}.`,
      referencia_id: salvo.id,
      referencia_tipo: 'aluno',
    }).catch(() => {});

    return salvo;
  }

  async editarAluno(id: string, dto: Partial<Aluno>) {
    const aluno = await this.alunoRepo.findOneBy({ id });
    if (!aluno) throw new NotFoundException('Aluno não encontrado');
    if (dto.cpf) dto.cpf = dto.cpf.replace(/\D/g, '');
    await this.alunoRepo.update(id, dto);
    return this.alunoRepo.findOneByOrFail({ id });
  }

  async deletarAluno(id: string) {
    const aluno = await this.alunoRepo.findOneBy({ id });
    if (!aluno) throw new NotFoundException('Aluno não encontrado');
    await this.alunoRepo.update(id, { ativo: false });
    return { message: 'Aluno desativado com sucesso' };
  }

  async excluirAlunoPermanente(id: string) {
    const aluno = await this.alunoRepo.findOneBy({ id });
    if (!aluno) throw new NotFoundException('Aluno não encontrado');
    if (aluno.ativo) throw new BadRequestException('Só é possível excluir alunos inativos.');
    await this.dataSource.query(`DELETE FROM turma_alunos WHERE aluno_id = $1`, [id]);
    await this.dataSource.query(`DELETE FROM diario_academico WHERE aluno_id = $1`, [id]);
    await this.alunoRepo.delete(id);
    return { message: 'Aluno excluído permanentemente.' };
  }

  // ── TURMA ALUNOS / BACKLOG ─────────────────────────────────────────────────

  async listarBacklog() {
    this.logger.log('Listando backlog de alunos');
    return this.dataSource.query(`
      SELECT ta.id::text, ta.aluno_id::text, ta.status, ta.created_at,
             a.nome_completo, a.numero_matricula, a.celular
      FROM turma_alunos ta
      JOIN alunos a ON a.id::text = ta.aluno_id::text
      WHERE ta.status = 'backlog' AND a.ativo = true
      ORDER BY ta.created_at ASC
    `);
  }

  async listarAlunosDaTurma(turmaId: string) {
    this.logger.log(`Listando alunos da turma id=${turmaId}`);
    return this.dataSource.query(
      `SELECT ta.id::text AS vinculo_id, ta.status AS vinculo_status, ta.created_at AS vinculado_em,
              a.id::text AS id, a.nome_completo, a.cpf, a.celular, a.email,
              a.data_nascimento, a.ativo, a.numero_matricula,
              d.url_arquivo AS foto_url
       FROM turma_alunos ta
       JOIN alunos a ON a.id = ta.aluno_id
       LEFT JOIN LATERAL (
         SELECT url_arquivo FROM documentos_inscricao
         WHERE inscricao_id = a.inscricao_id AND tipo = 'foto_aluno'
         ORDER BY created_at DESC LIMIT 1
       ) d ON true
       WHERE ta.turma_id::text = $1 AND ta.status = 'ativo' AND a.ativo = true
       ORDER BY a.nome_completo ASC`,
      [turmaId],
    );
  }

  async incluirAlunoNaTurma(alunoId: string, turmaId: string) {
    this.logger.log(`Incluindo aluno ${alunoId} na turma ${turmaId}`);
    if (!alunoId || !turmaId) throw new BadRequestException('aluno_id e turma_id são obrigatórios');

    const turma = await this.turmaRepo.findOneBy({ id: turmaId });
    if (!turma) throw new NotFoundException('Turma não encontrada');

    const aluno = await this.alunoRepo.findOneBy({ id: alunoId, ativo: true });
    if (!aluno) throw new NotFoundException('Aluno não encontrado');

    const existente = await this.turmaAlunoRepo.findOne({ where: { aluno_id: alunoId, turma_id: turmaId } });
    if (existente) {
      if (existente.status === 'ativo') throw new ConflictException('Aluno já está nesta turma');
      existente.status = 'ativo';
      await this.turmaAlunoRepo.save(existente);
    } else {
      await this.turmaAlunoRepo.save(
        this.turmaAlunoRepo.create({ aluno_id: alunoId, turma_id: turmaId, status: 'ativo' })
      );
    }

    const sessoesAnteriores = await this.dataSource.query(
      `SELECT id::text AS id, data::text AS data FROM presenca_sessoes
       WHERE turma_id = $1 AND data < NOW()
       ORDER BY data ASC`,
      [turmaId],
    );

    for (const sessao of sessoesAnteriores) {
      await this.dataSource.query(
        `INSERT INTO diario_academico (aluno_id, turma_id, data, tipo, descricao, isento, sessao_id, created_at, updated_at)
         VALUES ($1, $2, $3, 'Presença', 'Isento', true, $4, NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [alunoId, turmaId, sessao.data, sessao.id],
      );
    }

    this.logger.log(`Aluno ${aluno.nome_completo} incluído na turma ${turma.nome} com ${sessoesAnteriores.length} isenções retroativas`);

    return {
      ok: true,
      aluno: { id: aluno.id, nome_completo: aluno.nome_completo },
      turma: { id: turma.id, nome: turma.nome },
      isencoes_retroativas: sessoesAnteriores.length,
    };
  }

  async removerAlunoDaTurma(id: string) {
    this.logger.warn(`Removendo aluno da turma, turma_aluno id=${id}`);
    await this.turmaAlunoRepo.update(id, { turma_id: null, status: 'backlog' });
  }

  async removerAlunoDaTurmaPorIds(alunoId: string, turmaId: string) {
    this.logger.warn(`Removendo aluno ${alunoId} da turma ${turmaId}`);
    const rec = await this.turmaAlunoRepo.findOne({
      where: { aluno_id: alunoId, turma_id: turmaId, status: 'ativo' },
    });
    if (!rec) throw new NotFoundException('Vínculo ativo não encontrado');
    await this.turmaAlunoRepo.update(rec.id, { turma_id: null, status: 'backlog' });
  }

  /** Para uso interno pelo MatriculasService ao criar aluno */
  adicionarAoBacklog(alunoId: string) {
    this.logger.log(`Adicionando aluno ${alunoId} ao backlog`);
    return this.turmaAlunoRepo.save(
      this.turmaAlunoRepo.create({ aluno_id: alunoId, status: 'backlog' })
    );
  }

  // ── DIÁRIO ────────────────────────────────────────────────────────────────

  listarDiario(filtros: any) {
    this.logger.log(`Listando diário filtros=${JSON.stringify(filtros)}`);
    let qb = this.diarioRepo.createQueryBuilder('d')
      .where('d.tipo != :pres', { pres: 'Presença' })
      .orderBy('d.created_at', 'DESC');
    if (filtros.tipo)     qb = qb.andWhere('d.tipo = :tipo', { tipo: filtros.tipo });
    if (filtros.aluno_id) qb = qb.andWhere('d.aluno_id = :a', { a: filtros.aluno_id });
    if (filtros.turma_id) qb = qb.andWhere('d.turma_id = :t', { t: filtros.turma_id });
    if (filtros.data_ini) qb = qb.andWhere('d.data >= :di', { di: filtros.data_ini });
    if (filtros.data_fim) qb = qb.andWhere('d.data <= :df', { df: filtros.data_fim });
    return qb.getMany();
  }

  async criarRegistroDiario(dto: Partial<DiarioAcademico>) {
    this.logger.log(`Criando registro diário: tipo=${dto.tipo} aluno=${dto.aluno_id} turma=${dto.turma_id}`);
    if (!dto.tipo) throw new BadRequestException('Tipo do registro é obrigatório');
    const registro = this.diarioRepo.create(dto);
    const salvo = await this.diarioRepo.save(registro);
    this.logger.log(`Diário criado: ${salvo.id}`);
    return salvo;
  }

  async deletarRegistroDiario(id: string) {
    this.logger.warn(`Deletando registro diário id=${id}`);
    await this.diarioRepo.delete(id);
  }

  // ── PRESENÇA ──────────────────────────────────────────────────────────────

  listarPresenca(filtros: { turma_id?: string; data?: string }) {
    this.logger.log(`Listando presença filtros=${JSON.stringify(filtros)}`);
    let qb = this.diarioRepo
      .createQueryBuilder('d')
      .where('d.tipo = :tipo', { tipo: 'Presença' })
      .orderBy('d.data', 'DESC')
      .addOrderBy('d.created_at', 'DESC');
    if (filtros.turma_id) qb = qb.andWhere('d.turma_id = :t', { t: filtros.turma_id });
    if (filtros.data)     qb = qb.andWhere('d.data = :d', { d: filtros.data });
    return qb.getMany();
  }

  async registrarPresenca(
    dto: { turma_id: string; data: string; registros: { aluno_id: string; presente: boolean }[] },
    usuarioId?: string,
    usuarioNome?: string,
  ) {
    this.logger.log(`Registrando presença turma=${dto.turma_id} data=${dto.data} registros=${dto.registros?.length}`);
    if (!dto.turma_id)        throw new BadRequestException('turma_id é obrigatório');
    if (!dto.data)            throw new BadRequestException('data é obrigatória');
    if (!dto.registros?.length) throw new BadRequestException('Registros de presença são obrigatórios');

    const turma = await this.turmaRepo.findOneBy({ id: dto.turma_id });
    if (!turma) throw new NotFoundException('Turma não encontrada');

    const entries = dto.registros.map(r =>
      this.diarioRepo.create({
        tipo:         'Presença',
        aluno_id:     r.aluno_id,
        turma_id:     dto.turma_id,
        data:         dto.data,
        descricao:    r.presente ? 'Presente' : 'Falta',
        usuario_id:   usuarioId,
        usuario_nome: usuarioNome,
      })
    );
    await this.diarioRepo.save(entries);
    this.logger.log(`Presença registrada: ${entries.length} alunos`);
    return { registrados: entries.length };
  }

  // ── SESSÕES DE PRESENÇA ───────────────────────────────────────────────────

  listarSessoes(filtros: { turma_id?: string; data_ini?: string; data_fim?: string }) {
    this.logger.log(`Listando sessões de presença filtros=${JSON.stringify(filtros)}`);
    let qb = this.sessaoRepo.createQueryBuilder('s').orderBy('s.data', 'DESC').addOrderBy('s.created_at', 'DESC');
    if (filtros.turma_id) qb = qb.andWhere('s.turma_id = :t', { t: filtros.turma_id });
    if (filtros.data_ini) qb = qb.andWhere('s.data >= :di', { di: filtros.data_ini });
    if (filtros.data_fim) qb = qb.andWhere('s.data <= :df', { df: filtros.data_fim });
    return qb.getMany();
  }

  async criarSessaoComPresenca(
    dto: {
      turma_id: string;
      data: string;
      hora_inicio?: string;
      hora_fim?: string;
      tema_aula?: string;
      conteudo_abordado?: string;
      registros: { aluno_id?: string; inscricao_id?: number; pessoa_nome?: string; presente: boolean; isento?: boolean; justificada?: boolean }[];
    },
    usuarioId?: string,
    usuarioNome?: string,
    ipAddress?: string,
  ) {
    this.logger.log(`Criando sessão de presença turma=${dto.turma_id} data=${dto.data}`);
    if (!dto.turma_id)           throw new BadRequestException('turma_id é obrigatório');
    if (!dto.data)               throw new BadRequestException('data é obrigatória');
    if (!dto.registros?.length)  throw new BadRequestException('Registros de presença são obrigatórios');

    const turma = await this.turmaRepo.findOneBy({ id: dto.turma_id });
    if (!turma) throw new NotFoundException('Turma não encontrada');

    const totalPresentes = dto.registros.filter(r => r.presente && !r.isento && !r.justificada).length;
    const totalAusentes  = dto.registros.filter(r => !r.presente && !r.isento && !r.justificada).length;

    const sessao = await this.sessaoRepo.save(this.sessaoRepo.create({
      turma_id:          dto.turma_id,
      turma_nome:        turma.nome,
      data:              dto.data,
      tema_aula:         dto.tema_aula,
      conteudo_abordado: dto.conteudo_abordado,
      usuario_id:        usuarioId,
      usuario_nome:      usuarioNome,
      total_presentes:   totalPresentes,
      total_ausentes:    totalAusentes,
      ip_address:        ipAddress,
    }));
    this.logger.log(`Sessão criada id=${sessao.id}`);

    const entries = dto.registros.map(r =>
      this.diarioRepo.create({
        tipo:         'Presença',
        aluno_id:     r.aluno_id   || undefined,
        inscricao_id: r.inscricao_id || undefined,
        pessoa_nome:  r.pessoa_nome  || undefined,
        turma_id:     dto.turma_id,
        data:         dto.data,
        descricao:    r.isento ? 'Isento' : r.justificada ? 'Falta Justificada' : (r.presente ? 'Presente' : 'Falta'),
        isento:       r.isento ?? false,
        justificada:  r.justificada ?? false,
        sessao_id:    sessao.id,
        usuario_id:   usuarioId,
        usuario_nome: usuarioNome,
      })
    );
    await this.diarioRepo.save(entries);
    this.logger.log(`Presença por sessão registrada: ${entries.length} alunos`);

    const totalIsentos      = dto.registros.filter(r => r.isento).length;
    const totalJustificados = dto.registros.filter(r => r.justificada).length;
    const partes = [
      `${totalPresentes} presente${totalPresentes !== 1 ? 's' : ''}`,
      `${totalAusentes} ausente${totalAusentes !== 1 ? 's' : ''}`,
      ...(totalJustificados ? [`${totalJustificados} justificada${totalJustificados !== 1 ? 's' : ''}`] : []),
      ...(totalIsentos      ? [`${totalIsentos} isento${totalIsentos !== 1 ? 's' : ''}`]                : []),
    ];
    await this.diarioRepo.save(this.diarioRepo.create({
      tipo:         'Lista de Chamada',
      titulo:       `${turma.nome}${dto.tema_aula ? ' — ' + dto.tema_aula : ''}`,
      descricao:    partes.join(' · '),
      turma_id:     dto.turma_id,
      data:         dto.data,
      sessao_id:    sessao.id,
      usuario_id:   usuarioId,
      usuario_nome: usuarioNome,
    }));

    return { sessao, registrados: entries.length };
  }

  async editarSessao(id: string, dto: { data?: string; tema_aula?: string; conteudo_abordado?: string }) {
    const sessao = await this.sessaoRepo.findOneBy({ id });
    if (!sessao) throw new NotFoundException('Sessão não encontrada');
    Object.assign(sessao, dto);
    return this.sessaoRepo.save(sessao);
  }

  async editarRegistroPresenca(diarioId: string, dto: { descricao: 'Presente' | 'Falta' | 'Isento' | 'Falta Justificada' }) {
    const reg = await this.diarioRepo.findOneBy({ id: diarioId });
    if (!reg || reg.tipo !== 'Presença') throw new NotFoundException('Registro não encontrado');
    reg.descricao  = dto.descricao;
    reg.isento     = dto.descricao === 'Isento';
    reg.justificada = dto.descricao === 'Falta Justificada';
    const salvo = await this.diarioRepo.save(reg);
    // Recalcula totais da sessão
    if (reg.sessao_id) {
      const todos = await this.diarioRepo.find({ where: { sessao_id: reg.sessao_id, tipo: 'Presença' } });
      const presentes = todos.filter(r => r.descricao === 'Presente').length;
      const ausentes  = todos.filter(r => r.descricao === 'Falta' && !r.isento && !r.justificada).length;
      await this.sessaoRepo.update(reg.sessao_id, { total_presentes: presentes, total_ausentes: ausentes });
      // Atualiza o resumo da entrada Lista de Chamada
      const isentos    = todos.filter(r => r.isento).length;
      const justifs    = todos.filter(r => r.justificada).length;
      const partes = [
        `${presentes} presente${presentes !== 1 ? 's' : ''}`,
        `${ausentes} ausente${ausentes !== 1 ? 's' : ''}`,
        ...(justifs ? [`${justifs} justificada${justifs !== 1 ? 's' : ''}`] : []),
        ...(isentos  ? [`${isentos} isento${isentos !== 1 ? 's' : ''}`] : []),
      ];
      await this.dataSource.query(
        `UPDATE diario_academico SET descricao = $1 WHERE sessao_id = $2 AND tipo = 'Lista de Chamada'`,
        [partes.join(' · '), reg.sessao_id],
      );
    }
    return salvo;
  }

  async estornarSessao(id: string) {
    const sessao = await this.sessaoRepo.findOneBy({ id });
    if (!sessao) throw new NotFoundException('Sessão não encontrada');
    await this.diarioRepo.delete({ sessao_id: id });
    await this.sessaoRepo.delete(id);
    return { ok: true, id };
  }

  /** Retorna usuários do sistema cujo grupo contenha "professor" (case-insensitive). */
  async listarUsuariosProfessores() {
    const rows = await this.dataSource.query(`
      SELECT u.id, u.nome, u.email, u.role, g.nome as grupo_nome
      FROM usuarios u
      LEFT JOIN grupos g ON u.grupo_id = g.id
      WHERE LOWER(g.nome) LIKE '%prof%'
         OR LOWER(u.role) = 'prof'
      ORDER BY u.nome ASC
    `);
    return rows;
  }

  async kpisTurmas() {
    // Subqueries isoladas para evitar produto cartesiano (turma_alunos × diario)
    const turmaStats = await this.dataSource.query(`
      SELECT
        t.id::text   AS turma_id,
        t.nome       AS turma_nome,
        t.cor        AS turma_cor,
        t.turno      AS turno,
        t.max_alunos AS max_alunos,
        (SELECT COUNT(DISTINCT ta.aluno_id)
           FROM turma_alunos ta
           JOIN alunos a ON a.id::text = ta.aluno_id::text AND a.ativo = true
          WHERE ta.turma_id::text = t.id::text AND ta.status = 'ativo') AS total_alunos,
        (SELECT COUNT(*)
           FROM diario_academico d
          WHERE d.turma_id::text = t.id::text
            AND d.tipo = 'Presença'
            AND d.data >= CURRENT_DATE - 28
            AND d.isento = false) AS total_registros,
        (SELECT COUNT(*)
           FROM diario_academico d
          WHERE d.turma_id::text = t.id::text
            AND d.tipo = 'Presença'
            AND d.data >= CURRENT_DATE - 28
            AND d.descricao = 'Presente') AS total_presentes
      FROM turmas t
      WHERE t.ativo IS NOT FALSE
      ORDER BY t.nome ASC
    `);

    // Últimas 5 sessões por turma
    const sessoes = await this.dataSource.query(`
      SELECT
        turma_id::text,
        data,
        total_presentes,
        (total_presentes + total_ausentes) AS total_registros
      FROM presenca_sessoes
      WHERE turma_id IS NOT NULL
        AND data >= NOW() - INTERVAL '60 days'
      ORDER BY data DESC
    `);

    const sessoesPorTurma: Record<string, any[]> = {};
    for (const s of sessoes) {
      if (!sessoesPorTurma[s.turma_id]) sessoesPorTurma[s.turma_id] = [];
      if (sessoesPorTurma[s.turma_id].length < 6) {
        sessoesPorTurma[s.turma_id].push({
          data: s.data,
          presentes: Number(s.total_presentes),
          total: Number(s.total_registros),
        });
      }
    }

    return turmaStats.map((t: any) => ({
      turma_id:      t.turma_id,
      turma_nome:    t.turma_nome,
      turma_cor:     t.turma_cor || '#6d28d9',
      turno:         t.turno,
      max_alunos:    Number(t.max_alunos) || 30,
      total_alunos:  Number(t.total_alunos),
      presenca_pct:  t.total_registros > 0
        ? Math.round(100 * t.total_presentes / t.total_registros)
        : null,
      ultimas_sessoes: (sessoesPorTurma[t.turma_id] || []).reverse(),
    }));
  }

  async monitoramento() {
    const [resumo, topFaltas, topPresencas, porBairro, turmasEvasao, faltasRecentes, diarioResumo] =
      await Promise.all([

        // ── Resumo geral ─────────────────────────────────────────────────────
        this.dataSource.query(`
          SELECT
            (SELECT COUNT(*) FROM alunos WHERE ativo = true)           AS total_alunos,
            (SELECT COUNT(*) FROM presenca_sessoes)                     AS total_sessoes,
            (SELECT COUNT(*) FROM diario_academico WHERE tipo = 'Presença') AS total_registros_presenca,
            (SELECT COUNT(*) FROM diario_academico)                     AS total_diario,
            (SELECT COUNT(*) FROM diario_academico WHERE tipo = 'Presença' AND descricao = 'Presente') AS total_presentes,
            (SELECT COUNT(*) FROM diario_academico WHERE tipo = 'Presença' AND descricao = 'Falta')    AS total_faltas,
            (SELECT COUNT(*) FROM diario_academico WHERE tipo = 'Presença' AND isento = true)          AS total_isentos,
            (SELECT COUNT(*) FROM diario_academico WHERE tipo = 'Presença' AND justificada = true)     AS total_justificadas
        `),

        // ── Top 10 alunos com mais faltas ─────────────────────────────────
        this.dataSource.query(`
          SELECT
            a.id::text AS aluno_id,
            a.nome_completo,
            a.numero_matricula,
            COUNT(*) FILTER (WHERE d.descricao = 'Falta' AND d.isento = false AND d.justificada = false) AS faltas,
            COUNT(*) FILTER (WHERE d.descricao = 'Presente') AS presencas,
            COUNT(*) FILTER (WHERE d.descricao = 'Falta' AND d.isento = false AND d.justificada = false
              AND d.data >= NOW() - INTERVAL '30 days') AS faltas_recentes,
            (
              SELECT json_agg(
                json_build_object('turma_nome', tx.nome, 'faltas', tx.faltas, 'total_aulas', tx.total_aulas)
                ORDER BY tx.faltas DESC
              )
              FROM (
                SELECT t2.nome,
                       COUNT(*) FILTER (WHERE d2.descricao = 'Falta' AND d2.isento = false AND d2.justificada = false) AS faltas,
                       COUNT(DISTINCT d2.sessao_id) FILTER (WHERE d2.isento = false) AS total_aulas
                FROM diario_academico d2
                JOIN turmas t2 ON t2.id::text = d2.turma_id::text
                WHERE d2.aluno_id::text = a.id::text AND d2.tipo = 'Presença'
                GROUP BY t2.nome
              ) tx
            ) AS turmas_detalhe
          FROM alunos a
          JOIN diario_academico d ON d.aluno_id::text = a.id::text AND d.tipo = 'Presença'
          WHERE a.ativo = true
          GROUP BY a.id, a.nome_completo, a.numero_matricula
          HAVING COUNT(*) FILTER (WHERE d.descricao = 'Falta' AND d.isento = false AND d.justificada = false) > 0
          ORDER BY faltas DESC
          LIMIT 10
        `),

        // ── Top 10 alunos com maior presença ─────────────────────────────
        this.dataSource.query(`
          SELECT
            a.id::text AS aluno_id,
            a.nome_completo,
            a.numero_matricula,
            COUNT(*) FILTER (WHERE d.descricao = 'Presente') AS presencas,
            COUNT(*) FILTER (WHERE d.descricao = 'Falta' AND d.isento = false AND d.justificada = false) AS faltas,
            ROUND(100.0 * COUNT(*) FILTER (WHERE d.descricao = 'Presente')
              / NULLIF(COUNT(*) FILTER (WHERE d.descricao IN ('Presente','Falta') AND d.isento = false AND d.justificada = false), 0), 1) AS pct_presenca
          FROM alunos a
          JOIN diario_academico d ON d.aluno_id::text = a.id::text AND d.tipo = 'Presença'
          WHERE a.ativo = true
          GROUP BY a.id, a.nome_completo, a.numero_matricula
          HAVING COUNT(*) FILTER (WHERE d.descricao = 'Presente') > 0
          ORDER BY presencas DESC, pct_presenca DESC NULLS LAST
          LIMIT 10
        `),

        // ── Alunos por bairro ─────────────────────────────────────────────
        this.dataSource.query(`
          SELECT
            COALESCE(NULLIF(TRIM(a.bairro), ''), 'Não informado') AS bairro,
            COUNT(*) AS total
          FROM alunos a
          WHERE a.ativo = true
          GROUP BY bairro
          ORDER BY total DESC
          LIMIT 20
        `),

        // ── Presença por turma — últimos 90 dias (subqueries, sem cartesian) ─
        this.dataSource.query(`
          SELECT
            t.id::text AS turma_id,
            t.nome     AS turma_nome,
            t.cor      AS turma_cor,
            (SELECT COUNT(DISTINCT ta.aluno_id)
               FROM turma_alunos ta
               JOIN alunos a ON a.id::text = ta.aluno_id::text AND a.ativo = true
              WHERE ta.turma_id::text = t.id::text AND ta.status = 'ativo') AS total_alunos,
            (SELECT COUNT(*) FROM diario_academico d
              WHERE d.turma_id::text = t.id::text AND d.tipo = 'Presença'
                AND d.data >= CURRENT_DATE - 90 AND d.descricao = 'Presente') AS presencas,
            (SELECT COUNT(*) FROM diario_academico d
              WHERE d.turma_id::text = t.id::text AND d.tipo = 'Presença'
                AND d.data >= CURRENT_DATE - 90
                AND d.descricao = 'Falta' AND d.isento = false AND d.justificada = false) AS faltas,
            (SELECT COUNT(*) FROM diario_academico d
              WHERE d.turma_id::text = t.id::text AND d.tipo = 'Presença'
                AND d.data >= CURRENT_DATE - 90 AND d.isento = false) AS total_computados,
            (SELECT COUNT(DISTINCT ps.id) FROM presenca_sessoes ps
              WHERE ps.turma_id::text = t.id::text
                AND ps.data >= CURRENT_DATE - 90) AS total_sessoes
          FROM turmas t
          WHERE t.ativo IS NOT FALSE
            AND EXISTS (SELECT 1 FROM presenca_sessoes ps
                         WHERE ps.turma_id::text = t.id::text
                           AND ps.data >= CURRENT_DATE - 90)
          ORDER BY (SELECT COUNT(*) FROM diario_academico d
                     WHERE d.turma_id::text = t.id::text AND d.tipo = 'Presença'
                       AND d.data >= CURRENT_DATE - 90
                       AND d.descricao = 'Falta' AND d.isento = false) DESC
          LIMIT 10
        `),

        // ── Alunos com faltas frequentes (últimos 60 dias) ────────────────
        this.dataSource.query(`
          SELECT
            a.id::text AS aluno_id,
            a.nome_completo,
            a.numero_matricula,
            a.celular,
            COUNT(*) FILTER (WHERE d.descricao = 'Falta' AND d.isento = false AND d.justificada = false) AS faltas_recentes,
            COUNT(DISTINCT d.sessao_id) FILTER (WHERE d.isento = false) AS total_aulas,
            MAX(d.data) AS ultima_falta,
            (
              SELECT json_agg(
                json_build_object('turma_nome', tx.nome, 'faltas', tx.faltas, 'total_aulas', tx.total_aulas)
                ORDER BY tx.faltas DESC
              )
              FROM (
                SELECT t2.nome,
                       COUNT(*) FILTER (WHERE d2.descricao = 'Falta' AND d2.isento = false AND d2.justificada = false) AS faltas,
                       COUNT(DISTINCT d2.sessao_id) FILTER (WHERE d2.isento = false) AS total_aulas
                FROM diario_academico d2
                JOIN turmas t2 ON t2.id::text = d2.turma_id::text
                WHERE d2.aluno_id::text = a.id::text
                  AND d2.tipo = 'Presença'
                  AND d2.data >= CURRENT_DATE - 60
                GROUP BY t2.nome
              ) tx
            ) AS turmas_detalhe
          FROM alunos a
          JOIN diario_academico d ON d.aluno_id::text = a.id::text
            AND d.tipo = 'Presença'
            AND d.data >= CURRENT_DATE - 60
          WHERE a.ativo = true
          GROUP BY a.id, a.nome_completo, a.numero_matricula, a.celular
          HAVING COUNT(*) FILTER (WHERE d.descricao = 'Falta' AND d.isento = false AND d.justificada = false) >= 1
          ORDER BY faltas_recentes DESC
        `),

        // ── Registros diário por tipo ─────────────────────────────────────
        this.dataSource.query(`
          SELECT tipo, COUNT(*) AS total
          FROM diario_academico
          WHERE tipo != 'Presença'
          GROUP BY tipo
          ORDER BY total DESC
        `),
      ]);

    const r = resumo[0];
    const totalPres = Number(r.total_presentes) + Number(r.total_faltas);
    return {
      resumo: {
        total_alunos:      Number(r.total_alunos),
        total_sessoes:     Number(r.total_sessoes),
        total_diario:      Number(r.total_diario),
        taxa_presenca:     totalPres > 0 ? Math.round(100 * Number(r.total_presentes) / totalPres) : null,
        total_presentes:   Number(r.total_presentes),
        total_faltas:      Number(r.total_faltas),
        total_justificadas: Number(r.total_justificadas),
        total_isentos:     Number(r.total_isentos),
      },
      top_faltas:        topFaltas.map((x: any) => ({ ...x, faltas: Number(x.faltas), presencas: Number(x.presencas), faltas_recentes: Number(x.faltas_recentes), turmas_detalhe: x.turmas_detalhe ?? [] })),
      top_presencas:     topPresencas.map((x: any) => ({ ...x, presencas: Number(x.presencas), faltas: Number(x.faltas), pct_presenca: Number(x.pct_presenca) })),
      por_bairro:        porBairro.map((x: any) => ({ bairro: x.bairro, total: Number(x.total) })),
      turmas_presenca:   turmasEvasao.map((x: any) => ({ ...x, total_alunos: Number(x.total_alunos), presencas: Number(x.presencas), faltas: Number(x.faltas), total_computados: Number(x.total_computados), total_sessoes: Number(x.total_sessoes) })),
      faltas_frequentes: faltasRecentes.map((x: any) => ({ ...x, faltas_recentes: Number(x.faltas_recentes), total_aulas: Number(x.total_aulas), turmas_detalhe: x.turmas_detalhe ?? [] })),
      diario_por_tipo:   diarioResumo.map((x: any) => ({ tipo: x.tipo, total: Number(x.total) })),
    };
  }

  async mapaAlunos() {
    // Chave de agrupamento: CEP (8 dígitos) tem prioridade; fallback = logradouro normalizado + bairro
    const rows = await this.dataSource.query(`
      WITH alunos_prep AS (
        SELECT
          a.id, a.nome_completo,
          REGEXP_REPLACE(COALESCE(a.cep, ''), '[^0-9]', '', 'g')     AS cep_limpo,
          NULLIF(TRIM(a.cep), '')                                     AS cep_orig,
          NULLIF(TRIM(a.logradouro), '')                              AS log_orig,
          NULLIF(TRIM(a.bairro), '')                                  AS bai_orig,
          NULLIF(TRIM(a.cidade), '')                                  AS cid_orig,
          LOWER(REGEXP_REPLACE(
            REGEXP_REPLACE(
              REGEXP_REPLACE(
                REGEXP_REPLACE(
                  TRANSLATE(
                    TRIM(COALESCE(a.logradouro, '')),
                    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
                    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
                  ),
                  '[[:space:]]+', ' ', 'g'
                ),
                '^av\\.? +', 'avenida ', 'i'
              ),
              '^tv\\.? +', 'travessa ', 'i'
            ),
            '^r\\.? +', 'rua ', 'i'
          )) AS log_norm,
          LOWER(REGEXP_REPLACE(
            TRANSLATE(
              TRIM(COALESCE(a.bairro, '')),
              'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
              'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
            ),
            '[[:space:]]+', ' ', 'g'
          )) AS bai_norm
        FROM alunos a
        WHERE a.ativo = true
          AND (
            REGEXP_REPLACE(COALESCE(a.cep, ''), '[^0-9]', '', 'g') ~ '^[0-9]{8}$'
            OR NULLIF(TRIM(a.logradouro), '') IS NOT NULL
            OR NULLIF(TRIM(a.bairro), '') IS NOT NULL
          )
      ),
      -- Chave: CEP de 8 dígitos quando válido; do contrário logradouro_norm|bairro_norm
      alunos_chave AS (
        SELECT *,
          CASE
            WHEN cep_limpo ~ '^[0-9]{8}$' THEN cep_limpo
            ELSE log_norm || '|' || bai_norm
          END AS chave,
          (cep_limpo ~ '^[0-9]{8}$') AS tem_cep
        FROM alunos_prep
      )
      SELECT
        MODE() WITHIN GROUP (ORDER BY ac.cep_orig)  AS cep,
        MODE() WITHIN GROUP (ORDER BY ac.log_orig)  AS logradouro,
        COALESCE(MODE() WITHIN GROUP (ORDER BY ac.bai_orig), 'Não informado') AS bairro,
        COALESCE(MODE() WITHIN GROUP (ORDER BY ac.cid_orig), 'Rio de Janeiro') AS cidade,
        BOOL_OR(ac.tem_cep)                          AS tem_cep,
        COUNT(*)                                     AS total,
        json_agg(json_build_object(
          'id',       ac.id::text,
          'nome',     ac.nome_completo,
          'foto_url', doc.url_arquivo
        ) ORDER BY ac.nome_completo) AS alunos
      FROM alunos_chave ac
      LEFT JOIN LATERAL (
        SELECT d.url_arquivo
        FROM inscricoes i
        JOIN documentos_inscricao d ON d.inscricao_id = i.id AND d.tipo = 'foto_aluno'
        WHERE i.aluno_id::text = ac.id::text
        LIMIT 1
      ) doc ON true
      GROUP BY ac.chave
      ORDER BY total DESC
      LIMIT 120
    `);
    return rows.map((r: any) => ({
      ...r,
      total:  Number(r.total),
      alunos: typeof r.alunos === 'string' ? JSON.parse(r.alunos) : (r.alunos ?? []),
    }));
  }

  async criarAlunoViaChamada(dto: any) {
    const { professor_nome, ...alunoData } = dto;
    const aluno = await this.criarAluno(alunoData);
    await this.notificacoes.criar({
      tipo: 'matricula_pendente',
      titulo: `Matrícula Pendente: ${aluno.nome_completo}`,
      mensagem: `${professor_nome || 'Professor'} cadastrou "${aluno.nome_completo}" via Portal de Chamada. Pendente de matrícula formal.`,
      referencia_id: aluno.id,
      referencia_tipo: 'aluno',
      cargo_minimo: 8,
    }).catch(() => {});
    return aluno;
  }

  async detectarDuplicados() {
    const [porCpf, porNome] = await Promise.all([
      this.dataSource.query(`
        SELECT cpf,
               json_agg(json_build_object('id', id, 'nome', nome_completo, 'matricula', numero_matricula,
                 'ativo', ativo, 'created_at', "createdAt"::text) ORDER BY "createdAt") AS alunos
        FROM alunos
        WHERE cpf IS NOT NULL AND cpf <> ''
        GROUP BY cpf HAVING COUNT(*) > 1
      `),
      this.dataSource.query(`
        SELECT LOWER(TRIM(nome_completo)) AS nome_chave,
               data_nascimento::text AS data_nascimento,
               json_agg(json_build_object('id', id, 'nome', nome_completo, 'matricula', numero_matricula,
                 'ativo', ativo, 'cpf', cpf, 'created_at', "createdAt"::text) ORDER BY "createdAt") AS alunos
        FROM alunos
        WHERE data_nascimento IS NOT NULL
        GROUP BY LOWER(TRIM(nome_completo)), data_nascimento HAVING COUNT(*) > 1
      `),
    ]);
    const parse = (r: any) => typeof r.alunos === 'string' ? JSON.parse(r.alunos) : r.alunos;
    return {
      por_cpf:  porCpf.map((r: any)  => ({ tipo: 'cpf',  chave: r.cpf, alunos: parse(r) })),
      por_nome: porNome.map((r: any) => ({ tipo: 'nome', chave: `${r.nome_chave} / ${r.data_nascimento}`, alunos: parse(r) })),
      total:    porCpf.length + porNome.length,
    };
  }

  async listarAlunosPendentes() {
    return this.dataSource.query(`
      SELECT DISTINCT a.id, a.nome_completo, a.numero_matricula,
             a.celular, a.data_nascimento, a.nome_responsavel,
             a."createdAt" AS criado_em
      FROM alunos a
      INNER JOIN turma_alunos ta ON ta.aluno_id::text = a.id::text AND ta.status = 'backlog'
      WHERE (a.ativo IS NOT FALSE)
      ORDER BY a."createdAt" DESC
      LIMIT 60
    `);
  }

  async listarAlertasCandidatos() {
    const registros = await this.dataSource.query(`
      SELECT d.inscricao_id, COALESCE(d.pessoa_nome, i.nome_completo, 'Candidato') AS candidato_nome,
             d.data, ps.turma_nome, ps.id AS sessao_id
      FROM diario_academico d
      JOIN presenca_sessoes ps ON ps.id::text = d.sessao_id
      LEFT JOIN inscricoes i   ON i.id::text = d.inscricao_id::text
      WHERE d.tipo = 'Presença' AND d.inscricao_id IS NOT NULL AND d.descricao = 'Presente'
      ORDER BY d.data DESC
      LIMIT 30
    `);
    return registros;
  }

  async listarRegistrosSessao(sessaoId: string) {
    this.logger.log(`Listando registros da sessão id=${sessaoId}`);
    const registros = await this.diarioRepo.find({
      where: { sessao_id: sessaoId, tipo: 'Presença' },
      order: { aluno_id: 'ASC' },
    });
    const alunoIds = [...new Set(registros.map(r => r.aluno_id).filter(Boolean))];
    const alunos = alunoIds.length ? await this.alunoRepo.findBy({ id: In(alunoIds as string[]) }) : [];
    const nomeMap = Object.fromEntries(alunos.map(a => [a.id, a.nome_completo]));
    return registros.map(r => ({
      ...r,
      aluno_nome: r.aluno_id ? (nomeMap[r.aluno_id] || null) : (r.pessoa_nome || null),
      is_candidato: !r.aluno_id && !!r.inscricao_id,
    }));
  }

  /**
   * Diário de Classe — matriz aluno × sessão para uma turma.
   * Cada célula recebe um código: P=presente, F=falta, J=justificada, I=isento, '-'=sem registro.
   */
  async diarioDeClasseTurma(turmaId: string, filtros: { data_ini?: string; data_fim?: string }) {
    this.logger.log(`Diário de classe turma=${turmaId}`);

    // 1. Turma + curso + professor (consulta única, tolerante a coluna inexistente)
    const turmaRows = await this.dataSource.query(
      `SELECT t.id::text AS id, t.nome, t.turno, t.ano, t.cor,
              c.nome AS curso_nome,
              COALESCE(u.nome, p.nome, f.nome, t.nome_professor) AS professor_nome
         FROM turmas t
    LEFT JOIN cursos c       ON c.id::text = t.curso_id::text
    LEFT JOIN usuarios u     ON u.id::text = t.professor_id::text
    LEFT JOIN professores p  ON p.id::text = t.professor_id::text
    LEFT JOIN funcionarios f ON f.id::text = t.professor_id::text
        WHERE t.id::text = $1
        LIMIT 1`,
      [turmaId],
    ).catch(async () => {
      // Fallback caso alguma coluna não exista no schema atual
      return this.dataSource.query(
        `SELECT t.id::text AS id, t.nome, t.turno, t.ano FROM turmas t WHERE t.id::text = $1 LIMIT 1`,
        [turmaId],
      );
    });
    const turma = turmaRows[0];
    if (!turma) throw new NotFoundException('Turma não encontrada');

    // 2. Alunos atuais da turma (status='ativo')
    const alunos = await this.dataSource.query(
      `SELECT a.id::text AS id, a.nome_completo, a.numero_matricula, a.foto_url
         FROM turma_alunos ta
         JOIN alunos a ON a.id::text = ta.aluno_id::text
        WHERE ta.turma_id::text = $1 AND ta.status = 'ativo'
        ORDER BY a.nome_completo ASC`,
      [turmaId],
    ).catch(() => this.dataSource.query(
      `SELECT a.id::text AS id, a.nome_completo, a.numero_matricula
         FROM turma_alunos ta
         JOIN alunos a ON a.id::text = ta.aluno_id::text
        WHERE ta.turma_id::text = $1 AND ta.status = 'ativo'
        ORDER BY a.nome_completo ASC`,
      [turmaId],
    ));

    // 3. Sessões da turma (com filtros de data)
    const sParams: any[] = [turmaId];
    let sWhere = `s.turma_id::text = $1`;
    if (filtros.data_ini) { sParams.push(filtros.data_ini); sWhere += ` AND s.data >= $${sParams.length}`; }
    if (filtros.data_fim) { sParams.push(filtros.data_fim); sWhere += ` AND s.data <= $${sParams.length}`; }
    const sessoes = await this.dataSource.query(
      `SELECT s.id::text AS id, s.data, s.tema_aula, s.conteudo_abordado, s.usuario_nome,
              s.total_presentes, s.total_ausentes
         FROM presenca_sessoes s
        WHERE ${sWhere}
        ORDER BY s.data ASC, s.created_at ASC`,
      sParams,
    );

    // 4. Registros de presença para essas sessões
    const sessaoIds = sessoes.map((s: any) => s.id);
    const presencas: Record<string, Record<string, 'P' | 'F' | 'J' | 'I'>> = {};
    if (sessaoIds.length > 0) {
      const regs = await this.dataSource.query(
        `SELECT sessao_id::text AS sessao_id, aluno_id::text AS aluno_id, descricao, isento, justificada
           FROM diario_academico
          WHERE tipo = 'Presença' AND sessao_id::text = ANY($1::text[])`,
        [sessaoIds],
      );
      for (const r of regs) {
        if (!r.aluno_id) continue;
        let codigo: 'P' | 'F' | 'J' | 'I' = 'F';
        if (r.isento)             codigo = 'I';
        else if (r.justificada)   codigo = 'J';
        else if (r.descricao === 'Presente') codigo = 'P';
        else                      codigo = 'F';
        if (!presencas[r.sessao_id]) presencas[r.sessao_id] = {};
        presencas[r.sessao_id][r.aluno_id] = codigo;
      }
    }

    // 5. Estatísticas por aluno
    const stats: Record<string, { p: number; f: number; j: number; i: number; total: number }> = {};
    for (const a of alunos) {
      stats[a.id] = { p: 0, f: 0, j: 0, i: 0, total: 0 };
    }
    for (const sid of sessaoIds) {
      const cells = presencas[sid] || {};
      for (const a of alunos) {
        const c = cells[a.id];
        if (!c) continue;
        stats[a.id].total++;
        if (c === 'P') stats[a.id].p++;
        else if (c === 'F') stats[a.id].f++;
        else if (c === 'J') stats[a.id].j++;
        else if (c === 'I') stats[a.id].i++;
      }
    }

    return {
      turma,
      alunos: alunos.map((a: any) => ({
        ...a,
        presencas: stats[a.id].p,
        faltas: stats[a.id].f,
        justificadas: stats[a.id].j,
        isentos: stats[a.id].i,
        total_aulas: stats[a.id].total,
        pct_presenca: stats[a.id].total > 0
          ? Math.round(100 * stats[a.id].p / Math.max(1, stats[a.id].total - stats[a.id].i))
          : null,
      })),
      sessoes: sessoes.map((s: any) => ({
        ...s,
        presencas: presencas[s.id] || {},
      })),
    };
  }

  // ── CHAMADA PÚBLICA (via link sem autenticação JWT) ───────────────────────

  validarTokenChamada(token?: string) {
    const tokens = new Set(
      [
        'itp-chamada-2026', // fallback sempre aceito
        process.env.CHAMADA_TOKEN,
        process.env.NEXT_PUBLIC_CHAMADA_TOKEN,
      ].filter(Boolean) as string[],
    );
    if (!token || !tokens.has(token)) {
      throw new UnauthorizedException('Token de chamada inválido.');
    }
  }

  async listarTurmasPorCPFProfessor(cpf: string) {
    const cpfLimpo = cpf.replace(/\D/g, '');
    if (cpfLimpo.length < 11) throw new BadRequestException('CPF inválido');

    // usuarios table has no CPF column — only search professores and funcionarios
    let funcRows: any[] = [];
    let profRows: any[] = [];
    try {
      [funcRows, profRows] = await Promise.all([
        this.dataSource.query(
          // Also fetch usuario_id so we can match turmas assigned to the linked user account
          `SELECT id::text, nome, COALESCE(usuario_id::text, '') AS usuario_id
           FROM funcionarios
           WHERE replace(replace(cpf,'.',''),'-','') = $1
             AND (ativo IS NOT FALSE)
           LIMIT 1`,
          [cpfLimpo],
        ),
        this.dataSource.query(
          `SELECT id::text, nome FROM professores
           WHERE replace(replace(cpf,'.',''),'-','') = $1 LIMIT 1`,
          [cpfLimpo],
        ),
      ]);
    } catch (e: any) {
      this.logger.error(`[Chamada] CPF lookup falhou: ${e?.message}`);
      throw new InternalServerErrorException(`Erro ao buscar professor: ${e?.message}`);
    }

    const professor = funcRows[0] || profRows[0];
    if (!professor) throw new NotFoundException('Professor não encontrado com este CPF');

    // Collect all IDs that turmas.professor_id might store for this person:
    // funcionarios.id, funcionarios.usuario_id (linked user account), professores.id
    const candidateIds = [...new Set([
      funcRows[0]?.id,
      funcRows[0]?.usuario_id || null,
      profRows[0]?.id,
    ].filter(Boolean))];
    this.logger.log(`[Chamada] professor=${professor.nome} candidateIds=${JSON.stringify(candidateIds)}`);

    let turmas: any[] = [];
    try {
      turmas = await this.dataSource.query(
        `SELECT t.id, t.nome,
                COALESCE(t.cor, '#6d28d9') AS cor,
                t.turno,
                c.nome AS curso_nome
         FROM turmas t
         LEFT JOIN materias c ON c.id::text = t.curso_id::text
         WHERE t.professor_id::text = ANY($1::text[])
           AND (t.ativo IS NOT FALSE)
         ORDER BY t.nome ASC`,
        [candidateIds],
      );
    } catch (e: any) {
      this.logger.error(`[Chamada] turmas query falhou: ${e?.message}`);
      throw new InternalServerErrorException(`Erro ao buscar turmas do professor: ${e?.message}`);
    }
    return { professor: { id: professor.id, nome: professor.nome }, turmas };
  }

  async acervoDocumentos() {
    const OBRIGATORIOS = ['foto_aluno', 'identidade', 'comprovante_residencia', 'certidao_nascimento', 'identidade_responsavel'];

    const rows = await this.dataSource.query(`
      SELECT
        a.id                       AS aluno_id,
        a.nome_completo,
        a.celular,
        a.telefone_alternativo,
        a.nome_responsavel,
        a.email_responsavel,
        a.cuidado_especial,
        COALESCE(a.inscricao_id::text, i.id::text) AS inscricao_id,
        COALESCE(a.lgpd_aceito, i.lgpd_aceito, FALSE) AS lgpd_aceito,
        COALESCE(i.data_assinatura_lgpd::text, NULL)   AS data_assinatura_lgpd,
        COALESCE(
          json_agg(DISTINCT d.tipo) FILTER (WHERE d.tipo IS NOT NULL),
          '[]'
        )                          AS docs_presentes,
        COALESCE(
          json_agg(DISTINCT t.nome) FILTER (WHERE t.nome IS NOT NULL),
          '[]'
        )                          AS turmas
      FROM alunos a
      LEFT JOIN inscricoes i        ON i.aluno_id::text = a.id::text
      LEFT JOIN documentos_inscricao d ON d.inscricao_id = COALESCE(a.inscricao_id, i.id)
      LEFT JOIN turma_alunos ta     ON ta.aluno_id::text = a.id::text AND ta.status = 'ativo'
      LEFT JOIN turmas t            ON t.id::text = ta.turma_id::text
      WHERE (a.ativo IS NOT FALSE)
      GROUP BY a.id, a.nome_completo, a.celular, a.telefone_alternativo,
               a.nome_responsavel, a.email_responsavel, a.cuidado_especial,
               a.inscricao_id, i.id, i.lgpd_aceito, i.data_assinatura_lgpd
      ORDER BY a.nome_completo ASC
    `);

    return rows.map((r: any) => {
      const docs: string[] = Array.isArray(r.docs_presentes) ? r.docs_presentes : JSON.parse(r.docs_presentes || '[]');
      const faltando = OBRIGATORIOS.filter(d => !docs.includes(d));
      return {
        aluno_id:             r.aluno_id,
        nome_completo:        r.nome_completo,
        inscricao_id:         r.inscricao_id,
        celular:              r.celular,
        telefone_alternativo: r.telefone_alternativo,
        nome_responsavel:     r.nome_responsavel,
        email_responsavel:    r.email_responsavel,
        cuidado_especial:     r.cuidado_especial ?? null,
        turmas:               Array.isArray(r.turmas) ? r.turmas : JSON.parse(r.turmas || '[]'),
        docs_presentes:       docs,
        docs_faltando:        faltando,
        completo:             faltando.length === 0,
        lgpd_aceito:          r.lgpd_aceito === true || r.lgpd_aceito === 'true',
        data_assinatura_lgpd: r.data_assinatura_lgpd ?? null,
      };
    });
  }

  async listarAlunosChamada(turmaId: string) {
    this.logger.log(`[Chamada] Listando alunos turma=${turmaId}`);
    const turma = await this.turmaRepo.findOneBy({ id: turmaId });
    if (!turma) throw new NotFoundException('Turma não encontrada');

    const vinculos = await this.dataSource.query(
      `SELECT ta.aluno_id, ta.inscricao_id, ta.nome_candidato, COALESCE(ta.tipo_vinculo, 'aluno') AS tipo_vinculo
       FROM turma_alunos ta WHERE ta.turma_id = $1 AND ta.status = 'ativo'`,
      [turmaId],
    );

    const alunoIds = vinculos.filter((v: any) => v.aluno_id).map((v: any) => v.aluno_id);
    const alunos = alunoIds.length ? await this.alunoRepo.findBy({ id: In(alunoIds), ativo: true }) : [];
    const alunoMap = Object.fromEntries(alunos.map(a => [a.id, a]));

    const lista = vinculos.map((v: any) => {
      if (v.tipo_vinculo === 'candidato' || (!v.aluno_id && v.inscricao_id)) {
        return {
          id: `candidato-${v.inscricao_id}`,
          inscricao_id: v.inscricao_id,
          nome_completo: v.nome_candidato || 'Candidato',
          numero_matricula: null,
          is_candidato: true,
        };
      }
      const a = alunoMap[v.aluno_id];
      return a ? {
        id: a.id,
        inscricao_id: null,
        nome_completo: a.nome_completo,
        numero_matricula: a.numero_matricula,
        celular: a.celular ?? null,
        telefone_alternativo: a.telefone_alternativo ?? null,
        nome_responsavel: a.nome_responsavel ?? null,
        email_responsavel: a.email_responsavel ?? null,
        cpf_responsavel: a.cpf_responsavel ?? null,
        data_nascimento: a.data_nascimento ?? null,
        is_candidato: false,
      } : null;
    }).filter(Boolean);

    lista.sort((a: any, b: any) => a.nome_completo.localeCompare(b.nome_completo));
    return { turma, alunos: lista };
  }

  // ── FALTAS RECENTES (dashboard social) ───────────────────────────────────

  async listarFeriados(ano?: number) {
    const year = ano ?? new Date().getFullYear();
    return this.dataSource.query(
      `SELECT id, data::text AS data, descricao, tipo
       FROM gente_feriados
       WHERE EXTRACT(YEAR FROM data) = $1
       ORDER BY data ASC`,
      [year],
    );
  }

  async listarFaltasRecentes(limite = 8) {
    return this.dataSource.query(`
      SELECT
        a.id::text AS aluno_id,
        a.nome_completo,
        a.numero_matricula,
        a.celular,
        (SELECT t.nome FROM turmas t
          JOIN turma_alunos ta ON ta.turma_id = t.id
          WHERE ta.aluno_id::text = a.id::text AND ta.status = 'ativo'
          LIMIT 1) AS turma_nome,
        COUNT(*) FILTER (WHERE d.descricao = 'Falta' AND d.isento = false AND d.justificada = false) AS total_faltas,
        COUNT(*) AS total_registros,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE d.descricao = 'Presente') / NULLIF(COUNT(*) FILTER (WHERE d.isento = false), 0)
        , 1) AS pct_presenca,
        MAX(d.data) AS ultima_falta
      FROM alunos a
      JOIN diario_academico d ON d.aluno_id::text = a.id::text
        AND d.tipo = 'Presença'
        AND d.data >= NOW() - INTERVAL '30 days'
      WHERE a.ativo = true
      GROUP BY a.id, a.nome_completo, a.numero_matricula, a.celular
      HAVING COUNT(*) FILTER (WHERE d.descricao = 'Falta' AND d.isento = false AND d.justificada = false) >= 2
      ORDER BY total_faltas DESC
      LIMIT $1
    `, [limite]);
  }

  async turmasSemSessaoRecente(diasSemSessao = 7) {
    return this.dataSource.query(`
      SELECT
        t.id::text AS turma_id,
        t.nome AS turma_nome,
        t.turno,
        MAX(ps.data) AS ultima_sessao,
        NOW()::date - MAX(ps.data) AS dias_sem_sessao
      FROM turmas t
      LEFT JOIN presenca_sessoes ps ON ps.turma_id::text = t.id::text
      WHERE t.ativo IS NOT FALSE
      GROUP BY t.id, t.nome, t.turno
      HAVING MAX(ps.data) IS NULL OR MAX(ps.data) < NOW() - INTERVAL '${diasSemSessao} days'
      ORDER BY dias_sem_sessao DESC NULLS FIRST
    `);
  }

  // ── CHAMADOS ACADÊMICOS ───────────────────────────────────────────────────

  async listarChamados(filtros: { status?: string; tipo?: string; aluno_id?: string; prioridade?: string } = {}) {
    let qb = this.chamadoRepo.createQueryBuilder('c').orderBy('c.created_at', 'DESC');
    if (filtros.status)    qb = qb.andWhere('c.status = :s',     { s: filtros.status });
    if (filtros.tipo)      qb = qb.andWhere('c.tipo = :t',       { t: filtros.tipo });
    if (filtros.aluno_id)  qb = qb.andWhere('c.aluno_id = :a',   { a: filtros.aluno_id });
    if (filtros.prioridade) qb = qb.andWhere('c.prioridade = :p', { p: filtros.prioridade });
    return qb.getMany();
  }

  async listarResponsaveis() {
    return this.dataSource.query(
      `SELECT id, nome, role FROM usuarios ORDER BY nome ASC`,
    );
  }

  async criarChamado(dto: Partial<ChamadoAcademico>, usuarioNome?: string) {
    if (!dto.titulo?.trim()) throw new BadRequestException('Título é obrigatório');
    const chamado = this.chamadoRepo.create({
      ...dto,
      aluno_id:  dto.aluno_id  || null,
      turma_id:  dto.turma_id  || null,
      abertura:  new Date(),
      criado_por_nome: usuarioNome ?? dto.criado_por_nome,
    });
    const salvo = await this.chamadoRepo.save(chamado);
    await this.notificacoes.criar({
      tipo: 'novo_chamado',
      titulo: `Novo chamado: ${salvo.titulo}`,
      mensagem: `${salvo.tipo} · ${salvo.prioridade.toUpperCase()} · ${salvo.aluno_nome ? 'Aluno: ' + salvo.aluno_nome : 'Chamado geral'} · Por: ${salvo.criado_por_nome || '–'}`,
      referencia_id:   salvo.id,
      referencia_tipo: 'chamado',
      cargo_minimo:    5,
    }).catch(() => {});
    return salvo;
  }

  async editarChamado(id: string, dto: Partial<ChamadoAcademico>) {
    const chamado = await this.chamadoRepo.findOneBy({ id });
    if (!chamado) throw new NotFoundException('Chamado não encontrado');
    const antigo_status = chamado.status;
    Object.assign(chamado, {
      ...dto,
      aluno_id: dto.aluno_id !== undefined ? (dto.aluno_id || null) : chamado.aluno_id,
      turma_id: dto.turma_id !== undefined ? (dto.turma_id || null) : chamado.turma_id,
    });
    if (dto.status === 'resolvido' && antigo_status !== 'resolvido') {
      chamado.data_resolucao = chamado.data_resolucao ?? new Date().toISOString().slice(0, 10);
      (chamado as any).fechamento = new Date();
    }
    return this.chamadoRepo.save(chamado);
  }

  async deletarChamado(id: string) {
    await this.chamadoRepo.delete(id);
    return { ok: true };
  }

  // ── RELATÓRIOS DE PRESENÇA ────────────────────────────────────────────────

  async relatorioPresenca(filtros: { turma_id?: string; data_ini?: string; data_fim?: string }) {
    const sParams: any[] = [];
    const sWhere: string[] = [];
    if (filtros.turma_id) { sWhere.push(`s.turma_id = $${sParams.length + 1}`); sParams.push(filtros.turma_id); }
    if (filtros.data_ini) { sWhere.push(`s.data >= $${sParams.length + 1}`); sParams.push(filtros.data_ini); }
    if (filtros.data_fim) { sWhere.push(`s.data <= $${sParams.length + 1}`); sParams.push(filtros.data_fim); }
    const sw = sWhere.length ? `WHERE ${sWhere.join(' AND ')}` : '';

    const dParams: any[] = ['Presença'];
    const dWhere: string[] = [`d.tipo = $1`];
    if (filtros.turma_id) { dWhere.push(`d.turma_id = $${dParams.length + 1}`); dParams.push(filtros.turma_id); }
    if (filtros.data_ini) { dWhere.push(`d.data >= $${dParams.length + 1}`); dParams.push(filtros.data_ini); }
    if (filtros.data_fim) { dWhere.push(`d.data <= $${dParams.length + 1}`); dParams.push(filtros.data_fim); }
    const dw = `WHERE ${dWhere.join(' AND ')}`;

    const [kpiR, porTurma, tendencia, topFaltas] = await Promise.all([
      this.dataSource.query(`
        SELECT COUNT(*)::int AS total_sessoes,
          COALESCE(SUM(total_presentes),0)::int AS total_presentes,
          COALESCE(SUM(total_ausentes),0)::int AS total_ausentes,
          CASE WHEN SUM(total_presentes)+SUM(total_ausentes)>0
            THEN ROUND(SUM(total_presentes)::numeric/(SUM(total_presentes)+SUM(total_ausentes))*100,1)
            ELSE 0 END AS taxa_presenca
        FROM presenca_sessoes s ${sw}`, sParams),
      this.dataSource.query(`
        SELECT turma_nome,
          SUM(total_presentes)::int AS presentes,
          SUM(total_ausentes)::int AS ausentes,
          COUNT(*)::int AS sessoes
        FROM presenca_sessoes s ${sw}
        GROUP BY turma_nome ORDER BY presentes DESC LIMIT 20`, sParams),
      this.dataSource.query(`
        SELECT data::text,
          SUM(total_presentes)::int AS presentes,
          SUM(total_ausentes)::int AS ausentes
        FROM presenca_sessoes s ${sw}
        GROUP BY data ORDER BY data ASC LIMIT 90`, sParams),
      this.dataSource.query(`
        SELECT d.aluno_nome, d.aluno_id,
          COUNT(*) FILTER (WHERE d.descricao = 'Falta' AND NOT d.isento)::int AS total_faltas,
          COUNT(*) FILTER (WHERE d.descricao = 'Presente')::int AS total_presentes,
          COUNT(*)::int AS total_registros
        FROM diario_academico d ${dw} AND d.aluno_nome IS NOT NULL
        GROUP BY d.aluno_nome, d.aluno_id
        HAVING COUNT(*) FILTER (WHERE d.descricao = 'Falta' AND NOT d.isento) > 0
        ORDER BY total_faltas DESC LIMIT 15`, dParams),
    ]);
    return {
      kpi: { ...kpiR[0], taxa_presenca: Number(kpiR[0]?.taxa_presenca ?? 0) },
      por_turma: porTurma,
      tendencia,
      top_faltas: topFaltas,
    };
  }

  async relatorioPresencaAluno(alunoId: string, filtros: { data_ini?: string; data_fim?: string }) {
    const params: any[] = [alunoId, 'Presença'];
    const where: string[] = [`d.aluno_id = $1`, `d.tipo = $2`];
    if (filtros.data_ini) { where.push(`d.data >= $${params.length + 1}`); params.push(filtros.data_ini); }
    if (filtros.data_fim) { where.push(`d.data <= $${params.length + 1}`); params.push(filtros.data_fim); }
    const wc = `WHERE ${where.join(' AND ')}`;

    const [registros, kpiR, meses] = await Promise.all([
      this.dataSource.query(`
        SELECT d.id, d.data::text, d.turma_id, d.descricao, d.isento, d.justificada,
          d.sessao_id, s.tema_aula, s.turma_nome, d.aluno_nome
        FROM diario_academico d
        LEFT JOIN presenca_sessoes s ON s.id::text = d.sessao_id
        ${wc} ORDER BY d.data DESC LIMIT 200`, params),
      this.dataSource.query(`
        SELECT COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE d.descricao = 'Presente')::int AS presentes,
          COUNT(*) FILTER (WHERE d.descricao = 'Falta' AND NOT d.isento)::int AS faltas,
          COUNT(*) FILTER (WHERE d.justificada)::int AS justificadas,
          COUNT(*) FILTER (WHERE d.isento)::int AS isentos,
          CASE WHEN COUNT(*)>0
            THEN ROUND(COUNT(*) FILTER (WHERE d.descricao='Presente')::numeric/COUNT(*)*100,1)
            ELSE 0 END AS taxa
        FROM diario_academico d ${wc}`, params),
      this.dataSource.query(`
        SELECT TO_CHAR(d.data,'YYYY-MM') AS mes,
          COUNT(*) FILTER (WHERE d.descricao='Presente')::int AS presentes,
          COUNT(*) FILTER (WHERE d.descricao='Falta' AND NOT d.isento)::int AS faltas
        FROM diario_academico d ${wc}
        GROUP BY mes ORDER BY mes DESC LIMIT 12`, params),
    ]);
    return {
      registros,
      kpi: { ...kpiR[0], taxa: Number(kpiR[0]?.taxa ?? 0) },
      tendencia_mensal: meses.reverse(),
    };
  }

  async buscarAlunosChamada(nome: string) {
    if (!nome || nome.trim().length < 2) return { alunos: [] };
    const rows = await this.dataSource.query(
      `SELECT id::text AS id, nome_completo, numero_matricula, data_nascimento::text AS data_nascimento, celular
       FROM alunos
       WHERE nome_completo ILIKE $1 AND (ativo IS NOT FALSE)
       ORDER BY nome_completo ASC
       LIMIT 20`,
      [`%${nome.trim()}%`],
    );
    return { alunos: rows };
  }



  async statsChamados() {
    const rows = await this.dataSource.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'aberto')        AS abertos,
        COUNT(*) FILTER (WHERE status = 'em_andamento')  AS em_andamento,
        COUNT(*) FILTER (WHERE status = 'resolvido')     AS resolvidos,
        COUNT(*) FILTER (WHERE prioridade = 'urgente' AND status != 'resolvido') AS urgentes
      FROM chamados_academicos
    `);
    const r = rows[0];
    return {
      abertos:      Number(r.abertos),
      em_andamento: Number(r.em_andamento),
      resolvidos:   Number(r.resolvidos),
      urgentes:     Number(r.urgentes),
    };
  }

  // ── CONTROLE FUTEBOL ──────────────────────────────────────────────────────

  async listarControleFutebol() {
    try { await this.dataSource.query(`CREATE TABLE IF NOT EXISTS controles_futebol (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), aluno_id TEXT NOT NULL, tamanho_camisa TEXT, tamanho_short TEXT, numero_chuteira TEXT, estoque_uniforme_id TEXT, estoque_chuteira_id TEXT, uniforme_recebido BOOLEAN NOT NULL DEFAULT false, chuteira_recebida BOOLEAN NOT NULL DEFAULT false, status TEXT NOT NULL DEFAULT 'Pendente', observacoes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`); } catch {}
    const rows = await this.dataSource.query(`
      SELECT
        cf.*,
        a.nome_completo                               AS aluno_nome,
        a.data_nascimento::text                       AS aluno_data_nascimento,
        a.celular                                     AS aluno_celular,
        a.nome_responsavel                            AS responsavel_nome,
        a.telefone_alternativo                        AS responsavel_telefone,
        a.lgpd_aceito                                 AS lgpd_aceito,
        -- turma ativa do aluno
        (SELECT t.nome FROM turma_alunos ta
           JOIN turmas t ON t.id::text = ta.turma_id::text
          WHERE ta.aluno_id::text = a.id::text AND ta.status = 'ativo'
          LIMIT 1)                                    AS turma_nome,
        (SELECT ta.turma_id::text FROM turma_alunos ta
          WHERE ta.aluno_id::text = a.id::text AND ta.status = 'ativo'
          LIMIT 1)                                    AS turma_id,
        -- documentos obrigatórios
        COALESCE((
          SELECT COUNT(*) FROM documentos_inscricao di
          JOIN inscricoes i2 ON i2.id = di.inscricao_id
          WHERE i2.aluno_id::text = a.id::text
            AND di.obrigatorio = true
        ), 0)                                          AS docs_total_obrig,
        COALESCE((
          SELECT COUNT(*) FROM documentos_inscricao di
          JOIN inscricoes i2 ON i2.id = di.inscricao_id
          WHERE i2.aluno_id::text = a.id::text
            AND di.obrigatorio = true
            AND di.arquivo IS NOT NULL AND di.arquivo <> ''
        ), 0)                                          AS docs_enviados,
        -- estoque
        up.nome                                       AS uniforme_nome,
        cp.nome                                       AS chuteira_nome
      FROM controles_futebol cf
      LEFT JOIN alunos a ON a.id::text = cf.aluno_id AND (a.ativo IS NOT FALSE)
      LEFT JOIN estoque_produtos up ON up.id::text = cf.estoque_uniforme_id
      LEFT JOIN estoque_produtos cp ON cp.id::text = cf.estoque_chuteira_id
      ORDER BY a.nome_completo ASC
    `);
    return rows.map((r: any) => ({
      ...r,
      docs_ok: Number(r.docs_total_obrig) > 0
        && Number(r.docs_enviados) >= Number(r.docs_total_obrig)
        && r.lgpd_aceito,
    }));
  }

  async criarControleFutebol(dto: any) {
    const id = (await this.dataSource.query(
      `INSERT INTO controles_futebol
        (id, aluno_id, tamanho_camisa, tamanho_short, numero_chuteira,
         estoque_uniforme_id, estoque_chuteira_id,
         uniforme_recebido, chuteira_recebida, status, observacoes,
         created_at, updated_at)
       VALUES (gen_random_uuid(), $1,$2,$3,$4,$5,$6,false,false,$7,$8,now(),now())
       RETURNING id`,
      [
        dto.aluno_id, dto.tamanho_camisa ?? null, dto.tamanho_short ?? null,
        dto.numero_chuteira ?? null, dto.estoque_uniforme_id ?? null,
        dto.estoque_chuteira_id ?? null, dto.status ?? 'Pendente',
        dto.observacoes ?? null,
      ],
    ))[0];
    return this.dataSource.query(`SELECT * FROM controles_futebol WHERE id = $1`, [id.id]).then(r => r[0]);
  }

  async atualizarControleFutebol(id: string, dto: any, usuarioNome?: string) {
    const [current] = await this.dataSource.query(
      `SELECT * FROM controles_futebol WHERE id = $1`, [id],
    );
    if (!current) throw new Error('Controle não encontrado');

    // Stock baixa for uniforme when first marked as received
    if (dto.uniforme_recebido && !current.uniforme_recebido && dto.estoque_uniforme_id) {
      await this.dataSource.query(
        `UPDATE estoque_produtos SET quantidade_atual = quantidade_atual - 1 WHERE id = $1`,
        [dto.estoque_uniforme_id],
      );
      await this.dataSource.query(
        `INSERT INTO estoque_movimentos (id, produto_id, tipo, quantidade, observacao, usuario_nome, "createdAt")
         VALUES (gen_random_uuid(), $1, 'baixa', 1, $2, $3, now())`,
        [dto.estoque_uniforme_id, `Uniforme entregue ao aluno (Controle Futebol)`, usuarioNome ?? 'Sistema'],
      );
    }

    // Stock baixa for chuteira when first marked as received
    if (dto.chuteira_recebida && !current.chuteira_recebida && dto.estoque_chuteira_id) {
      await this.dataSource.query(
        `UPDATE estoque_produtos SET quantidade_atual = quantidade_atual - 1 WHERE id = $1`,
        [dto.estoque_chuteira_id],
      );
      await this.dataSource.query(
        `INSERT INTO estoque_movimentos (id, produto_id, tipo, quantidade, observacao, usuario_nome, "createdAt")
         VALUES (gen_random_uuid(), $1, 'baixa', 1, $2, $3, now())`,
        [dto.estoque_chuteira_id, `Chuteira entregue ao aluno (Controle Futebol)`, usuarioNome ?? 'Sistema'],
      );
    }

    await this.dataSource.query(
      `UPDATE controles_futebol SET
        tamanho_camisa = COALESCE($1, tamanho_camisa),
        tamanho_short  = COALESCE($2, tamanho_short),
        numero_chuteira = COALESCE($3, numero_chuteira),
        estoque_uniforme_id = COALESCE($4, estoque_uniforme_id),
        estoque_chuteira_id = COALESCE($5, estoque_chuteira_id),
        uniforme_recebido = $6,
        chuteira_recebida = $7,
        status = COALESCE($8, status),
        observacoes = COALESCE($9, observacoes),
        updated_at = now()
       WHERE id = $10`,
      [
        dto.tamanho_camisa ?? null, dto.tamanho_short ?? null,
        dto.numero_chuteira ?? null, dto.estoque_uniforme_id ?? null,
        dto.estoque_chuteira_id ?? null,
        dto.uniforme_recebido ?? current.uniforme_recebido,
        dto.chuteira_recebida ?? current.chuteira_recebida,
        dto.status ?? null, dto.observacoes ?? null,
        id,
      ],
    );
    return this.dataSource.query(`SELECT * FROM controles_futebol WHERE id = $1`, [id]).then(r => r[0]);
  }

  async deletarControleFutebol(id: string) {
    await this.dataSource.query(`DELETE FROM controles_futebol WHERE id = $1`, [id]);
    return { ok: true };
  }

  async listarEstoqueProdutos() {
    return this.dataSource.query(
      `SELECT id, nome, categoria, quantidade_atual FROM estoque_produtos WHERE ativo = true ORDER BY nome ASC`,
    );
  }

  // ── CONTROLE BALLET ───────────────────────────────────────────────────────

  async listarControleBallet() {
    const rows = await this.dataSource.query(`
      SELECT
        cb.*,
        a.nome_completo                               AS aluno_nome,
        a.data_nascimento::text                       AS aluno_data_nascimento,
        a.celular                                     AS aluno_celular,
        a.nome_responsavel                            AS responsavel_nome,
        a.telefone_alternativo                        AS responsavel_telefone,
        (SELECT t.nome FROM turma_alunos ta
           JOIN turmas t ON t.id::text = ta.turma_id::text
          WHERE ta.aluno_id::text = a.id::text AND ta.status = 'ativo'
          LIMIT 1)                                    AS turma_nome,
        rp.nome                                       AS roupa_nome,
        sp.nome                                       AS sapatilha_nome
      FROM controles_ballet cb
      LEFT JOIN alunos a ON a.id::text = cb.aluno_id AND (a.ativo IS NOT FALSE)
      LEFT JOIN estoque_produtos rp ON rp.id::text = cb.estoque_roupa_id
      LEFT JOIN estoque_produtos sp ON sp.id::text = cb.estoque_sapatilha_id
      ORDER BY a.nome_completo ASC
    `);
    return rows;
  }

  async criarControleBallet(dto: any) {
    const id = (await this.dataSource.query(
      `INSERT INTO controles_ballet
        (id, aluno_id, tamanho_roupa, numero_sapatilha, tamanho_meia,
         estoque_roupa_id, estoque_sapatilha_id,
         roupa_encomendada, sapatilha_encomendada,
         roupa_entregue, sapatilha_entregue, status, observacoes,
         created_at, updated_at)
       VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,false,false,false,false,$7,$8,now(),now())
       RETURNING id`,
      [
        dto.aluno_id,
        dto.tamanho_roupa ?? null,
        dto.numero_sapatilha ?? null,
        dto.tamanho_meia ?? null,
        dto.estoque_roupa_id ?? null,
        dto.estoque_sapatilha_id ?? null,
        dto.status ?? 'Pendente',
        dto.observacoes ?? null,
      ],
    ))[0];
    return this.dataSource.query(`SELECT * FROM controles_ballet WHERE id = $1`, [id.id]).then(r => r[0]);
  }

  async atualizarControleBallet(id: string, dto: any, usuarioNome?: string) {
    const [current] = await this.dataSource.query(`SELECT * FROM controles_ballet WHERE id = $1`, [id]);
    if (!current) throw new Error('Controle ballet não encontrado');

    if (dto.roupa_entregue && !current.roupa_entregue && dto.estoque_roupa_id) {
      await this.dataSource.query(
        `UPDATE estoque_produtos SET quantidade_atual = quantidade_atual - 1 WHERE id = $1`,
        [dto.estoque_roupa_id],
      );
      await this.dataSource.query(
        `INSERT INTO estoque_movimentos (id, produto_id, tipo, quantidade, observacao, usuario_nome, "createdAt")
         VALUES (gen_random_uuid(),$1,'baixa',1,$2,$3,now())`,
        [dto.estoque_roupa_id, 'Roupa entregue ao aluno (Controle Ballet)', usuarioNome ?? 'Sistema'],
      );
    }
    if (dto.sapatilha_entregue && !current.sapatilha_entregue && dto.estoque_sapatilha_id) {
      await this.dataSource.query(
        `UPDATE estoque_produtos SET quantidade_atual = quantidade_atual - 1 WHERE id = $1`,
        [dto.estoque_sapatilha_id],
      );
      await this.dataSource.query(
        `INSERT INTO estoque_movimentos (id, produto_id, tipo, quantidade, observacao, usuario_nome, "createdAt")
         VALUES (gen_random_uuid(),$1,'baixa',1,$2,$3,now())`,
        [dto.estoque_sapatilha_id, 'Sapatilha entregue ao aluno (Controle Ballet)', usuarioNome ?? 'Sistema'],
      );
    }

    await this.dataSource.query(
      `UPDATE controles_ballet SET
        tamanho_roupa       = COALESCE($1, tamanho_roupa),
        numero_sapatilha    = COALESCE($2, numero_sapatilha),
        tamanho_meia        = COALESCE($3, tamanho_meia),
        estoque_roupa_id    = COALESCE($4, estoque_roupa_id),
        estoque_sapatilha_id= COALESCE($5, estoque_sapatilha_id),
        roupa_encomendada   = $6,
        sapatilha_encomendada = $7,
        roupa_entregue      = $8,
        sapatilha_entregue  = $9,
        status              = COALESCE($10, status),
        observacoes         = COALESCE($11, observacoes),
        updated_at          = now()
       WHERE id = $12`,
      [
        dto.tamanho_roupa ?? null,
        dto.numero_sapatilha ?? null,
        dto.tamanho_meia ?? null,
        dto.estoque_roupa_id ?? null,
        dto.estoque_sapatilha_id ?? null,
        dto.roupa_encomendada ?? current.roupa_encomendada,
        dto.sapatilha_encomendada ?? current.sapatilha_encomendada,
        dto.roupa_entregue ?? current.roupa_entregue,
        dto.sapatilha_entregue ?? current.sapatilha_entregue,
        dto.status ?? null,
        dto.observacoes ?? null,
        id,
      ],
    );
    return this.dataSource.query(`SELECT * FROM controles_ballet WHERE id = $1`, [id]).then(r => r[0]);
  }

  async deletarControleBallet(id: string) {
    await this.dataSource.query(`DELETE FROM controles_ballet WHERE id = $1`, [id]);
    return { ok: true };
  }
}
