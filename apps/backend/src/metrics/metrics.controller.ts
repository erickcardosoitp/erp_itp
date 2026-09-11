import { Body, Controller, Get, Header, Logger, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { EmailService } from '../email.service';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  private readonly logger = new Logger('Metrics');

  constructor(
    private readonly metrics: MetricsService,
    private readonly emailService: EmailService,
  ) {}

  @Public()
  @Get()
  async expor(@Res() res: Response) {
    res.setHeader('Content-Type', this.metrics.registry.contentType);
    res.send(await this.metrics.registry.metrics());
  }

  // RUM (Real User Monitoring) — Web Vitals reportados pelo navegador
  // via a lib `web-vitals`. LCP/INP chegam em milissegundos (convertidos
  // pra segundos, mesma unidade do histograma de HTTP); CLS é
  // adimensional (0-1 tipicamente), guardado como está — aproximação
  // aceitável pro v1, ver ARCHITECTURE.md seção 9.
  @Public()
  @Post('rum')
  registrarWebVital(@Body() body: { name?: string; value?: number; pathname?: string }) {
    const { name, value, pathname } = body;
    if (!name || typeof value !== 'number') return { ok: false };
    const valorFinal = name === 'CLS' ? value : value / 1000;
    this.metrics.webVitals.observe({ name, pathname: pathname ?? '(desconhecida)' }, valorFinal);
    return { ok: true };
  }

  // Ponte de alerta: Grafana não tem SMTP nativo funcionando neste
  // tenant (Security Defaults bloqueia SMTP AUTH legado) — este webhook
  // recebe o alerta e reaproveita o EmailService (Graph API) já usado
  // pelo resto do sistema pra mandar por email.
  @Public()
  @Post('alerta-grafana')
  async receberAlertaGrafana(@Body() body: any) {
    try {
      const alertas = body?.alerts || [];
      const resumo = alertas
        .map((a: any) => `[${a.status?.toUpperCase()}] ${a.labels?.alertname || '(sem nome)'} — ${a.annotations?.summary || a.annotations?.description || ''}`)
        .join('\n');
      await this.emailService.enviarGenerico(
        'erickcardoso@institutotiapretinha.org',
        `[Grafana] ${body?.title || 'Alerta de monitoramento'}`,
        `<pre>${resumo || JSON.stringify(body).slice(0, 2000)}</pre>`,
      );
    } catch (e: any) {
      this.logger.error(`Falha ao processar alerta do Grafana: ${e.message}`);
    }
    return { ok: true };
  }
}
