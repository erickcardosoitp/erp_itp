import {
  Injectable, Logger, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { CaptacaoOpportunity, PipelineStatus, SourceType } from './entities/captacao-opportunity.entity';
import { PipelineEvent } from './entities/pipeline-event.entity';
import { GeminiService, GeminiSearchResult } from './gemini.service';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

const VALID_STATUS: PipelineStatus[] = [
  'prospeccao', 'qualificacao', 'elaboracao', 'submissao', 'aprovado', 'reprovado', 'archived',
];
const VALID_SOURCE_TYPES: SourceType[] = [
  'edital', 'grant', 'patrocinio', 'lei_incentivo', 'outro',
];
const VALID_TEMPLATE_TYPES = [
  'project_summary', 'cover_letter', 'budget_memo',
  'oficio', 'chamamento', 'projeto_esboco', 'proposta',
];

@Injectable()
export class CaptacaoService {
  private readonly logger = new Logger(CaptacaoService.name);

  constructor(
    @InjectRepository(CaptacaoOpportunity)
    private readonly oppRepo: Repository<CaptacaoOpportunity>,
    @InjectRepository(PipelineEvent)
    private readonly eventRepo: Repository<PipelineEvent>,
    private readonly dataSource: DataSource,
    private readonly geminiSvc: GeminiService,
  ) {}

  // ── Busca via Gemini (NÃO persiste — apenas retorna) ──────────────────────

  async search(
    query: string,
    requestId: string,
    areas?: string[],
    sourceTypes?: string[],
  ): Promise<GeminiSearchResult[]> {
    return this.geminiSvc.searchOpportunities(query, requestId, areas, sourceTypes);
  }

  // ── Salvar oportunidade no pipeline ───────────────────────────────────────

  async saveOpportunity(
    data: Partial<CaptacaoOpportunity> & { title: string; source_type: SourceType },
    userId: string,
  ): Promise<CaptacaoOpportunity> {
    if (!VALID_SOURCE_TYPES.includes(data.source_type)) {
      throw new BadRequestException(`source_type inválido: ${data.source_type}`);
    }

    const opp = this.oppRepo.create({
      ...data,
      status: 'prospeccao',
      created_by: userId,
    });
    const saved = await this.oppRepo.save(opp);

    // Registra evento inicial no pipeline
    await this.eventRepo.save(
      this.eventRepo.create({
        opportunity_id: saved.id,
        from_status: undefined,
        to_status: 'prospeccao',
        changed_by: userId,
        notes: 'Oportunidade adicionada ao pipeline',
      }),
    );

    return saved;
  }

  // ── Listar pipeline (paginado) ────────────────────────────────────────────

  async listPipeline(
    status?: PipelineStatus,
    search?: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: CaptacaoOpportunity[]; total: number; page: number; limit: number }> {
    const qb = this.oppRepo
      .createQueryBuilder('opp')
      .where('opp.deleted_at IS NULL')
      .orderBy('opp.created_at', 'DESC');

    if (status) qb.andWhere('opp.status = :status', { status });
    if (search) {
      qb.andWhere('(opp.title ILIKE :search OR opp.entity_name ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  // ── Buscar por ID ─────────────────────────────────────────────────────────

  async getById(id: string): Promise<CaptacaoOpportunity & { pipeline_events: PipelineEvent[] }> {
    const opp = await this.oppRepo.findOne({
      where: { id, deleted_at: IsNull() },
    });
    if (!opp) throw new NotFoundException('Oportunidade não encontrada');

    const events = await this.eventRepo.find({
      where: { opportunity_id: id },
      order: { created_at: 'DESC' },
    });

    return { ...opp, pipeline_events: events } as any;
  }

  // ── Atualizar status (move no pipeline) ────────────────────────────────────

  async updateStatus(
    id: string,
    newStatus: PipelineStatus,
    userId: string,
    notes?: string,
  ): Promise<CaptacaoOpportunity> {
    if (!VALID_STATUS.includes(newStatus)) {
      throw new BadRequestException(`Status inválido: ${newStatus}`);
    }

    const opp = await this.oppRepo.findOne({ where: { id, deleted_at: IsNull() } });
    if (!opp) throw new NotFoundException('Oportunidade não encontrada');

    const fromStatus = opp.status;
    opp.status = newStatus;
    const updated = await this.oppRepo.save(opp);

    await this.eventRepo.save(
      this.eventRepo.create({
        opportunity_id: id,
        from_status: fromStatus,
        to_status: newStatus,
        changed_by: userId,
        notes,
      }),
    );

    return updated;
  }

  // ── Atualizar campos (PATCH parcial) ──────────────────────────────────────

  // Campos editáveis pelo usuário via PATCH — whitelist explícita (evita mass assignment)
  private static readonly PATCH_ALLOWED: Array<keyof CaptacaoOpportunity> = [
    'notes', 'deadline', 'estimated_value', 'source_url',
    'entity_name', 'title', 'expires_at',
  ];

  async updateOpportunity(
    id: string,
    data: Partial<CaptacaoOpportunity>,
    userId: string,
  ): Promise<CaptacaoOpportunity> {
    const opp = await this.oppRepo.findOne({ where: { id, deleted_at: IsNull() } });
    if (!opp) throw new NotFoundException('Oportunidade não encontrada');

    const safe: Partial<CaptacaoOpportunity> = {};
    for (const key of CaptacaoService.PATCH_ALLOWED) {
      if (key in (data as any)) {
        (safe as any)[key] = (data as any)[key];
      }
    }

    // Valida source_url se presente
    if ('source_url' in safe && safe.source_url) {
      try {
        const parsed = new URL(safe.source_url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          throw new BadRequestException('source_url deve ser http ou https');
        }
      } catch {
        throw new BadRequestException('source_url inválida');
      }
    }

    Object.assign(opp, safe);
    return this.oppRepo.save(opp);
  }

  // ── Soft delete ───────────────────────────────────────────────────────────

  async softDelete(id: string, userId: string): Promise<{ ok: boolean }> {
    const opp = await this.oppRepo.findOne({ where: { id, deleted_at: IsNull() } });
    if (!opp) throw new NotFoundException('Oportunidade não encontrada');

    opp.deleted_at = new Date();
    await this.oppRepo.save(opp);
    this.logger.log(`[Captação] soft_delete id=${id} by=${userId}`);
    return { ok: true };
  }

  // ── Insights (server-side) ────────────────────────────────────────────────

  async getInsights() {
    const [byStatus, bySource, totals, expiring] = await Promise.all([
      this.dataSource.query(`
        SELECT status, COUNT(*)::int as count
        FROM captacao_opportunities
        WHERE deleted_at IS NULL
        GROUP BY status
        ORDER BY count DESC
      `),
      this.dataSource.query(`
        SELECT source_type, COUNT(*)::int as count,
               COALESCE(SUM(estimated_value), 0)::numeric as total_value
        FROM captacao_opportunities
        WHERE deleted_at IS NULL
        GROUP BY source_type
        ORDER BY count DESC
      `),
      this.dataSource.query(`
        SELECT
          COUNT(*)::int                                          AS total,
          COUNT(*) FILTER (WHERE status = 'aprovado')::int      AS approved,
          COALESCE(SUM(estimated_value), 0)::numeric            AS value_potential,
          COALESCE(SUM(estimated_value) FILTER (WHERE status = 'submissao'), 0)::numeric AS value_submitted,
          COALESCE(SUM(estimated_value) FILTER (WHERE status = 'aprovado'), 0)::numeric  AS value_approved,
          COALESCE(AVG(ai_score), 0)::numeric                   AS avg_score
        FROM captacao_opportunities
        WHERE deleted_at IS NULL
      `),
      this.dataSource.query(`
        SELECT COUNT(*)::int as count
        FROM captacao_opportunities
        WHERE deleted_at IS NULL
          AND deadline IS NOT NULL
          AND deadline BETWEEN now() AND now() + INTERVAL '30 days'
      `),
    ]);

    const t = totals[0] || {};
    const total = t.total ?? 0;
    const approved = t.approved ?? 0;

    return {
      kpis: {
        total,
        approved,
        approval_rate: total > 0 ? +(approved / total * 100).toFixed(1) : 0,
        value_potential: +(t.value_potential ?? 0),
        value_submitted: +(t.value_submitted ?? 0),
        value_approved: +(t.value_approved ?? 0),
        avg_score: +(parseFloat(t.avg_score ?? '0')).toFixed(1),
        expiring_30d: expiring[0]?.count ?? 0,
      },
      by_pipeline_status: byStatus,
      by_source_type: bySource,
    };
  }

  async getMonthlySubmissions(): Promise<Array<{ month: string; count: number }>> {
    const rows = await this.dataSource.query(`
      SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
             COUNT(*)::int AS count
      FROM captacao_opportunities
      WHERE deleted_at IS NULL
        AND created_at >= now() - INTERVAL '12 months'
      GROUP BY 1
      ORDER BY 1
    `);
    return rows;
  }

  // ── Expirar oportunidades vencidas (cron) ─────────────────────────────────

  async expireStale(): Promise<{ expired: number }> {
    const result = await this.dataSource.query(`
      UPDATE captacao_opportunities
      SET status = 'archived', updated_at = now()
      WHERE deadline IS NOT NULL
        AND deadline < now()
        AND deleted_at IS NULL
        AND status NOT IN ('aprovado', 'reprovado', 'archived')
      RETURNING id
    `);
    this.logger.log(`[Captação] expire_stale: ${result.length} oportunidades arquivadas`);
    return { expired: result.length };
  }

  // ── Análise de elegibilidade via Gemini ──────────────────────────────────────

  async analyzeEligibility(opportunityId: string, requestId: string) {
    const opp = await this.oppRepo.findOne({ where: { id: opportunityId, deleted_at: IsNull() } });
    if (!opp) throw new NotFoundException('Oportunidade não encontrada');
    return this.geminiSvc.analyzeOpportunityEligibility(opp, requestId);
  }

  // ── Prévia do documento (texto bruto da IA, sem build DOCX) ─────────────────

  async previewDocument(
    opportunityId: string,
    templateType: string,
    requestId: string,
  ): Promise<string> {
    if (!VALID_TEMPLATE_TYPES.includes(templateType)) {
      throw new BadRequestException(`template_type inválido: ${templateType}`);
    }
    const opp = await this.oppRepo.findOne({ where: { id: opportunityId, deleted_at: IsNull() } });
    if (!opp) throw new NotFoundException('Oportunidade não encontrada');
    return this.geminiSvc.generateDocument(opp, templateType, requestId);
  }

  // ── Gerar documento DOCX ─────────────────────────────────────────────────

  async generateDocument(
    opportunityId: string,
    templateType: string,
    userId: string,
    requestId: string,
  ): Promise<Buffer> {
    if (!VALID_TEMPLATE_TYPES.includes(templateType)) {
      throw new BadRequestException(`template_type inválido: ${templateType}`);
    }

    const opp = await this.oppRepo.findOne({ where: { id: opportunityId, deleted_at: IsNull() } });
    if (!opp) throw new NotFoundException('Oportunidade não encontrada');

    const content = await this.geminiSvc.generateDocument(opp, templateType, requestId);
    if (!content || content.trim().length === 0) {
      throw new BadRequestException('Conteúdo do documento vazio');
    }

    return this.buildDocx(content, opp.title, templateType);
  }

  // ── Construtor DOCX ───────────────────────────────────────────────────────

  private async buildDocx(content: string, title: string, templateType: string): Promise<Buffer> {
    const templateLabels: Record<string, string> = {
      project_summary: 'Resumo Executivo do Projeto',
      cover_letter: 'Carta de Apresentação',
      budget_memo: 'Memorando de Orçamento',
    };

    const today = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric',
    });

    const paragraphs: Paragraph[] = [];

    // Header
    paragraphs.push(
      new Paragraph({
        text: 'INSTITUTO TIA PRETINHA',
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({
        text: 'CNPJ: 11.759.851/0001-39 | Associação Privada sem Fins Lucrativos',
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: 'CNPJ: 11.759.851/0001-39 | Associação Privada sem Fins Lucrativos', size: 18 })],
      }),
      new Paragraph({
        text: templateLabels[templateType] || templateType,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 200 },
      }),
      new Paragraph({
        children: [new TextRun({ text: `Referência: ${title}`, bold: true, size: 22 })],
        spacing: { after: 100 },
      }),
      new Paragraph({
        children: [new TextRun({ text: `Gerado em: ${today}`, italics: true, size: 18 })],
        spacing: { after: 400 },
      }),
    );

    // Conteúdo por parágrafo
    const sections = content.split('\n\n').filter(s => s.trim());
    for (const section of sections) {
      const lines = section.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const isHeading = /^#{1,3}\s/.test(trimmed) || /^[A-Z\s]{5,}:?\s*$/.test(trimmed);
        const text = trimmed.replace(/^#{1,3}\s/, '').replace(/\*\*/g, '');

        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text,
                bold: isHeading,
                size: isHeading ? 24 : 22,
              }),
            ],
            spacing: { before: isHeading ? 200 : 80, after: isHeading ? 100 : 60 },
          }),
        );
      }
    }

    // Footer
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: `Gerado pelo ERP ITP em ${today}`, italics: true, size: 16 })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 600 },
      }),
    );

    const doc = new Document({
      sections: [{
        properties: {},
        children: paragraphs,
      }],
    });

    return Packer.toBuffer(doc) as Promise<Buffer>;
  }
}
