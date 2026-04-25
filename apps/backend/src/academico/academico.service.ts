import { Injectable, NotFoundException, ConflictException, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { Curso } from './entities/curso.entity';
import { Professor } from './entities/professor.entity';
import { Turma } from './entities/turma.entity';
import { TurmaAluno } from './entities/turma-aluno.entity';
import { GradeHoraria } from './entities/grade-horaria.entity';
import { DiarioAcademico } from './entities/diario.entity';
import { PresencaSessao } from './entities/presenca-sessao.entity';
import { Aluno } from '../alunos/aluno.entity';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { InjectDataSource } from '@nestjs/typeorm';

@Injectable()
export class AcademicoService {
  private readonly logger = new Logger(AcademicoService.name);

  constructor(
    @InjectRepository(Curso)           private cursoRepo: Repository<Curso>,
    @InjectRepository(Professor)       private professorRepo: Repository<Professor>,
    @InjectRepository(Turma)           private turmaRepo: Repository<Turma>,
    @InjectRepository(GradeHoraria)    private gradeRepo: Repository<GradeHoraria>,
    @InjectRepository(DiarioAcademico) private diarioRepo: Repository<DiarioAcademico>,
    @InjectRepository(PresencaSessao)  private sessaoRepo: Repository<PresencaSessao>,
    @InjectRepository(Aluno)           private alunoRepo: Repository<Aluno>,
    @InjectRepository(TurmaAluno)      private turmaAlunoRepo: Repository<TurmaAluno>,
    private readonly notificacoes: NotificacoesService,
    @InjectDataSource()                private readonly dataSource: DataSource,
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

  listarProfessores() {
    this.logger.log('Listando professores');
    return this.professorRepo.find({ order: { nome: 'ASC' } });
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
    await this.turmaRepo.update(id, dto);
    return this.turmaRepo.findOneByOrFail({ id });
  }

  async deletarTurma(id: string) {
    this.logger.warn(`Deletando turma id=${id}`);
    const alunosNaTurma = await this.turmaAlunoRepo.count({ where: { turma_id: id, status: 'ativo' } });
    if (alunosNaTurma > 0) throw new ConflictException('Não é possível excluir uma turma com alunos ativos');
    await this.turmaRepo.delete(id);
  }

  // ── GRADE HORÁRIA ─────────────────────────────────────────────────────────

  listarGrade() {
    this.logger.log('Listando grade horária');
    return this.dataSource.query(`
      SELECT g.*,
        COALESCE(t.nome, g.nome_turma) AS nome_turma,
        COALESCE(p.nome, u.nome, g.nome_professor) AS nome_professor
      FROM grade_horaria g
      LEFT JOIN turmas t ON t.id = g.turma_id::uuid
      LEFT JOIN professores p ON p.id = t.professor_id::uuid
      LEFT JOIN usuarios u ON u.id = t.professor_id::uuid
      ORDER BY g.dia_semana ASC, g.horario_inicio ASC NULLS LAST
    `);
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

  async listarAlunos(filtros: any) {
    this.logger.log(`Listando alunos filtros=${JSON.stringify(filtros)}`);
    let qb = this.alunoRepo.createQueryBuilder('a');
    // Filtro de status: 'ativo' | 'inativo' | ausente = todos
    if (filtros.status === 'ativo')   qb = qb.where('a.ativo = true');
    else if (filtros.status === 'inativo') qb = qb.where('a.ativo = false');
    if (filtros.nome)     qb = qb.andWhere('LOWER(a.nome_completo) LIKE :nome', { nome: `%${filtros.nome.toLowerCase()}%` });
    if (filtros.cpf)      qb = qb.andWhere('a.cpf LIKE :cpf', { cpf: `%${filtros.cpf.replace(/\D/g, '')}%` });
    if (filtros.cidade)   qb = qb.andWhere('LOWER(a.cidade) LIKE :cidade', { cidade: `%${filtros.cidade.toLowerCase()}%` });
    if (filtros.turno)    qb = qb.andWhere('a.turno_escolar = :turno', { turno: filtros.turno });
    if (filtros.sexo)     qb = qb.andWhere('a.sexo = :sexo', { sexo: filtros.sexo });
    if (filtros.curso)    qb = qb.andWhere('LOWER(a.cursos_matriculados) LIKE :curso', { curso: `%${filtros.curso.toLowerCase()}%` });
    if (filtros.turma_id) {
      qb = qb
        .innerJoin('turma_alunos', 'ta', 'ta.aluno_id = a.id::text')
        .andWhere('ta.turma_id = :turmaId', { turmaId: filtros.turma_id })
        .andWhere('ta.status = :taStatus', { taStatus: 'ativo' });
    }
    const alunos = await qb.orderBy('a.ativo', 'DESC').addOrderBy('a.nome_completo', 'ASC').getMany();
    if (!alunos.length) return alunos;
    // Enriquece com turma_status (ativo | backlog | sem_turma)
    const alunoIds = alunos.map(a => `'${a.id}'`).join(',');
    const turmaRows: any[] = await this.dataSource.query(
      `SELECT ta.aluno_id, ta.status, t.nome as turma_nome
       FROM turma_alunos ta
       LEFT JOIN turmas t ON ta.turma_id IS NOT NULL AND t.id::text = ta.turma_id
       WHERE ta.aluno_id IN (${alunoIds})`
    );
    const turmaMap: Record<string, any> = {};
    turmaRows.forEach(r => { turmaMap[r.aluno_id] = r; });
    return alunos.map(a => ({ ...a, turma_status: turmaMap[a.id]?.status ?? 'sem_turma', turma_nome: turmaMap[a.id]?.turma_nome ?? null }));
  }

  async fichaAluno(id: string) {
    this.logger.log(`Carregando ficha do aluno id=${id}`);
    const aluno = await this.alunoRepo.findOneBy({ id });
    if (!aluno) throw new NotFoundException('Aluno não encontrado');

    // Busca inscricao_id via SQL direto (JoinColumn não é coluna decorada)
    const [row] = await this.dataSource.query(
      `SELECT inscricao_id FROM alunos WHERE id = $1`, [id],
    );
    const inscricao_id: number | null = row?.inscricao_id ?? null;

    const [frequencia, historico, turmaAluno] = await Promise.all([
      this.diarioRepo.find({ where: { aluno_id: id, tipo: 'Presença' }, order: { data: 'DESC' } }),
      this.diarioRepo.find({ where: { aluno_id: id }, order: { created_at: 'DESC' } }),
      this.turmaAlunoRepo.findOne({ where: { aluno_id: id, status: 'ativo' } }),
    ]);

    let turmaInfo: Turma | null = null;
    if (turmaAluno?.turma_id) {
      turmaInfo = await this.turmaRepo.findOneBy({ id: turmaAluno.turma_id });
    }

    const totalPresencas = frequencia.filter(f => f.descricao?.toLowerCase().includes('presente')).length;
    const totalFaltas    = frequencia.filter(f => f.descricao?.toLowerCase().includes('falta') || !f.descricao?.toLowerCase().includes('presente')).length;

    this.logger.log(`Ficha do aluno ${aluno.nome_completo}: ${historico.length} registros no diário, inscricao_id=${inscricao_id}`);
    return { aluno, inscricao_id, frequencia, historico, turmaInfo, totalPresencas, totalFaltas };
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

  // ── TURMA ALUNOS / BACKLOG ─────────────────────────────────────────────────

  listarBacklog() {
    this.logger.log('Listando backlog de alunos');
    return this.turmaAlunoRepo.find({ where: { status: 'backlog' }, order: { created_at: 'ASC' } });
  }

  listarAlunosDaTurma(turmaId: string) {
    this.logger.log(`Listando alunos da turma id=${turmaId}`);
    return this.turmaAlunoRepo.find({ where: { turma_id: turmaId, status: 'ativo' } });
  }

  async incluirAlunoNaTurma(alunoId: string, turmaId: string) {
    this.logger.log(`Incluindo aluno ${alunoId} na turma ${turmaId}`);
    if (!alunoId || !turmaId) throw new BadRequestException('aluno_id e turma_id são obrigatórios');

    const turma = await this.turmaRepo.findOneBy({ id: turmaId });
    if (!turma) throw new NotFoundException('Turma não encontrada');

    const registro = await this.turmaAlunoRepo.findOne({ where: { aluno_id: alunoId } });
    if (registro) {
      registro.turma_id = turmaId;
      registro.status = 'ativo';
      return this.turmaAlunoRepo.save(registro);
    }
    return this.turmaAlunoRepo.save(
      this.turmaAlunoRepo.create({ aluno_id: alunoId, turma_id: turmaId, status: 'ativo' })
    );
  }

  async removerAlunoDaTurma(id: string) {
    this.logger.warn(`Removendo aluno da turma, turma_aluno id=${id}`);
    await this.turmaAlunoRepo.update(id, { turma_id: null, status: 'backlog' });
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
    let qb = this.diarioRepo.createQueryBuilder('d').orderBy('d.created_at', 'DESC');
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
      registros: { aluno_id?: string; inscricao_id?: number; pessoa_nome?: string; presente: boolean }[];
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

    const totalPresentes = dto.registros.filter(r => r.presente).length;
    const totalAusentes  = dto.registros.length - totalPresentes;

    const sessao = await this.sessaoRepo.save(this.sessaoRepo.create({
      turma_id:          dto.turma_id,
      turma_nome:        turma.nome,
      data:              dto.data,
      hora_inicio:       dto.hora_inicio,
      hora_fim:          dto.hora_fim,
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
        descricao:    r.presente ? 'Presente' : 'Falta',
        sessao_id:    sessao.id,
        usuario_id:   usuarioId,
        usuario_nome: usuarioNome,
      })
    );
    await this.diarioRepo.save(entries);
    this.logger.log(`Presença por sessão registrada: ${entries.length} alunos`);

    return { sessao, registrados: entries.length };
  }

  async editarSessao(id: string, dto: { tema_aula?: string; hora_inicio?: string; hora_fim?: string; conteudo_abordado?: string }) {
    const sessao = await this.sessaoRepo.findOneBy({ id });
    if (!sessao) throw new NotFoundException('Sessão não encontrada');
    Object.assign(sessao, dto);
    return this.sessaoRepo.save(sessao);
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
    const alunos = alunoIds.length ? await this.alunoRepo.findBy({ id: In(alunoIds) }) : [];
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
      return a ? { id: a.id, inscricao_id: null, nome_completo: a.nome_completo, numero_matricula: a.numero_matricula, is_candidato: false } : null;
    }).filter(Boolean);

    lista.sort((a: any, b: any) => a.nome_completo.localeCompare(b.nome_completo));
    return { turma, alunos: lista };
  }
}
