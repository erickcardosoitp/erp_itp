import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Req, Res, Logger,
  UseGuards, BadRequestException, Headers,
} from '@nestjs/common';
import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModuloPermGuard } from '../auth/guards/modulo-perm.guard';
import { ModuloPerm } from '../auth/decorators/modulo-perm.decorator';
import { CaptacaoService } from './captacao.service';
import { PipelineStatus, SourceType } from './entities/captacao-opportunity.entity';
import { ConfigService } from '@nestjs/config';

// Rate limiting em memória (por userId).
// Em ambiente serverless multi-instância é uma proteção best-effort;
// a principal barreira é a autenticação JWT obrigatória em todos os endpoints.
const searchRateMap = new Map<string, { count: number; resetAt: number }>();
const docRateMap    = new Map<string, { count: number; resetAt: number }>();
const previewRateMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(map: Map<string, any>, userId: string, maxPerMin: number): void {
  const now = Date.now();
  const entry = map.get(userId) ?? { count: 0, resetAt: now + 60_000 };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + 60_000; }
  entry.count++;
  map.set(userId, entry);
  if (entry.count > maxPerMin) throw new BadRequestException('Rate limit atingido. Aguarde 1 minuto.');
}

/** Comparação de segredos em tempo constante — evita timing attack */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Extrai userId do JWT de forma fail-closed */
function extractUserId(req: any): string {
  const id = req.user?.userId ?? req.user?.sub;
  if (!id || typeof id !== 'string') throw new BadRequestException('Usuário não identificado');
  return id;
}

@Controller('captacao')
@UseGuards(JwtAuthGuard, ModuloPermGuard)
export class CaptacaoController {
  private readonly logger = new Logger(CaptacaoController.name);

  constructor(
    private readonly svc: CaptacaoService,
    private readonly config: ConfigService,
  ) {}

  // ── POST /captacao/search ──────────────────────────────────────────────────
  @Post('search')
  @ModuloPerm('captacao', 'visualizar')
  async search(
    @Body() body: { query: string; areas?: string[]; source_types?: string[] },
    @Req() req: any,
  ) {
    const userId = extractUserId(req);
    checkRateLimit(searchRateMap, userId, 6);

    if (!body.query || typeof body.query !== 'string' || body.query.trim().length < 3) {
      throw new BadRequestException('Query deve ter ao menos 3 caracteres');
    }
    if (body.query.length > 500) throw new BadRequestException('Query muito longa');

    const requestId = uuidv4();
    const startedAt = Date.now();
    // loga apenas tamanho da query, não o conteúdo (evita log poisoning)
    this.logger.log(JSON.stringify({ event: 'search_start', request_id: requestId, user_id: userId, query_len: body.query.length }));

    const results = await this.svc.search(body.query, requestId, body.areas, body.source_types);

    this.logger.log(JSON.stringify({
      event: 'search_done',
      request_id: requestId,
      results: results.length,
      latency_ms: Date.now() - startedAt,
    }));

    return { request_id: requestId, results };
  }

  // ── POST /captacao/opportunities ───────────────────────────────────────────
  @Post('opportunities')
  @ModuloPerm('captacao', 'incluir')
  async save(@Body() body: any, @Req() req: any) {
    const userId = extractUserId(req);
    if (!body.title || typeof body.title !== 'string' || !body.source_type) {
      throw new BadRequestException('title e source_type são obrigatórios');
    }
    return this.svc.saveOpportunity(body as any, userId);
  }

  // ── GET /captacao/opportunities ────────────────────────────────────────────
  @Get('opportunities')
  @ModuloPerm('captacao', 'visualizar')
  async list(
    @Query('status') status?: PipelineStatus,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.svc.listPipeline(
      status,
      search,
      Math.max(1, parseInt(page, 10) || 1),
      Math.min(100, parseInt(limit, 10) || 20),
    );
  }

  // ── GET /captacao/insights ────────────────────────────────────────────────
  @Get('insights')
  @ModuloPerm('captacao', 'visualizar')
  insights() {
    return this.svc.getInsights();
  }

  // ── GET /captacao/insights/monthly ───────────────────────────────────────
  @Get('insights/monthly')
  @ModuloPerm('captacao', 'visualizar')
  getMonthly() {
    return this.svc.getMonthlySubmissions();
  }

  // ── GET /captacao/opportunities/:id ───────────────────────────────────────
  @Get('opportunities/:id')
  @ModuloPerm('captacao', 'visualizar')
  getById(@Param('id') id: string) {
    return this.svc.getById(id);
  }

  // ── PATCH /captacao/opportunities/:id ─────────────────────────────────────
  @Patch('opportunities/:id')
  @ModuloPerm('captacao', 'editar')
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const userId = extractUserId(req);
    return this.svc.updateOpportunity(id, body, userId);
  }

  // ── PATCH /captacao/opportunities/:id/status ──────────────────────────────
  @Patch('opportunities/:id/status')
  @ModuloPerm('captacao', 'editar')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: PipelineStatus; notes?: string },
    @Req() req: any,
  ) {
    const userId = extractUserId(req);
    return this.svc.updateStatus(id, body.status, userId, body.notes);
  }

  // ── DELETE /captacao/opportunities/:id ───────────────────────────────────
  @Delete('opportunities/:id')
  @ModuloPerm('captacao', 'excluir')
  softDelete(@Param('id') id: string, @Req() req: any) {
    const userId = extractUserId(req);
    return this.svc.softDelete(id, userId);
  }

  // ── POST /captacao/opportunities/:id/eligibility ─────────────────────────
  @Post('opportunities/:id/eligibility')
  @ModuloPerm('captacao', 'visualizar')
  async analyzeEligibility(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const userId = extractUserId(req);
    checkRateLimit(docRateMap, userId, 3);
    const requestId = uuidv4();
    this.logger.log(JSON.stringify({ event: 'eligibility_start', request_id: requestId, user_id: userId }));
    const analysis = await this.svc.analyzeEligibility(id, requestId);
    return { request_id: requestId, analysis };
  }

  // ── POST /captacao/opportunities/:id/documents/preview ───────────────────
  @Post('opportunities/:id/documents/preview')
  @ModuloPerm('captacao', 'visualizar')
  async previewDocument(
    @Param('id') id: string,
    @Body() body: { template_type: string },
    @Req() req: any,
  ) {
    const userId = extractUserId(req);
    checkRateLimit(previewRateMap, userId, 5);
    const requestId = uuidv4();
    const content = await this.svc.previewDocument(id, body.template_type, requestId);
    return { content };
  }

  // ── POST /captacao/opportunities/:id/documents ────────────────────────────
  @Post('opportunities/:id/documents')
  @ModuloPerm('captacao', 'incluir')
  async generateDocument(
    @Param('id') id: string,
    @Body() body: { template_type: string },
    @Req() req: any,
    @Res() res: Response,
  ) {
    const userId = extractUserId(req);
    checkRateLimit(docRateMap, userId, 3);

    const requestId = uuidv4();
    const bytes = await this.svc.generateDocument(id, body.template_type, userId, requestId);

    // template_type já foi validado no service — apenas sufixo seguro no header
    const safeType = body.template_type.replace(/[^a-z_]/g, '').slice(0, 30);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="captacao_${safeType}_${id.slice(0, 8)}.docx"`,
      'Content-Length': bytes.length,
    });
    res.send(bytes);
  }

  // ── POST /captacao/cron/expire (protegido por cron-secret) ────────────────
  @Post('cron/expire')
  @ModuloPerm('captacao', 'visualizar')
  async cronExpire(@Headers('x-cron-secret') secret: string) {
    const expected = this.config.get<string>('CRON_SECRET');
    if (!expected || !secret || !timingSafeEqual(expected, secret)) throw new BadRequestException('Acesso negado');
    return this.svc.expireStale();
  }
}
