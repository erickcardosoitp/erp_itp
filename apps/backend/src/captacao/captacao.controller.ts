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

// Rate limiting simples em memória (por userId)
const searchRateMap = new Map<string, { count: number; resetAt: number }>();
const docRateMap    = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(map: Map<string, any>, userId: string, maxPerMin: number): void {
  const now = Date.now();
  const entry = map.get(userId) ?? { count: 0, resetAt: now + 60_000 };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + 60_000; }
  entry.count++;
  map.set(userId, entry);
  if (entry.count > maxPerMin) throw new BadRequestException('Rate limit atingido. Aguarde 1 minuto.');
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
    const userId = req.user?.userId ?? req.user?.sub ?? 'unknown';
    checkRateLimit(searchRateMap, userId, 10);

    if (!body.query || body.query.trim().length < 3) {
      throw new BadRequestException('Query deve ter ao menos 3 caracteres');
    }

    const requestId = uuidv4();
    const startedAt = Date.now();
    this.logger.log(JSON.stringify({ event: 'search_start', request_id: requestId, user_id: userId, query: body.query }));

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
    const userId = req.user?.userId ?? req.user?.sub;
    if (!body.title || !body.source_type) {
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
    const userId = req.user?.userId ?? req.user?.sub;
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
    const userId = req.user?.userId ?? req.user?.sub;
    return this.svc.updateStatus(id, body.status, userId, body.notes);
  }

  // ── DELETE /captacao/opportunities/:id ───────────────────────────────────
  @Delete('opportunities/:id')
  @ModuloPerm('captacao', 'excluir')
  softDelete(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.userId ?? req.user?.sub;
    return this.svc.softDelete(id, userId);
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
    const userId = req.user?.userId ?? req.user?.sub;
    checkRateLimit(docRateMap, userId, 5);

    const requestId = uuidv4();
    const bytes = await this.svc.generateDocument(id, body.template_type, userId, requestId);

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="captacao_${body.template_type}_${id.slice(0, 8)}.docx"`,
      'Content-Length': bytes.length,
    });
    res.send(bytes);
  }

  // ── POST /captacao/cron/expire (protegido por cron-secret) ────────────────
  @Post('cron/expire')
  @ModuloPerm('captacao', 'visualizar')
  async cronExpire(@Headers('x-cron-secret') secret: string) {
    const expected = this.config.get<string>('CRON_SECRET');
    if (expected && secret !== expected) throw new BadRequestException('Acesso negado');
    return this.svc.expireStale();
  }
}
