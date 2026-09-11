import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as client from 'prom-client';

// Serviço central de métricas (Prometheus, via prom-client). Três tipos:
// 1) HTTP (duração/contagem por rota) — alimentado pelo MetricsInterceptor.
// 2) RUM (Web Vitals do navegador) — alimentado por POST /api/metrics/rum.
// 3) Negócio (matrículas/dia, chamados abertos etc.) — refrescado a cada
//    60s via setInterval, para não bater no banco a cada scrape.
@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly logger = new Logger('MetricsService');
  readonly registry = new client.Registry();

  readonly httpDuration: client.Histogram<string>;
  readonly httpCounter: client.Counter<string>;
  readonly webVitals: client.Histogram<string>;

  private readonly matriculasHoje: client.Gauge<string>;
  private readonly chamadosAbertos: client.Gauge<string>;
  private readonly movimentacoesHoje: client.Gauge<string>;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    client.collectDefaultMetrics({ register: this.registry });

    this.httpDuration = new client.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duração das requisições HTTP (segundos) — base pro Apdex no Grafana',
      labelNames: ['method', 'route', 'status_code'],
      // Buckets pensados pro threshold de Apdex T=0.5s (satisfeito ≤T,
      // tolerando ≤4T) — ver painel Apdex no Grafana.
      buckets: [0.05, 0.1, 0.2, 0.5, 1, 2, 4, 8],
      registers: [this.registry],
    });
    this.httpCounter = new client.Counter({
      name: 'http_requests_total',
      help: 'Total de requisições HTTP, por rota e status',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });
    this.webVitals = new client.Histogram({
      name: 'web_vitals_seconds',
      help: 'Web Vitals reportados pelo navegador (LCP/INP em segundos, CLS adimensional)',
      labelNames: ['name', 'pathname'],
      buckets: [0.1, 0.25, 0.5, 1, 1.5, 2, 2.5, 4, 8],
      registers: [this.registry],
    });

    this.matriculasHoje = new client.Gauge({
      name: 'itp_matriculas_hoje',
      help: 'Matrículas (inscrições convertidas) criadas hoje',
      registers: [this.registry],
    });
    this.chamadosAbertos = new client.Gauge({
      name: 'itp_chamados_abertos',
      help: 'Chamados acadêmicos com status aberto ou em_andamento',
      registers: [this.registry],
    });
    this.movimentacoesHoje = new client.Gauge({
      name: 'itp_movimentacoes_financeiras_hoje',
      help: 'Movimentações financeiras lançadas hoje',
      registers: [this.registry],
    });
  }

  onModuleInit() {
    this.atualizarMetricasNegocio().catch(() => {});
    setInterval(() => this.atualizarMetricasNegocio().catch((e) =>
      this.logger.warn(`Erro ao atualizar métricas de negócio: ${e.message}`)),
      60_000,
    );
  }

  private async atualizarMetricasNegocio() {
    const [[matriculas], [chamados], [movimentacoes]] = await Promise.all([
      this.dataSource.query(
        `SELECT count(*)::int AS c FROM inscricoes WHERE status_matricula = 'Matriculado' AND created_at::date = CURRENT_DATE`,
      ),
      this.dataSource.query(
        `SELECT count(*)::int AS c FROM chamados_academicos WHERE status IN ('aberto', 'em_andamento')`,
      ),
      this.dataSource.query(
        `SELECT count(*)::int AS c FROM movimentacoes_financeiras WHERE data = CURRENT_DATE`,
      ),
    ]);
    this.matriculasHoje.set(matriculas?.c ?? 0);
    this.chamadosAbertos.set(chamados?.c ?? 0);
    this.movimentacoesHoje.set(movimentacoes?.c ?? 0);
  }
}
