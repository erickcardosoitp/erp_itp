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
  private readonly alunosAtivos: client.Gauge<string>;
  private readonly boletosPendentes: client.Gauge<string>;
  private readonly colaboradoresAtivos: client.Gauge<string>;
  private readonly captacaoOportunidadesAtivas: client.Gauge<string>;
  private readonly estoqueAbaixoMinimo: client.Gauge<string>;

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
    this.alunosAtivos = new client.Gauge({
      name: 'itp_alunos_ativos',
      help: 'Total de alunos ativos (matriculados)',
      registers: [this.registry],
    });
    this.boletosPendentes = new client.Gauge({
      name: 'itp_boletos_pendentes',
      help: 'Boletos com status Pendente (a receber)',
      registers: [this.registry],
    });
    this.colaboradoresAtivos = new client.Gauge({
      name: 'itp_colaboradores_ativos',
      help: 'Colaboradores (RH) ativos',
      registers: [this.registry],
    });
    this.captacaoOportunidadesAtivas = new client.Gauge({
      name: 'itp_captacao_oportunidades_ativas',
      help: 'Oportunidades de captação de recursos em andamento (não arquivadas/reprovadas)',
      registers: [this.registry],
    });
    this.estoqueAbaixoMinimo = new client.Gauge({
      name: 'itp_estoque_abaixo_minimo',
      help: 'Produtos de estoque ativos com quantidade abaixo do mínimo',
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
    const [
      [matriculas], [chamados], [movimentacoes],
      [alunos], [boletos], [colaboradores], [captacao], [estoque],
    ] = await Promise.all([
      this.dataSource.query(
        `SELECT count(*)::int AS c FROM inscricoes WHERE status_matricula = 'Matriculado' AND created_at::date = CURRENT_DATE`,
      ),
      this.dataSource.query(
        `SELECT count(*)::int AS c FROM chamados_academicos WHERE status IN ('aberto', 'em_andamento')`,
      ),
      this.dataSource.query(
        `SELECT count(*)::int AS c FROM movimentacoes_financeiras WHERE data = CURRENT_DATE`,
      ),
      this.dataSource.query(`SELECT count(*)::int AS c FROM alunos WHERE ativo IS NOT FALSE`),
      this.dataSource.query(`SELECT count(*)::int AS c FROM boletos WHERE status = 'Pendente'`),
      this.dataSource.query(`SELECT count(*)::int AS c FROM gente_colaboradores WHERE ativo = true`),
      this.dataSource.query(
        `SELECT count(*)::int AS c FROM captacao_opportunities WHERE status NOT IN ('reprovado', 'archived') AND deleted_at IS NULL`,
      ),
      this.dataSource.query(
        `SELECT count(*)::int AS c FROM estoque_produtos WHERE quantidade_atual < estoque_minimo AND ativo = true`,
      ),
    ]);
    this.matriculasHoje.set(matriculas?.c ?? 0);
    this.chamadosAbertos.set(chamados?.c ?? 0);
    this.movimentacoesHoje.set(movimentacoes?.c ?? 0);
    this.alunosAtivos.set(alunos?.c ?? 0);
    this.boletosPendentes.set(boletos?.c ?? 0);
    this.colaboradoresAtivos.set(colaboradores?.c ?? 0);
    this.captacaoOportunidadesAtivas.set(captacao?.c ?? 0);
    this.estoqueAbaixoMinimo.set(estoque?.c ?? 0);
  }
}
