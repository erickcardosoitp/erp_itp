import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Not, In } from 'typeorm';
import { randomUUID } from 'crypto';
import { Inscricao, StatusMatricula } from './inscricao.entity';
import { InscricaoAnotacao } from './inscricao-anotacao.entity';
import { InscricaoMovimentacao } from './inscricao-movimentacao.entity';
import { DocumentoInscricao, TipoDocumento } from './documento-inscricao.entity';
import { Aluno } from '../alunos/aluno.entity';
import { Usuario } from '../usuarios/usuario.entity';
import { EmailService } from '../email.service';
import { TurmaAluno } from '../academico/entities/turma-aluno.entity';
import { Curso } from '../academico/entities/curso.entity';
import { Turma } from '../academico/entities/turma.entity';
import { AcademicoService } from '../academico/academico.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';


/** Tipos obrigatórios que devem estar presentes para considerar o envio completo. */
const TIPOS_OBRIGATORIOS = [
  TipoDocumento.FOTO_ALUNO,
  TipoDocumento.IDENTIDADE,
  TipoDocumento.COMPROVANTE_RESID,
  TipoDocumento.CERTIDAO_NASCIMENTO,
  TipoDocumento.IDENTIDADE_RESP,
];

/** Mimetypes aceitos para uploads de documentos */
const MIMETYPES_ACEITOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

/** Tamanho máximo por arquivo: 8 MB */
const TAMANHO_MAX_BYTES = 8 * 1024 * 1024;

@Injectable()
export class MatriculasService {
  private readonly logger = new Logger(MatriculasService.name);

  constructor(
    @InjectRepository(Inscricao)
    private readonly inscricaoRepository: Repository<Inscricao>,
    @InjectRepository(InscricaoAnotacao)
    private readonly anotacaoRepository: Repository<InscricaoAnotacao>,
    @InjectRepository(InscricaoMovimentacao)
    private readonly movimentacaoRepository: Repository<InscricaoMovimentacao>,
    @InjectRepository(DocumentoInscricao)
    private readonly documentoRepository: Repository<DocumentoInscricao>,
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(Curso)
    private readonly cursoRepository: Repository<Curso>,
    @InjectRepository(Turma)
    private readonly turmaRepository: Repository<Turma>,
    private readonly dataSource: DataSource,
    private readonly emailService: EmailService,
    @InjectRepository(TurmaAluno)
    private readonly turmaAlunoRepository: Repository<TurmaAluno>,
    private readonly academicoService: AcademicoService,
    private readonly notificacoes: NotificacoesService,
  ) {}

  /**
   * Retorna cursos ativos do acadêmico com suas turmas ativas.
   * Usado para popular formulário de matrícula direta.
   */
  async obterCursosAtivosComTurmas(): Promise<Array<{ 
    id: string; 
    nome: string; 
    sigla: string; 
    turmas: Array<{ id: string; nome: string; codigo: string }> 
  }>> {
    const cursos = await this.cursoRepository.find({
      where: { status: 'Ativo' },
      order: { nome: 'ASC' }
    });

    const resultado = [];
    for (const curso of cursos) {
      const turmas = await this.turmaRepository.find({
        where: { curso_id: curso.id, ativo: true },
        order: { nome: 'ASC' }
      });
      resultado.push({
        id: curso.id,
        nome: curso.nome,
        sigla: curso.sigla,
        turmas: turmas.map(t => ({ id: t.id, nome: t.nome, codigo: t.codigo }))
      });
    }
    return resultado;
  }

  async listarNomesCursosAtivos(): Promise<string[]> {
    const cursos = await this.cursoRepository.find({
      select: ['nome'],
      where: { status: 'Ativo' },
      order: { nome: 'ASC' },
    });
    return cursos.map(c => c.nome);
  }

  /**
   * Lista inscrições de forma paginada com suporte a filtros e ordenação.
   */
  async listarTodas(
    pagina = 1,
    limite = 50,
    filtros?: {
      nome?: string;
      cpf?: string;
      status?: string;
      cidade?: string;
      bairro?: string;
      sexo?: string;
      tem_alergia?: string;
      orderBy?: string;
      orderDir?: 'ASC' | 'DESC';
    },
  ): Promise<{
    items: Inscricao[];
    total: number;
    pagina: number;
    limite: number;
    totalPaginas: number;
    stats: Record<string, number>;
  }> {
    try {
      const qb = this.inscricaoRepository
        .createQueryBuilder('i')
        .leftJoinAndSelect('i.aluno', 'aluno');

      if (filtros?.nome?.trim()) {
        qb.andWhere('LOWER(i.nome_completo) LIKE :nome', {
          nome: `%${filtros.nome.trim().toLowerCase()}%`,
        });
      }
      if (filtros?.cpf?.trim()) {
        const cpfLimpo = filtros.cpf.replace(/\D/g, '');
        if (cpfLimpo) {
          qb.andWhere("REGEXP_REPLACE(i.cpf, '[^0-9]', '', 'g') LIKE :cpf", {
            cpf: `%${cpfLimpo}%`,
          });
        }
      }
      if (filtros?.status?.trim()) {
        qb.andWhere('i.status_matricula = :status', { status: filtros.status.trim() });
      }
      if (filtros?.cidade?.trim()) {
        qb.andWhere('TRIM(i.cidade) = :cidade', { cidade: filtros.cidade.trim() });
      }
      if (filtros?.bairro?.trim()) {
        qb.andWhere('TRIM(i.bairro) = :bairro', { bairro: filtros.bairro.trim() });
      }
      if (filtros?.sexo?.trim()) {
        qb.andWhere('LOWER(i.sexo) = :sexo', { sexo: filtros.sexo.trim().toLowerCase() });
      }
      if (filtros?.tem_alergia === 'sim') {
        qb.andWhere(
          "(i.possui_alergias = 'true' OR i.possui_alergias = '1' OR i.possui_alergias = 'Sim')",
        );
      } else if (filtros?.tem_alergia === 'não') {
        qb.andWhere(
          "(i.possui_alergias IS NULL OR i.possui_alergias = 'false' OR i.possui_alergias = '0' OR i.possui_alergias = 'Não' OR i.possui_alergias = '')",
        );
      }

      const ALLOWED_ORDER: Record<string, string> = {
        nome_completo: 'i.nome_completo',
        cidade: 'i.cidade',
        data_inscricao: 'i.createdAt',
        status_matricula: 'i.status_matricula',
      };
      const orderCol = ALLOWED_ORDER[filtros?.orderBy ?? ''] ?? 'i.createdAt';
      const orderDir = filtros?.orderDir ?? 'DESC';
      qb.orderBy(orderCol, orderDir);

      const [items, total] = await qb
        .skip((pagina - 1) * limite)
        .take(limite)
        .getManyAndCount();

      // KPI counts — sempre sem filtro para refletir o painel geral
      const statsRaw = await this.inscricaoRepository
        .createQueryBuilder('i')
        .select('i.status_matricula', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('i.status_matricula')
        .getRawMany<{ status: string; count: string }>();

      const stats: Record<string, number> = {};
      statsRaw.forEach(r => { stats[r.status] = parseInt(r.count, 10); });

      return {
        items,
        total,
        pagina,
        limite,
        totalPaginas: Math.ceil(total / limite) || 1,
        stats,
      };
    } catch (error: any) {
      this.logger.error(`❌ Erro ao listar matrículas: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Falha ao carregar matrículas. Tente novamente em instantes.');
    }
  }

  /**
   * Retorna cidades e bairros distintos para popular filtros no frontend.
   */
  async listarLocalidades(): Promise<{ cidades: string[]; bairrosPorCidade: Record<string, string[]> }> {
    const rows = await this.inscricaoRepository
      .createQueryBuilder('i')
      .select('TRIM(i.cidade)', 'cidade')
      .addSelect('TRIM(i.bairro)', 'bairro')
      .distinct(true)
      .where("TRIM(i.cidade) IS NOT NULL AND TRIM(i.cidade) != ''")
      .orderBy('TRIM(i.cidade)', 'ASC')
      .addOrderBy('TRIM(i.bairro)', 'ASC')
      .getRawMany<{ cidade: string; bairro: string | null }>();

    const cidadesSet = new Set<string>();
    const bairrosPorCidade: Record<string, string[]> = {};
    for (const r of rows) {
      const cidade = r.cidade?.trim();
      const bairro = r.bairro?.trim();
      if (cidade) {
        cidadesSet.add(cidade);
        if (bairro) {
          if (!bairrosPorCidade[cidade]) bairrosPorCidade[cidade] = [];
          if (!bairrosPorCidade[cidade].includes(bairro)) bairrosPorCidade[cidade].push(bairro);
        }
      }
    }
    return { cidades: [...cidadesSet], bairrosPorCidade };
  }

  /**
   * FASE 1 -> 2: Gera token único, envia e-mail e marca como aguardando LGPD.
   * Se o aluno já está MATRICULADO, apenas reenvia o e-mail sem alterar o status.
   */
  async marcarComoAguardandoLGPD(id: number): Promise<Inscricao> {
    const inscricao = await this.inscricaoRepository.findOneBy({ id });
    if (!inscricao) throw new NotFoundException('Inscrição não encontrada.');

    const token = randomUUID();
    const expires = new Date();
    expires.setHours(expires.getHours() + 72); // válido por 72h

    const jaMatriculado = inscricao.status_matricula === StatusMatricula.MATRICULADO;

    // Não reverter status nem lgpd_aceito se o aluno já foi matriculado
    if (!jaMatriculado) {
      inscricao.status_matricula = StatusMatricula.AGUARDANDO_LGPD;
      inscricao.lgpd_aceito = false;
    }

    inscricao.lgpd_token = token;
    inscricao.lgpd_token_expires_at = expires;

    const salva = (await this.inscricaoRepository.save(inscricao)) as Inscricao;

    // Envia e-mail de forma assíncrona (não bloqueia a resposta)
    this.emailService.enviarTermoLGPD(inscricao.email, inscricao.nome_completo, token)
      .catch(err => this.logger.error(`❌ Falha ao enviar e-mail LGPD: ${err.message}`));

    // Se menor de 18 anos E tem responsável, envia também ao responsável
    if (!inscricao.maior_18_anos && inscricao.nome_responsavel && inscricao.email_responsavel) {
      this.emailService.enviarTermoLGPDResponsavel(
        inscricao.email_responsavel,
        inscricao.nome_responsavel,
        inscricao.nome_completo,
        token
      ).catch(err => this.logger.error(`❌ Falha ao enviar e-mail LGPD ao responsável: ${err.message}`));

      this.logger.log(`📧 Termo LGPD disparado para: ${inscricao.nome_completo} <${inscricao.email}> e responsável ${inscricao.nome_responsavel} <${inscricao.email_responsavel}>`);
    } else {
      this.logger.log(`📧 Termo LGPD disparado para: ${inscricao.nome_completo} <${inscricao.email}>`);
    }

    return salva;
  }

  /**
   * Busca inscrição por token LGPD — valida existência e expiração.
   */
  async buscarPorTokenLGPD(token: string): Promise<Inscricao> {
    const inscricao = await this.inscricaoRepository.findOneBy({ lgpd_token: token });
    if (!inscricao) throw new NotFoundException('Link inválido. Solicite um novo link à equipe do Instituto.');
    if (inscricao.lgpd_aceito) throw new BadRequestException('Este termo já foi assinado.');
    if (inscricao.lgpd_token_expires_at && new Date() > inscricao.lgpd_token_expires_at) {
      throw new BadRequestException('Este link expirou (prazo de 72h). Solicite um novo link.');
    }
    return inscricao;
  }

  /**
   * Processa a assinatura eletrônica do termo LGPD pelo candidato.
   */
  async assinarLGPD(token: string, nomeDigitado: string, cpf: string, ip: string): Promise<Inscricao> {
    const inscricao = await this.buscarPorTokenLGPD(token);

    // Aceita CPF da aluna OU do responsável (para menores cujo responsável assina)
    const cpfLimpo = cpf.replace(/\D/g, '');
    const cpfAluna = (inscricao.cpf || '').replace(/\D/g, '');
    const cpfResponsavel = (inscricao.cpf_responsavel || '').replace(/\D/g, '');
    const cpfValido = (cpfAluna && cpfLimpo === cpfAluna) || (cpfResponsavel && cpfLimpo === cpfResponsavel);
    if (!cpfValido) {
      throw new BadRequestException('CPF não confere com o cadastro. Use o CPF da aluna ou do responsável.');
    }

    inscricao.lgpd_aceito = true;
    inscricao.data_assinatura_lgpd = new Date();
    inscricao.nome_assinatura_imagem = nomeDigitado;
    inscricao.lgpd_ip = ip;
    inscricao.lgpd_token = null;
    inscricao.lgpd_token_expires_at = null;

    // Não reverte o status se a aluna já foi matriculada
    const jaMatriculado = inscricao.status_matricula === StatusMatricula.MATRICULADO;
    if (!jaMatriculado) {
      inscricao.status_matricula = StatusMatricula.EM_VALIDACAO;
    }

    const salva = (await this.inscricaoRepository.save(inscricao)) as Inscricao;
    this.logger.log(`✅ LGPD assinado: ${inscricao.nome_completo} | IP: ${ip}`);

    // Auto-dispara link de documentos apenas se ainda não matriculada
    if (!jaMatriculado) {
      this.enviarLinkDocumentos(salva.id)
        .catch(err => this.logger.error(`❌ Falha ao auto-enviar link docs (LGPD): ${err.message}`));
    }

    return salva;
  }

  /**
   * FASE 2 -> 3: Confirma a assinatura e move para validação documental.
   */
  async confirmarAssinaturaLGPD(id: number): Promise<Inscricao> {
    const inscricao = await this.inscricaoRepository.findOneBy({ id });
    if (!inscricao) throw new NotFoundException('Inscrição não encontrada.');
    
    if (inscricao.lgpd_aceito) return inscricao;

    inscricao.status_matricula = StatusMatricula.EM_VALIDACAO;
    inscricao.lgpd_aceito = true;
    inscricao.data_assinatura_lgpd = new Date();

    this.logger.log(`✅ Assinatura LGPD confirmada: ${inscricao.nome_completo}`);
    const salva = (await this.inscricaoRepository.save(inscricao)) as Inscricao;

    // Auto-dispara link de documentos ao entrar em EM_VALIDACAO
    this.enviarLinkDocumentos(salva.id)
      .catch(err => this.logger.error(`❌ Falha ao auto-enviar link docs (confirmar LGPD): ${err.message}`));

    return salva;
  }

  /**
   * Integração com gatilhos externos (ex: Webhook Google Forms).
   */
  async confirmarAssinaturaPorCpf(cpf: string): Promise<Inscricao> {
    const cpfLimpo = cpf.replace(/\D/g, '');
    const inscricao = await this.inscricaoRepository.findOneBy({ cpf: cpfLimpo });
    if (!inscricao) throw new NotFoundException('CPF não localizado na base de inscritos.');
    
    return this.confirmarAssinaturaLGPD(inscricao.id);
  }

  /**
   * Criação de nova inscrição com sanitização de CPF.
   */
  async receberInscricao(dados: any): Promise<Inscricao> {
    const cpfLimpo = String(dados.cpf ?? '').replace(/\D/g, '');
    const ehMenor = dados.maior_18_anos === false || (dados.idade && parseInt(dados.idade) < 18);

    // ── Validações com notificação amigável em caso de falha ──────────
    if (!dados.nome_completo) {
      this.notificacoes.criar({
        tipo: 'alerta',
        titulo: '⚠️ Inscrição recusada — dados incompletos',
        mensagem: `Uma inscrição chegou sem nome completo. Origem: ${dados.origem_inscricao || 'não identificada'}. Verifique o formulário.`,
        referencia_tipo: 'inscricao',
      }).catch(() => {});
      throw new BadRequestException('Nome completo é obrigatório.');
    }

    // Verificação de duplicidade: apenas quando CPF está preenchido
    if (cpfLimpo) {
      const STATUS_INATIVOS = [StatusMatricula.DESISTENTE, StatusMatricula.CANCELADA];
      const existente = await this.inscricaoRepository.findOne({
        where: { cpf: cpfLimpo, status_matricula: Not(In(STATUS_INATIVOS)) },
      });
      if (existente) {
        this.notificacoes.criar({
          tipo: 'alerta',
          titulo: '⚠️ Inscrição duplicada',
          mensagem: `Nova tentativa de inscrição para o CPF ${cpfLimpo} (${dados.nome_completo}), mas já existe uma inscrição ativa com status "${existente.status_matricula}". Verifique se é necessário atualizar o status existente antes de aceitar uma nova inscrição.`,
          referencia_id: String(existente.id),
          referencia_tipo: 'inscricao',
        }).catch(() => {});
        throw new BadRequestException('Este CPF já possui uma inscrição ativa.');
      }
    }

    const novaInscricao = this.inscricaoRepository.create({
      ...dados,
      cpf: cpfLimpo,
      status_matricula: StatusMatricula.PENDENTE,
      // garante data_inscricao mesmo se o cliente não enviar
      data_inscricao: dados.data_inscricao ? new Date(dados.data_inscricao) : new Date(),
    });

    let salva: Inscricao;
    try {
      // Cast duplo para resolver ambiguidade do TypeORM (Promise<Inscricao | Inscricao[]>)
      salva = (await this.inscricaoRepository.save(novaInscricao)) as any as Inscricao;
    } catch (err: any) {
      this.logger.error(`Erro ao salvar inscrição de ${dados.nome_completo}: ${err.message}`);
      this.notificacoes.criar({
        tipo: 'alerta',
        titulo: '🚨 Falha ao gravar inscrição no banco',
        mensagem: `Não foi possível salvar a inscrição de ${dados.nome_completo} (CPF: ${cpfLimpo}). Erro: ${err.message}. Verifique os logs do servidor imediatamente.`,
        referencia_tipo: 'inscricao',
      }).catch(() => {});
      throw new InternalServerErrorException('Erro ao salvar inscrição. Tente novamente ou contate o suporte.');
    }

    this.logger.log(`📥 Nova inscrição recebida: ${salva.nome_completo} (ID: ${salva.id})`);

    // Notifica a equipe no sistema sobre a nova inscrição
    this.notificacoes.criar({
      tipo: 'nova_matricula',
      titulo: `Nova inscrição: ${salva.nome_completo}`,
      mensagem: `Inscrição recebida via ${salva.origem_inscricao || 'sistema'} para os cursos: ${salva.cursos_desejados || 'não informado'}. Aguardando análise.`,
      referencia_id: String(salva.id),
      referencia_tipo: 'inscricao',
    }).catch(err => this.logger.warn(`Falha ao criar notificação de inscrição: ${err.message}`));

    return salva;
  }
  
  /**
   * Atualização genérica de status com pipeline de finalização automático.
   */
  async atualizarStatus(id: number, novoStatus: StatusMatricula, motivo?: string, reqUser?: any): Promise<Inscricao | Aluno> {
    const inscricao = await this.inscricaoRepository.findOneBy({ id });
    if (!inscricao) throw new NotFoundException(`Inscrição ID ${id} não encontrada.`);

    if (novoStatus === StatusMatricula.MATRICULADO) {
      return await this.finalizarMatricula(id);
    }

    const statusAnterior = inscricao.status_matricula;
    inscricao.status_matricula = novoStatus;
    if (motivo) inscricao.motivo_status = motivo;

    const usuario = reqUser?.userId
      ? await this.usuarioRepository.findOne({ where: { id: reqUser.userId } })
      : null;

    const mov = this.movimentacaoRepository.create({
      inscricao_id: id,
      usuario_id: usuario?.id ?? undefined,
      usuario_nome: usuario?.nome ?? reqUser?.email ?? 'Sistema',
      tipo: 'Status',
      categoria: 'status_matricula',
      valor_antes: statusAnterior,
      valor_depois: novoStatus,
    });
    await this.movimentacaoRepository.save(mov);
    
    return (await this.inscricaoRepository.save(inscricao)) as Inscricao;
  }

  /**
   * Busca uma inscrição por ID.
   */
  async buscarPorId(id: number): Promise<Inscricao & { foto_url?: string }> {
    const inscricao = await this.inscricaoRepository.findOne({
      where: { id },
      relations: { aluno: true },
    });
    if (!inscricao) throw new NotFoundException(`Inscrição ID ${id} não encontrada.`);
    const fotoDoc = await this.documentoRepository.findOne({
      where: { inscricao_id: id, tipo: TipoDocumento.FOTO_ALUNO },
      order: { createdAt: 'DESC' },
    });
    return fotoDoc ? { ...inscricao, foto_url: fotoDoc.url_arquivo } : inscricao;
  }

  /**
   * Edita campos da inscrição e registra movimentação.
   */
  async editarInscricao(id: number, dados: Partial<Inscricao>, reqUser: any): Promise<Inscricao> {
    const inscricao = await this.inscricaoRepository.findOneBy({ id });
    if (!inscricao) throw new NotFoundException(`Inscrição ID ${id} não encontrada.`);

    const usuario = reqUser?.userId
      ? await this.usuarioRepository.findOne({ where: { id: reqUser.userId } })
      : null;

    // Campos que não devem gerar movimentações (metadados, relações, tokens)
    const IGNORAR = new Set([
      'id', 'createdAt', 'updatedAt', 'aluno', 'aluno_id',
      'lgpd_token', 'lgpd_token_expires_at', 'lgpd_ip',
      'data_assinatura_lgpd', 'status_matricula', 'motivo_status',
    ]);

    // Normaliza null/undefined para string vazia para comparação
    const norm = (v: any) => {
      if (v === null || v === undefined) return '';
      if (v instanceof Date) return v.toISOString();
      return String(v);
    };

    const camposAlterados = Object.keys(dados).filter(
      k => !IGNORAR.has(k) &&
           (inscricao as any)[k] !== undefined &&
           norm((inscricao as any)[k]) !== norm((dados as any)[k])
    );

    for (const campo of camposAlterados) {
      const mov = this.movimentacaoRepository.create({
        inscricao_id: id,
        usuario_id: usuario?.id ?? undefined,
        usuario_nome: usuario?.nome ?? reqUser?.email ?? 'Sistema',
        tipo: 'Edição',
        categoria: campo,
        valor_antes: String((inscricao as any)[campo] ?? ''),
        valor_depois: String((dados as any)[campo] ?? ''),
      });
      await this.movimentacaoRepository.save(mov);
    }

    Object.assign(inscricao, dados);
    return (await this.inscricaoRepository.save(inscricao)) as Inscricao;
  }

  /**
   * Lista anotações de uma inscrição.
   */
  async listarAnotacoes(id: number): Promise<InscricaoAnotacao[]> {
    return this.anotacaoRepository.find({
      where: { inscricao_id: id },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Adiciona uma anotação à inscrição.
   */
  async adicionarAnotacao(id: number, texto: string, reqUser: any): Promise<InscricaoAnotacao> {
    const inscricao = await this.inscricaoRepository.findOneBy({ id });
    if (!inscricao) throw new NotFoundException(`Inscrição ID ${id} não encontrada.`);

    const usuario = reqUser?.userId
      ? await this.usuarioRepository.findOne({ where: { id: reqUser.userId } })
      : null;

    const anotacao = this.anotacaoRepository.create({
      inscricao_id: id,
      texto_anotacao: texto,
      usuario_id: usuario?.id ?? undefined,
      usuario_nome: usuario?.nome ?? reqUser?.email ?? 'Usuário',
      usuario_foto: usuario?.fotoUrl ?? undefined,
    });

    return this.anotacaoRepository.save(anotacao);
  }

  /**
   * Lista movimentações de uma inscrição.
   */
  async listarMovimentacoes(id: number): Promise<InscricaoMovimentacao[]> {
    return this.movimentacaoRepository.find({
      where: { inscricao_id: id },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * FASE FINAL: Transação atômica para criação de Aluno e encerramento de Inscrição.
   * Gera número ITP-YYYY-MMDDX (X = sequencial de matrículas no dia).
   */
  async finalizarMatricula(inscricaoId: number, cursosSelecionados?: string[], turmaIds?: string[]): Promise<Aluno> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const inscricao = await queryRunner.manager.findOne(Inscricao, {
        where: { id: inscricaoId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!inscricao) throw new NotFoundException('Inscrição não encontrada.');
      if (inscricao.status_matricula === StatusMatricula.MATRICULADO) {
        throw new BadRequestException('Candidato já possui matrícula ativa.');
      }

      // Idempotência: se um Aluno já foi criado para esta inscrição (falha parcial anterior), retorná-lo
      const [existingRow] = await queryRunner.manager.query(
        `SELECT id FROM alunos WHERE inscricao_id = $1 LIMIT 1`, [inscricaoId]
      );
      if (existingRow) {
        inscricao.status_matricula = StatusMatricula.MATRICULADO;
        await queryRunner.manager.save(Inscricao, inscricao);
        await queryRunner.commitTransaction();
        const aluno = await queryRunner.manager.findOneBy(Aluno, { id: existingRow.id });
        return aluno!;
      }

      // CPF temporário (placeholder) não deve ser persistido
      const cpfLimpo = (cpf: string | null): string | null => {
        if (!cpf) return null;
        const s = cpf.trim();
        if (!s || s.toUpperCase().startsWith('TEMP')) return null;
        return s;
      };

      const hoje = new Date();
      const cursosFinal = cursosSelecionados?.length
        ? cursosSelecionados.join(', ')
        : inscricao.cursos_desejados ?? '';

      const numeroMatricula = await this.generateMatriculaNumber(queryRunner.manager);

      const novoAluno = queryRunner.manager.create(Aluno, {
        numero_matricula:    numeroMatricula,
        nome_completo:       inscricao.nome_completo,
        cpf:                 cpfLimpo(inscricao.cpf),
        email:               inscricao.email || null,
        celular:             inscricao.celular || null,
        data_nascimento:     inscricao.data_nascimento,
        idade:               inscricao.idade,
        sexo:                inscricao.sexo,
        escolaridade:        inscricao.escolaridade,
        turno_escolar:       inscricao.turno_escolar,
        logradouro:          inscricao.logradouro,
        numero:              inscricao.numero,
        complemento:         inscricao.complemento,
        cidade:              inscricao.cidade,
        bairro:              inscricao.bairro,
        estado_uf:           inscricao.estado_uf,
        cep:                 inscricao.cep,
        maior_18_anos:       inscricao.maior_18_anos,
        nome_responsavel:    inscricao.nome_responsavel,
        email_responsavel:   inscricao.email_responsavel,
        grau_parentesco:     inscricao.grau_parentesco,
        cpf_responsavel:     inscricao.cpf_responsavel,
        telefone_alternativo:inscricao.telefone_alternativo,
        possui_alergias:     inscricao.possui_alergias,
        cuidado_especial:    inscricao.cuidado_especial,
        detalhes_cuidado:    inscricao.detalhes_cuidado,
        uso_medicamento:     inscricao.uso_medicamento,
        cursos_matriculados: cursosFinal,
        lgpd_aceito:         inscricao.lgpd_aceito,
        autoriza_imagem:     inscricao.autoriza_imagem,
        ativo:               true,
        data_matricula:      hoje,
      });

      const alunoSalvo = await queryRunner.manager.save(novoAluno);

      // Vincula o aluno à inscrição (nos dois sentidos da relação)
      inscricao.status_matricula = StatusMatricula.MATRICULADO;
      inscricao.aluno = alunoSalvo;
      await queryRunner.manager.save(Inscricao, inscricao);

      // Define inscricao_id no aluno para que fichaAluno possa encontrar o dossier
      await queryRunner.manager.query(
        `UPDATE alunos SET inscricao_id = $1 WHERE id = $2`,
        [inscricao.id, alunoSalvo.id],
      );

      // Adiciona aluno às turmas selecionadas ou ao backlog
      if (turmaIds && turmaIds.length > 0) {
        for (const turmaId of turmaIds) {
          await queryRunner.manager.query(
            `INSERT INTO turma_alunos (id, aluno_id, turma_id, status, tipo_vinculo, created_at)
             VALUES (gen_random_uuid(), $1, $2, 'ativo', 'aluno', NOW())
             ON CONFLICT DO NOTHING`,
            [alunoSalvo.id, turmaId]
          );
        }
      } else {
        try {
          await queryRunner.manager.save(
            queryRunner.manager.create(TurmaAluno, { aluno_id: alunoSalvo.id, status: 'backlog' })
          );
        } catch (_) { /* ignora se já existir */ }
      }

      await queryRunner.commitTransaction();
      this.logger.log(`🎉 Matrícula efetivada: ${alunoSalvo.numero_matricula} – ${alunoSalvo.nome_completo}`);
      await this.notificacoes.criar({
        tipo: 'nova_matricula',
        titulo: `Nova matrícula: ${alunoSalvo.nome_completo}`,
        mensagem: `O aluno "${alunoSalvo.nome_completo}" foi matriculado com o nº ${alunoSalvo.numero_matricula} nos cursos: ${alunoSalvo.cursos_matriculados}.`,
        referencia_id: String(alunoSalvo.id),
        referencia_tipo: 'aluno',
      }).catch(() => {});
      return alunoSalvo;
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`💥 Falha na transação de matrícula: ${err.message}`);
      throw new BadRequestException(err.message || 'Erro interno ao processar matrícula.');
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Cria um aluno DIRETAMENTE, sem passar por todo o workflow de inscrição.
   * Útil quando a matrícula é feita presencialmente ou em caso de exceção.
   * Campos obrigatórios: nome_completo, cpf, email, celular, cursos_matriculados
   */
  async criarAlunoDireto(dados: Partial<any>): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const hoje = new Date();
      // Validação de campos obrigatórios
      if (!dados.nome_completo?.trim()) throw new BadRequestException('Nome completo é obrigatório.');
      
      // Verifica duplicidade de CPF apenas quando informado
      const cpfLimpo = dados.cpf?.replace(/\D/g, '') || null;
      if (cpfLimpo) {
        const existente = await queryRunner.manager.findOne(Aluno, { where: { cpf: dados.cpf } });
        if (existente) throw new BadRequestException(`CPF ${dados.cpf} já possui matrícula ativa.`);
      }

      // Processa cursos: busca os cursos selecionados se fornecidos
      let descricaoCursos = 'A Definir';
      const cursoIds = dados.curso_ids || [];
      
      if (cursoIds.length > 0) {
        const cursosSelecionados = await queryRunner.manager.find(Curso, {
          where: { id: In(cursoIds) }
        });
        if (cursosSelecionados.length > 0) {
          descricaoCursos = cursosSelecionados.map(c => c.nome).join(', ');
        }
      }

      const numeroMatricula = await this.generateMatriculaNumber(queryRunner.manager);

      const novoAluno = queryRunner.manager.create(Aluno, {
        numero_matricula: numeroMatricula,
        nome_completo: dados.nome_completo,
        cpf: dados.cpf || null,
        email: dados.email || null,
        celular: dados.celular || null,
        data_nascimento: dados.data_nascimento || null,
        idade: dados.idade || null,
        sexo: dados.sexo || null,
        escolaridade: dados.escolaridade || null,
        turno_escolar: dados.turno_escolar || null,
        logradouro: dados.logradouro || null,
        numero: dados.numero || null,
        complemento: dados.complemento || null,
        cidade: dados.cidade || 'Rio de Janeiro',
        bairro: dados.bairro || null,
        estado_uf: dados.estado_uf || 'RJ',
        cep: dados.cep || null,
        maior_18_anos: dados.maior_18_anos !== undefined ? dados.maior_18_anos : true,
        nome_responsavel: dados.nome_responsavel || null,
        email_responsavel: dados.email_responsavel || null,
        grau_parentesco: dados.grau_parentesco || null,
        cpf_responsavel: dados.cpf_responsavel || null,
        telefone_alternativo: dados.telefone_alternativo || null,
        possui_alergias: dados.possui_alergias || null,
        cuidado_especial: dados.cuidado_especial || null,
        detalhes_cuidado: dados.detalhes_cuidado || null,
        uso_medicamento: dados.uso_medicamento || null,
        cursos_matriculados: descricaoCursos,
        lgpd_aceito: dados.lgpd_aceito || false,
        autoriza_imagem: dados.autoriza_imagem || false,
        ativo: true,
        data_matricula: hoje,
      });

      const alunoSalvo = await queryRunner.manager.save(novoAluno);

      // Cria registros TurmaAluno para turmas selecionadas ou via curso
      const turmaIds: string[] = dados.turma_ids ?? [];
      const cursoIdsParaBacklog: string[] = [];

      if (turmaIds.length > 0) {
        // Modo preferencial: admin selecionou turmas específicas
        for (const turmaId of turmaIds) {
          await queryRunner.manager.query(
            `INSERT INTO turma_alunos (id, aluno_id, turma_id, status, tipo_vinculo, created_at)
             VALUES (gen_random_uuid(), $1, $2, 'ativo', 'aluno', NOW())`,
            [alunoSalvo.id, turmaId]
          );
          this.logger.log(`✅ Aluno ${alunoSalvo.numero_matricula} adicionado à turma ${turmaId}`);
        }
      } else if (cursoIds.length > 0) {
        // Fallback: encontra a primeira turma ativa de cada curso
        let backlogCriado = false;
        for (const cursoId of cursoIds) {
          const turma = await queryRunner.manager.findOne(Turma, {
            where: { curso_id: cursoId, ativo: true }
          });
          if (turma) {
            await queryRunner.manager.query(
              `INSERT INTO turma_alunos (id, aluno_id, turma_id, status, tipo_vinculo, created_at)
               VALUES (gen_random_uuid(), $1, $2, 'ativo', 'aluno', NOW())`,
              [alunoSalvo.id, turma.id]
            );
            this.logger.log(`✅ Aluno ${alunoSalvo.numero_matricula} adicionado à turma ${turma.id} (${turma.nome})`);
          } else if (!backlogCriado) {
            await queryRunner.manager.query(
              `INSERT INTO turma_alunos (id, aluno_id, status, tipo_vinculo, created_at)
               VALUES (gen_random_uuid(), $1, 'backlog', 'aluno', NOW())`,
              [alunoSalvo.id]
            );
            backlogCriado = true;
            this.logger.warn(`⚠️ Aluno ${alunoSalvo.numero_matricula} adicionado ao backlog`);
          }
        }
      } else {
        // Nenhum curso/turma selecionado: backlog
        await queryRunner.manager.query(
          `INSERT INTO turma_alunos (id, aluno_id, status, tipo_vinculo, created_at)
           VALUES (gen_random_uuid(), $1, 'backlog', 'aluno', NOW())`,
          [alunoSalvo.id]
        );
      }

      // Cria inscricao vinculada — habilita dossier completo e upload de documentos na ficha
      const inscricao = queryRunner.manager.create(Inscricao, {
        nome_completo:        alunoSalvo.nome_completo,
        cpf:                  alunoSalvo.cpf       ?? undefined,
        email:                alunoSalvo.email      ?? undefined,
        celular:              alunoSalvo.celular    ?? undefined,
        data_nascimento:      alunoSalvo.data_nascimento ?? undefined,
        sexo:                 alunoSalvo.sexo       ?? undefined,
        escolaridade:         alunoSalvo.escolaridade ?? undefined,
        turno_escolar:        alunoSalvo.turno_escolar ?? undefined,
        logradouro:           alunoSalvo.logradouro ?? undefined,
        numero:               alunoSalvo.numero     ?? undefined,
        complemento:          alunoSalvo.complemento ?? undefined,
        cidade:               alunoSalvo.cidade     ?? undefined,
        bairro:               alunoSalvo.bairro     ?? undefined,
        estado_uf:            alunoSalvo.estado_uf  ?? undefined,
        cep:                  alunoSalvo.cep        ?? undefined,
        maior_18_anos:        alunoSalvo.maior_18_anos ?? true,
        nome_responsavel:     alunoSalvo.nome_responsavel   ?? undefined,
        email_responsavel:    alunoSalvo.email_responsavel  ?? undefined,
        grau_parentesco:      alunoSalvo.grau_parentesco    ?? undefined,
        cpf_responsavel:      alunoSalvo.cpf_responsavel    ?? undefined,
        telefone_alternativo: alunoSalvo.telefone_alternativo ?? undefined,
        possui_alergias:      alunoSalvo.possui_alergias   ?? undefined,
        cuidado_especial:     alunoSalvo.cuidado_especial  ?? undefined,
        detalhes_cuidado:     alunoSalvo.detalhes_cuidado  ?? undefined,
        uso_medicamento:      alunoSalvo.uso_medicamento   ?? undefined,
        cursos_desejados:     descricaoCursos,
        lgpd_aceito:          alunoSalvo.lgpd_aceito,
        autoriza_imagem:      alunoSalvo.autoriza_imagem,
        status_matricula:     StatusMatricula.MATRICULADO,
        origem_inscricao:     'Direto',
        data_inscricao:       hoje,
        aluno:                { id: alunoSalvo.id } as any,
      });
      const inscricaoSalva = await queryRunner.manager.save(Inscricao, inscricao);
      // Vincula inscricao_id de volta ao aluno (permite lookup direto na ficha)
      await queryRunner.manager.query(
        `UPDATE alunos SET inscricao_id = $1 WHERE id = $2`,
        [inscricaoSalva.id, alunoSalvo.id],
      );
      this.logger.log(`✅ [criarAlunoDireto] Inscricao ${inscricaoSalva.id} criada e vinculada ao aluno ${alunoSalvo.id}`);

      this.logger.log(`⏳ [criarAlunoDireto] Iniciando commitTransaction para aluno=${alunoSalvo.id}`);
      await queryRunner.commitTransaction();
      this.logger.log(`✅ [criarAlunoDireto] commitTransaction concluído para aluno=${alunoSalvo.id}`);
      this.logger.log(`🎉 Aluno criado diretamente: ${alunoSalvo.numero_matricula} – ${alunoSalvo.nome_completo} | Cursos: ${descricaoCursos}`);
      await this.notificacoes.criar({
        tipo: 'nova_matricula',
        titulo: `Nova matrícula (Direct): ${alunoSalvo.nome_completo}`,
        mensagem: `O aluno "${alunoSalvo.nome_completo}" foi matriculado diretamente com o nº ${alunoSalvo.numero_matricula} nos cursos: ${descricaoCursos}.`,
        referencia_id: String(alunoSalvo.id),
        referencia_tipo: 'aluno',
      }).catch(() => {});
      return alunoSalvo;
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`💥 Falha ao criar aluno direto: ${err.message}\nStack: ${err.stack}`);
      throw new BadRequestException(err.message || 'Erro interno ao criar aluno.');
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Helper para gerar o número de matrícula ITP-YYYY-MMDDX.
   */
  private async generateMatriculaNumber(manager: any): Promise<string> {
    const hoje = new Date();
    const anoStr = String(hoje.getFullYear());
    const mesStr = String(hoje.getMonth() + 1).padStart(2, '0');
    const diaStr = String(hoje.getDate()).padStart(2, '0');
    const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0);
    const fimHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);
    const contaHoje = await manager
      .createQueryBuilder(Aluno, 'a')
      .where('a.createdAt BETWEEN :ini AND :fim', { ini: inicioHoje, fim: fimHoje })
      .getCount();
    const seq = String(contaHoje + 1);
    return `ITP-${anoStr}-${mesStr}${diaStr}${seq}`;
  }
  // ── Documentos ───────────────────────────────────────────────────────────────

  /**
   * Gera um doc_token e envia link por e-mail para o candidato enviar documentos.
   */
  async enviarLinkDocumentos(id: number): Promise<Inscricao> {
    const inscricao = await this.inscricaoRepository.findOneBy({ id });
    if (!inscricao) throw new NotFoundException('Inscrição não encontrada.');

    const token = randomUUID();
    const expires = new Date();
    expires.setDate(expires.getDate() + 7); // 7 dias

    inscricao.doc_token = token;
    inscricao.doc_token_expires_at = expires;
    inscricao.status_matricula = StatusMatricula.AGUARDANDO_DOCUMENTOS;

    const salva = (await this.inscricaoRepository.save(inscricao)) as Inscricao;

    // Envia e-mail com o link de documentos
    this.emailService
      .enviarLinkDocumentos(inscricao.email, inscricao.nome_completo, token)
      .catch((err: Error) => this.logger.error(`❌ Falha ao enviar e-mail documentos: ${err.message}`));

    this.logger.log(`📎 Link de documentos gerado para: ${inscricao.nome_completo}`);
    return salva;
  }

  /**
   * Busca inscrição por doc_token — valida existência e expiração.
   */
  async buscarPorDocToken(token: string): Promise<Inscricao> {
    const inscricao = await this.inscricaoRepository.findOneBy({ doc_token: token });
    if (!inscricao) throw new NotFoundException('Link inválido ou expirado.');
    if (
      inscricao.doc_token_expires_at &&
      new Date() > inscricao.doc_token_expires_at
    ) {
      throw new BadRequestException('Este link expirou (prazo de 7 dias). Solicite um novo link.');
    }
    return inscricao;
  }

  /**
   * Lista documentos de uma inscrição via doc_token, com status de completude.
   */
  async listarDocumentosPublico(token: string): Promise<{
    inscricao: { id: number; nome_completo: string; status_matricula: string };
    documentos: DocumentoInscricao[];
    tipos_enviados: string[];
    obrigatorios_pendentes: string[];
    completo: boolean;
  }> {
    const inscricao = await this.buscarPorDocToken(token);

    const documentos = await this.documentoRepository.find({
      where: { inscricao_id: inscricao.id },
      order: { createdAt: 'ASC' },
    });

    const tiposEnviados = documentos.map(d => d.tipo);
    const obrigatoriosPendentes = TIPOS_OBRIGATORIOS.filter(t => !tiposEnviados.includes(t));

    return {
      inscricao: {
        id: inscricao.id,
        nome_completo: inscricao.nome_completo,
        status_matricula: inscricao.status_matricula,
      },
      documentos,
      tipos_enviados: tiposEnviados,
      obrigatorios_pendentes: obrigatoriosPendentes,
      completo: obrigatoriosPendentes.length === 0,
    };
  }

  /**
   * Salva um documento enviado pelo candidato via link público.
   */
  async uploadDocumento(
    token: string,
    tipo: TipoDocumento,
    file: Express.Multer.File,
    nomeExtra?: string,
  ): Promise<DocumentoInscricao> {
    const inscricao = await this.buscarPorDocToken(token);

    if (!MIMETYPES_ACEITOS.includes(file.mimetype)) {
      throw new BadRequestException(`Tipo de arquivo não permitido. Use JPEG, PNG, WebP ou PDF.`);
    }

    if (file.size > TAMANHO_MAX_BYTES) {
      throw new BadRequestException('Arquivo excede o limite de 8 MB.');
    }

    // Remove documento anterior do mesmo tipo (exceto EXTRA) — apenas do banco
    if (tipo !== TipoDocumento.EXTRA) {
      const anterior = await this.documentoRepository.findOne({
        where: { inscricao_id: inscricao.id, tipo },
      });
      if (anterior) {
        await this.documentoRepository.remove(anterior);
      }
    }

    // Limita documentos EXTRA a 5
    if (tipo === TipoDocumento.EXTRA) {
      const qtdExtra = await this.documentoRepository.count({
        where: { inscricao_id: inscricao.id, tipo: TipoDocumento.EXTRA },
      });
      if (qtdExtra >= 5) {
        throw new BadRequestException('Limite de 5 documentos extras atingido.');
      }
    }

    // Armazena como data URL base64 (compatível com ambiente serverless)
    const urlArquivo = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

    const doc = this.documentoRepository.create({
      inscricao_id: inscricao.id,
      tipo,
      nome_extra: tipo === TipoDocumento.EXTRA ? (nomeExtra ?? 'Documento extra') : null,
      url_arquivo: urlArquivo,
      mimetype: file.mimetype,
      tamanho_bytes: file.size,
    });

    const salvo = await this.documentoRepository.save(doc);

    // Atualiza status se todos obrigatórios enviados
    const tiposEnviados = (
      await this.documentoRepository.find({
        where: { inscricao_id: inscricao.id },
        select: ['tipo'],
      })
    ).map(d => d.tipo);

    const todosObrigatorios = TIPOS_OBRIGATORIOS.every(t => tiposEnviados.includes(t));
    if (todosObrigatorios && inscricao.status_matricula === StatusMatricula.AGUARDANDO_DOCUMENTOS) {
      inscricao.status_matricula = StatusMatricula.DOCUMENTOS_ENVIADOS;
      await this.inscricaoRepository.save(inscricao);
    }

    return salvo;
  }

  /**
   * Lista documentos de uma inscrição diretamente pelo ID (uso admin).
   */
  async listarDocumentosPorId(inscricaoId: number) {
    const documentos = await this.documentoRepository.find({
      where: { inscricao_id: inscricaoId },
      order: { createdAt: 'ASC' },
    });
    const tiposEnviados = documentos.map(d => d.tipo);
    const obrigatoriosPendentes = TIPOS_OBRIGATORIOS.filter(t => !tiposEnviados.includes(t));
    return {
      documentos,
      tipos_enviados: tiposEnviados,
      obrigatorios_pendentes: obrigatoriosPendentes,
      completo: obrigatoriosPendentes.length === 0,
    };
  }

  /**
   * Upload de documento por admin, usando inscricao_id diretamente.
   */
  async uploadDocumentoAdmin(
    inscricaoId: number,
    tipo: TipoDocumento,
    file: Express.Multer.File,
    nomeExtra?: string,
  ): Promise<DocumentoInscricao> {
    const inscricao = await this.inscricaoRepository.findOneBy({ id: inscricaoId });
    if (!inscricao) throw new NotFoundException('Inscrição não encontrada.');

    if (!MIMETYPES_ACEITOS.includes(file.mimetype)) {
      throw new BadRequestException('Tipo de arquivo não permitido. Use JPEG, PNG, WebP ou PDF.');
    }
    if (file.size > TAMANHO_MAX_BYTES) {
      throw new BadRequestException('Arquivo excede o limite de 8 MB.');
    }

    if (tipo !== TipoDocumento.EXTRA) {
      const anterior = await this.documentoRepository.findOne({
        where: { inscricao_id: inscricaoId, tipo },
      });
      if (anterior) await this.documentoRepository.remove(anterior);
    }

    if (tipo === TipoDocumento.EXTRA) {
      const qtdExtra = await this.documentoRepository.count({
        where: { inscricao_id: inscricaoId, tipo: TipoDocumento.EXTRA },
      });
      if (qtdExtra >= 5) throw new BadRequestException('Limite de 5 documentos extras atingido.');
    }

    const urlArquivo = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

    const doc = this.documentoRepository.create({
      inscricao_id: inscricaoId,
      tipo,
      nome_extra: tipo === TipoDocumento.EXTRA ? (nomeExtra ?? 'Documento extra') : null,
      url_arquivo: urlArquivo,
      mimetype: file.mimetype,
      tamanho_bytes: file.size,
    });

    return await this.documentoRepository.save(doc);
  }

  /**
   * Remove um documento (por ID) — uso interno/admin.
   */
  async removerDocumento(docId: string): Promise<void> {
    const doc = await this.documentoRepository.findOneBy({ id: docId });
    if (!doc) throw new NotFoundException('Documento não encontrado.');
    await this.documentoRepository.remove(doc);
  }
}