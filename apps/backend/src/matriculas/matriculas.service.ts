import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Not, In } from 'typeorm';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { Inscricao, StatusMatricula } from './inscricao.entity';
import { InscricaoAnotacao } from './inscricao-anotacao.entity';
import { InscricaoMovimentacao } from './inscricao-movimentacao.entity';
import { DocumentoInscricao, TipoDocumento } from './documento-inscricao.entity';
import { Aluno } from '../alunos/aluno.entity';
import { Usuario } from '../usuarios/usuario.entity';
import { EmailService } from '../email.service';
import { TurmaAluno } from '../academico/entities/turma-aluno.entity';
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
    private readonly dataSource: DataSource,
    private readonly emailService: EmailService,
    @InjectRepository(TurmaAluno)
    private readonly turmaAlunoRepository: Repository<TurmaAluno>,
    private readonly notificacoes: NotificacoesService,
  ) {}

  /**
   * Retorna a lista canônica de cursos oferecidos pelo instituto.
   */
  async listarCursosDisponiveis(): Promise<string[]> {
    return [
      'Ballet Clássico',
      'Beleza e Massagem',
      'Capoeira',
      'Dança do Ventre',
      'Danças Contemporâneas',
      'Futebol',
      'Inglês',
      'Informática',
      'Jazz',
      'Jiu-Jitsu',
      'Música',
      'Pré-Vestibular',
      'Reforço Escolar',
      'Vôlei',
    ];
  }

  /**
   * Lista todas as inscrições com carregamento otimizado da relação aluno.
   */
  async listarTodas(): Promise<Inscricao[]> {
    try {
      return await this.inscricaoRepository.find({
        relations: { aluno: true },
        order: { createdAt: 'DESC' },
      });
    } catch (error: any) {
      this.logger.error(`❌ Erro ao listar matrículas: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Falha ao carregar matrículas. Tente novamente em instantes.');
    }
  }

  /**
   * FASE 1 -> 2: Gera token único, envia e-mail e marca como aguardando LGPD.
   */
  async marcarComoAguardandoLGPD(id: number): Promise<Inscricao> {
    const inscricao = await this.inscricaoRepository.findOneBy({ id });
    if (!inscricao) throw new NotFoundException('Inscrição não encontrada.');

    const token = randomUUID();
    const expires = new Date();
    expires.setHours(expires.getHours() + 72); // válido por 72h

    inscricao.status_matricula = StatusMatricula.AGUARDANDO_LGPD;
    inscricao.lgpd_token = token;
    inscricao.lgpd_token_expires_at = expires;
    inscricao.lgpd_aceito = false;

    const salva = (await this.inscricaoRepository.save(inscricao)) as Inscricao;

    // Envia e-mail de forma assíncrona (não bloqueia a resposta)
    this.emailService.enviarTermoLGPD(inscricao.email, inscricao.nome_completo, token)
      .catch(err => this.logger.error(`❌ Falha ao enviar e-mail LGPD: ${err.message}`));

    this.logger.log(`📧 Termo LGPD disparado para: ${inscricao.nome_completo} <${inscricao.email}>`);
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

    const cpfLimpo = cpf.replace(/\D/g, '');
    const cpfCadastro = (inscricao.cpf || '').replace(/\D/g, '');
    if (cpfLimpo !== cpfCadastro) {
      throw new BadRequestException('CPF não confere com o cadastro. Verifique e tente novamente.');
    }

    inscricao.lgpd_aceito = true;
    inscricao.data_assinatura_lgpd = new Date();
    inscricao.nome_assinatura_imagem = nomeDigitado;
    inscricao.lgpd_ip = ip;
    inscricao.lgpd_token = null;           // invalida o token após uso
    inscricao.lgpd_token_expires_at = null;
    inscricao.status_matricula = StatusMatricula.EM_VALIDACAO;

    const salva = (await this.inscricaoRepository.save(inscricao)) as Inscricao;
    this.logger.log(`✅ LGPD assinado: ${inscricao.nome_completo} | IP: ${ip}`);

    // Auto-dispara link de documentos ao entrar em EM_VALIDACAO
    this.enviarLinkDocumentos(salva.id)
      .catch(err => this.logger.error(`❌ Falha ao auto-enviar link docs (LGPD): ${err.message}`));

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

    // ── Validações com notificação amigável em caso de falha ──────────
    if (!dados.nome_completo || !cpfLimpo) {
      const motivo = !dados.nome_completo ? 'Nome completo ausente' : 'CPF ausente ou inválido';
      this.notificacoes.criar({
        tipo: 'alerta',
        titulo: '⚠️ Inscrição recusada — dados incompletos',
        mensagem: `Uma inscrição chegou com dados obrigatórios faltando (${motivo}). Origem: ${dados.origem_inscricao || 'não identificada'}. Verifique o formulário.`,
        referencia_tipo: 'inscricao',
      }).catch(() => {});
      throw new BadRequestException(`Campos obrigatórios ausentes: ${motivo}.`);
    }
    
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
  async buscarPorId(id: number): Promise<Inscricao> {
    const inscricao = await this.inscricaoRepository.findOne({
      where: { id },
      relations: { aluno: true },
    });
    if (!inscricao) throw new NotFoundException(`Inscrição ID ${id} não encontrada.`);
    return inscricao;
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
  async finalizarMatricula(inscricaoId: number, cursosSelecionados?: string[]): Promise<Aluno> {
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

      const cursosFinal = cursosSelecionados?.length
        ? cursosSelecionados.join(', ')
        : inscricao.cursos_desejados ?? '';

      // Gera número ITP-YYYY-MMDDX
      const hoje = new Date();
      const anoStr  = String(hoje.getFullYear());
      const mesStr  = String(hoje.getMonth() + 1).padStart(2, '0');
      const diaStr  = String(hoje.getDate()).padStart(2, '0');
      // Conta alunos criados hoje para calcular X
      const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0);
      const fimHoje    = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);
      const contaHoje  = await queryRunner.manager
        .createQueryBuilder(Aluno, 'a')
        .where('a.createdAt BETWEEN :ini AND :fim', { ini: inicioHoje, fim: fimHoje })
        .getCount();
      const seq = String(contaHoje + 1);
      const numeroMatricula = `ITP-${anoStr}-${mesStr}${diaStr}${seq}`;

      const novoAluno = queryRunner.manager.create(Aluno, {
        numero_matricula:    numeroMatricula,
        nome_completo:       inscricao.nome_completo,
        cpf:                 inscricao.cpf,
        email:               inscricao.email,
        celular:             inscricao.celular,
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

      inscricao.status_matricula = StatusMatricula.MATRICULADO;
      inscricao.aluno = alunoSalvo;
      await queryRunner.manager.save(Inscricao, inscricao);

      // Adiciona aluno ao backlog de turmas
      try {
        await queryRunner.manager.save(
          queryRunner.manager.create(TurmaAluno, { aluno_id: alunoSalvo.id, status: 'backlog' })
        );
      } catch (_) { /* ignora se já existir */ }

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
    // Valida token
    const inscricao = await this.buscarPorDocToken(token);

    // Valida mimetype
    if (!MIMETYPES_ACEITOS.includes(file.mimetype)) {
      // Remove arquivo já gravado pelo multer
      if (existsSync(file.path)) unlinkSync(file.path);
      throw new BadRequestException(
        `Tipo de arquivo não permitido. Use JPEG, PNG, WebP ou PDF.`,
      );
    }

    // Valida tamanho
    if (file.size > TAMANHO_MAX_BYTES) {
      if (existsSync(file.path)) unlinkSync(file.path);
      throw new BadRequestException('Arquivo excede o limite de 8 MB.');
    }

    // Remove documento anterior do mesmo tipo (exceto EXTRA)
    if (tipo !== TipoDocumento.EXTRA) {
      const anterior = await this.documentoRepository.findOne({
        where: { inscricao_id: inscricao.id, tipo },
      });
      if (anterior) {
        const oldPath = join(process.cwd(), 'public', anterior.url_arquivo);
        if (existsSync(oldPath)) unlinkSync(oldPath);
        await this.documentoRepository.remove(anterior);
      }
    }

    // Limita documentos EXTRA a 5
    if (tipo === TipoDocumento.EXTRA) {
      const qtdExtra = await this.documentoRepository.count({
        where: { inscricao_id: inscricao.id, tipo: TipoDocumento.EXTRA },
      });
      if (qtdExtra >= 5) {
        if (existsSync(file.path)) unlinkSync(file.path);
        throw new BadRequestException('Limite de 5 documentos extras atingido.');
      }
    }

    // URL relativa para acesso público via /uploads/...
    const urlArquivo = `/uploads/documentos/${inscricao.id}/${file.filename}`;

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
   * Remove um documento (por ID) — uso interno/admin.
   */
  async removerDocumento(docId: string): Promise<void> {
    const doc = await this.documentoRepository.findOneBy({ id: docId });
    if (!doc) throw new NotFoundException('Documento não encontrado.');
    const filePath = join(process.cwd(), 'public', doc.url_arquivo);
    if (existsSync(filePath)) unlinkSync(filePath);
    await this.documentoRepository.remove(doc);
  }
}