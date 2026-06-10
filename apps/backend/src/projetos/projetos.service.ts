import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Projeto } from './entities/projeto.entity';
import { ProjetoEquipe } from './entities/projeto-equipe.entity';
import { ProjetoInscricao } from './entities/projeto-inscricao.entity';
import { ProjetoPresenca } from './entities/projeto-presenca.entity';
import { ProjetoInscricaoDocumento, TIPOS_OBRIGATORIOS_PROJETO, TIPOS_DOCUMENTO_PROJETO } from './entities/projeto-inscricao-documento.entity';
import { CreateProjetoDto } from './dto/create-projeto.dto';
import { CreateEquipeDto } from './dto/create-equipe.dto';
import { CreateInscricaoDto } from './dto/create-inscricao.dto';
import { SupabaseService } from '../modules/supabase/supabase.service';
import { EmailService } from '../email.service';

const TIPOS_OBRIGATORIOS = [...TIPOS_OBRIGATORIOS_PROJETO];

@Injectable()
export class ProjetosService {
  private readonly logger = new Logger(ProjetosService.name);

  constructor(
    @InjectRepository(Projeto)                    private projetosRepo: Repository<Projeto>,
    @InjectRepository(ProjetoEquipe)              private equipesRepo: Repository<ProjetoEquipe>,
    @InjectRepository(ProjetoInscricao)           private inscricoesRepo: Repository<ProjetoInscricao>,
    @InjectRepository(ProjetoPresenca)            private presencasRepo: Repository<ProjetoPresenca>,
    @InjectRepository(ProjetoInscricaoDocumento)  private documentosRepo: Repository<ProjetoInscricaoDocumento>,
    private dataSource: DataSource,
    private supabase: SupabaseService,
    private emailService: EmailService,
  ) {}

  // ── Projetos ──────────────────────────────────────────────────────────────

  findAll() {
    return this.projetosRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    const p = await this.projetosRepo.findOne({ where: { id }, relations: ['equipes'] });
    if (!p) throw new NotFoundException('Projeto não encontrado');
    return p;
  }

  async create(dto: CreateProjetoDto) {
    const p = this.projetosRepo.create(dto);
    return this.projetosRepo.save(p);
  }

  async update(id: string, dto: Partial<CreateProjetoDto> & { ativo?: boolean }) {
    await this.findOne(id);
    await this.projetosRepo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.projetosRepo.delete(id);
  }

  // ── Equipes ───────────────────────────────────────────────────────────────

  findEquipes(projeto_id: string) {
    return this.equipesRepo.find({ where: { projeto_id }, order: { nome: 'ASC' } });
  }

  async createEquipe(projeto_id: string, dto: CreateEquipeDto) {
    await this.findOne(projeto_id);
    const e = this.equipesRepo.create({ ...dto, projeto_id });
    return this.equipesRepo.save(e);
  }

  async updateEquipe(projeto_id: string, id: string, dto: Partial<CreateEquipeDto>) {
    const e = await this.equipesRepo.findOne({ where: { id, projeto_id } });
    if (!e) throw new NotFoundException('Equipe não encontrada');
    await this.equipesRepo.update(id, dto);
    return this.equipesRepo.findOne({ where: { id } });
  }

  async removeEquipe(projeto_id: string, id: string) {
    const e = await this.equipesRepo.findOne({ where: { id, projeto_id } });
    if (!e) throw new NotFoundException('Equipe não encontrada');
    await this.equipesRepo.delete(id);
  }

  // ── Inscrições ────────────────────────────────────────────────────────────

  async findInscricoes(projeto_id: string) {
    const rows = await this.dataSource.query(`
      SELECT pi.*,
        row_to_json(pe) as equipe,
        a.logradouro  as aluno_logradouro,
        a.numero      as aluno_numero,
        a.bairro      as aluno_bairro,
        a.cidade      as aluno_cidade,
        foto.url_arquivo as foto_url,
        (
          SELECT array_agg(pid.tipo)
          FROM projeto_inscricao_documentos pid
          WHERE pid.inscricao_id = pi.id
            AND pid.tipo = ANY($2)
        ) as docs_ext_tipos,
        (
          SELECT array_agg(di.tipo)
          FROM documentos_inscricao di
          JOIN inscricoes insc ON insc.id = di.inscricao_id
          WHERE insc.aluno_id::text = pi.aluno_id::text
            AND di.tipo = ANY($2)
        ) as docs_itp_tipos
      FROM projeto_inscricoes pi
      LEFT JOIN projeto_equipes pe ON pe.id = pi.equipe_id
      LEFT JOIN alunos a ON a.id = pi.aluno_id
      LEFT JOIN LATERAL (
        SELECT d.url_arquivo
        FROM inscricoes insc
        JOIN documentos_inscricao d ON d.inscricao_id = insc.id AND d.tipo = 'foto_aluno'
        WHERE insc.aluno_id::text = pi.aluno_id::text
        ORDER BY d.created_at DESC
        LIMIT 1
      ) foto ON true
      WHERE pi.projeto_id = $1
      ORDER BY pi.created_at ASC
    `, [projeto_id, TIPOS_OBRIGATORIOS]);

    return rows.map((r: any) => {
      const logradouro = r.logradouro || r.aluno_logradouro;
      const numero     = r.numero     || r.aluno_numero;
      const bairro     = r.aluno_bairro;
      const cidade     = r.aluno_cidade;

      const tiposExistentes: string[] = r.aluno_id
        ? (r.docs_itp_tipos || [])
        : (r.docs_ext_tipos || []);
      const docsPendentes = TIPOS_OBRIGATORIOS.filter(t => !tiposExistentes.includes(t));

      return {
        ...r,
        endereco: [logradouro, numero, bairro, cidade].filter(Boolean).join(', ') || null,
        doc_status: docsPendentes.length === 0 ? 'ok' : 'pendente',
        docs_pendentes: docsPendentes,
      };
    });
  }

  async createInscricao(projeto_id: string, dto: CreateInscricaoDto & { email_responsavel?: string }) {
    await this.findOne(projeto_id);
    const tipo = dto.aluno_id ? 'regular' : 'externo';

    let dadosAluno: Partial<CreateInscricaoDto> = {};
    let emailConfirmacao: string | null = dto.email_responsavel ?? null;

    if (dto.aluno_id) {
      const aluno = await this.dataSource.query(
        `SELECT a.nome_completo, a.data_nascimento, a.nome_responsavel, a.telefone_alternativo,
                a.email_responsavel as aluno_email_responsavel,
                pi.nome_responsavel  AS insc_nome_responsavel,
                pi.telefone_responsavel AS insc_telefone_responsavel
         FROM alunos a
         LEFT JOIN projeto_inscricoes pi ON pi.aluno_id::text = a.id::text
         WHERE a.id = $1
         ORDER BY pi.id DESC
         LIMIT 1`,
        [dto.aluno_id],
      );
      if (!aluno.length) throw new BadRequestException('Aluno não encontrado');
      const a = aluno[0];
      dadosAluno = {
        nome_completo:        a.nome_completo,
        data_nascimento:      a.data_nascimento,
        nome_responsavel:     a.nome_responsavel || a.insc_nome_responsavel || null,
        telefone_responsavel: a.telefone_alternativo || a.insc_telefone_responsavel || null,
      };
      emailConfirmacao = a.aluno_email_responsavel || null;
      if (!emailConfirmacao) {
        this.logger.warn(`Aluno ${dto.aluno_id} sem email_responsavel — confirmação não enviada`);
      }
    }

    const i = this.inscricoesRepo.create({
      projeto_id,
      tipo,
      ...dadosAluno,
      ...dto,
      email_responsavel: emailConfirmacao,
    });
    const saved = await this.inscricoesRepo.save(i);

    // Dispara email de confirmação sem bloquear a resposta
    if (emailConfirmacao) {
      const projeto = await this.projetosRepo.findOne({ where: { id: projeto_id } });
      this.emailService.enviarConfirmacaoInscricao({
        email: emailConfirmacao,
        nome_crianca: saved.nome_completo,
        nome_responsavel: saved.nome_responsavel ?? '',
        nome_projeto: projeto?.nome ?? '',
        data_inicio: projeto?.data_inicio ?? '',
        data_fim: projeto?.data_fim ?? '',
        equipe: null,
        docs_pendentes: TIPOS_OBRIGATORIOS,
      }).catch(e => this.logger.warn(`Email confirmação falhou: ${e.message}`));
    }

    return saved;
  }

  async updateInscricao(projeto_id: string, id: string, dto: Partial<CreateInscricaoDto> & { status?: string; convertido_em_aluno?: boolean }) {
    const i = await this.inscricoesRepo.findOne({ where: { id, projeto_id } });
    if (!i) throw new NotFoundException('Inscrição não encontrada');
    await this.inscricoesRepo.update(id, dto);
    return this.inscricoesRepo.findOne({ where: { id }, relations: ['equipe'] });
  }

  async removeInscricao(projeto_id: string, id: string) {
    const i = await this.inscricoesRepo.findOne({ where: { id, projeto_id } });
    if (!i) throw new NotFoundException('Inscrição não encontrada');
    await this.inscricoesRepo.delete(id);
  }

  async buscarInscricaoAnterior(nome: string, nascimento: string) {
    const rows = await this.dataSource.query(`
      SELECT pi.*,
        pe.nome as equipe_nome,
        p.nome as projeto_nome,
        (
          SELECT json_agg(json_build_object('tipo', pid.tipo, 'url_arquivo', pid.url_arquivo))
          FROM projeto_inscricao_documentos pid
          WHERE pid.inscricao_id = pi.id
        ) as documentos
      FROM projeto_inscricoes pi
      LEFT JOIN projeto_equipes pe ON pe.id = pi.equipe_id
      LEFT JOIN projetos p ON p.id = pi.projeto_id
      WHERE pi.nome_completo ILIKE $1
        AND pi.data_nascimento = $2
        AND pi.tipo = 'externo'
      ORDER BY pi.created_at DESC
      LIMIT 1
    `, [`%${nome}%`, nascimento]);

    return rows[0] ?? null;
  }

  // ── Documentos ────────────────────────────────────────────────────────────

  private docPath(projeto_id: string, inscricao_id: string, tipo: string) {
    return `projetos/${projeto_id}/inscricoes/${inscricao_id}/${tipo}.jpg`;
  }

  async uploadDocumento(
    projeto_id: string,
    inscricao_id: string,
    tipo: string,
    file: Express.Multer.File,
  ) {
    if (!(TIPOS_DOCUMENTO_PROJETO as readonly string[]).includes(tipo)) {
      throw new BadRequestException(`Tipo inválido: ${tipo}`);
    }

    const inscricao = await this.inscricoesRepo.findOne({ where: { id: inscricao_id, projeto_id } });
    if (!inscricao) throw new NotFoundException('Inscrição não encontrada');

    const path = this.docPath(projeto_id, inscricao_id, tipo);
    await this.supabase.upload(file.buffer, path, file.mimetype);

    // Upsert — mesmo tipo substitui
    const existing = await this.documentosRepo.findOne({ where: { inscricao_id, tipo } });
    if (existing) {
      await this.documentosRepo.update(existing.id, { url_arquivo: path });
      return { ...existing, url_arquivo: path };
    }

    const doc = this.documentosRepo.create({ inscricao_id, tipo, url_arquivo: path });
    return this.documentosRepo.save(doc);
  }

  async findDocumentos(projeto_id: string, inscricao_id: string) {
    const inscricao = await this.inscricoesRepo.findOne({ where: { id: inscricao_id, projeto_id } });
    if (!inscricao) throw new NotFoundException('Inscrição não encontrada');

    const docs = await this.documentosRepo.find({ where: { inscricao_id } });

    return Promise.all(
      docs.map(async doc => {
        let signed_url: string | null = null;
        if (doc.url_arquivo !== 'fisico') {
          signed_url = await this.supabase.getSignedUrl(doc.url_arquivo, 3600).catch(() => null);
        }
        return { ...doc, signed_url };
      }),
    );
  }

  async removeDocumento(projeto_id: string, inscricao_id: string, docId: string) {
    const inscricao = await this.inscricoesRepo.findOne({ where: { id: inscricao_id, projeto_id } });
    if (!inscricao) throw new NotFoundException('Inscrição não encontrada');

    const doc = await this.documentosRepo.findOne({ where: { id: docId, inscricao_id } });
    if (!doc) throw new NotFoundException('Documento não encontrado');

    if (doc.url_arquivo !== 'fisico') {
      await this.supabase.delete(doc.url_arquivo).catch(() => {});
    }

    await this.documentosRepo.delete(docId);
  }

  async marcarDeclaracaoFisica(projeto_id: string, inscricao_id: string) {
    const inscricao = await this.inscricoesRepo.findOne({ where: { id: inscricao_id, projeto_id } });
    if (!inscricao) throw new NotFoundException('Inscrição não encontrada');

    const existing = await this.documentosRepo.findOne({
      where: { inscricao_id, tipo: 'declaracao_escolar' },
    });

    if (existing) {
      await this.documentosRepo.update(existing.id, { url_arquivo: 'fisico' });
      return { ...existing, url_arquivo: 'fisico' };
    }

    const doc = this.documentosRepo.create({
      inscricao_id,
      tipo: 'declaracao_escolar',
      url_arquivo: 'fisico',
    });
    return this.documentosRepo.save(doc);
  }

  // ── Presença ──────────────────────────────────────────────────────────────

  async findPresencas(projeto_id: string, data?: string, equipe_id?: string) {
    const qb = this.presencasRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.inscricao', 'i')
      .leftJoinAndSelect('p.equipe', 'e')
      .where('p.projeto_id = :projeto_id', { projeto_id });
    if (data) qb.andWhere('p.data = :data', { data });
    if (equipe_id) qb.andWhere('p.equipe_id = :equipe_id', { equipe_id });
    return qb.orderBy('i.nome_completo', 'ASC').getMany();
  }

  async upsertPresenca(projeto_id: string, inscricao_id: string, data: string, body: { presente?: boolean; hora_entrada?: string; equipe_id?: string }) {
    const inscricao = await this.inscricoesRepo.findOne({ where: { id: inscricao_id, projeto_id } });
    if (!inscricao) throw new NotFoundException('Inscrição não encontrada');

    let presenca = await this.presencasRepo.findOne({ where: { inscricao_id, data } });
    if (presenca) {
      await this.presencasRepo.update(presenca.id, body);
      return this.presencasRepo.findOne({ where: { id: presenca.id } });
    }
    presenca = this.presencasRepo.create({
      projeto_id,
      inscricao_id,
      data,
      equipe_id: inscricao.equipe_id,
      ...body,
    });
    return this.presencasRepo.save(presenca);
  }

  // ── Checkout via barcode ──────────────────────────────────────────────────

  async checkout(inscricao_id: string) {
    const inscricao = await this.inscricoesRepo.findOne({
      where: { id: inscricao_id },
      relations: ['equipe'],
    });
    if (!inscricao) throw new NotFoundException('Inscrição não encontrada');

    const hoje = new Date().toISOString().slice(0, 10);
    const presenca = await this.presencasRepo.findOne({
      where: { inscricao_id, data: hoje, presente: true },
    });

    if (!presenca) {
      throw new BadRequestException('Nenhuma presença registrada para hoje para este participante');
    }
    if (presenca.hora_saida) {
      return { ok: true, ja_registrado: true, inscricao, presenca };
    }

    const hora_saida = new Date().toTimeString().slice(0, 8);
    await this.presencasRepo.update(presenca.id, { hora_saida });

    return { ok: true, ja_registrado: false, inscricao, hora_saida };
  }
}
