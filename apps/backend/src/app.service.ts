import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class AppService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  getHello(): string {
    return 'Hello World!';
  }

  async monitoramentoTI() {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();
    const toMB = (b: number) => +(b / 1024 / 1024).toFixed(2);

    let latencia_ms = 0;
    let db_tamanho = '–';
    let db_tamanho_bytes = 0;
    let cache_hit_pct: number | null = null;
    let conexoes_ativas = 0;
    let conexoes_totais = 0;
    let max_conexoes = 0;
    let tabelas: { nome: string; tamanho: string; linhas: number }[] = [];

    try {
      const t0 = Date.now();
      await this.dataSource.query('SELECT 1');
      latencia_ms = Date.now() - t0;

      const [sizeRow] = await this.dataSource.query(
        `SELECT pg_size_pretty(pg_database_size(current_database())) AS tamanho,
                pg_database_size(current_database()) AS tamanho_bytes`,
      );
      db_tamanho       = sizeRow?.tamanho ?? '–';
      db_tamanho_bytes = parseInt(sizeRow?.tamanho_bytes ?? '0');

      const [cacheRow] = await this.dataSource.query(
        `SELECT round(
           sum(blks_hit) * 100.0 / nullif(sum(blks_hit) + sum(blks_read), 0), 1
         ) AS hit_pct FROM pg_stat_database`,
      );
      cache_hit_pct = cacheRow?.hit_pct != null ? parseFloat(cacheRow.hit_pct) : null;

      const [connRow] = await this.dataSource.query(
        `SELECT
           count(*) FILTER (WHERE state = 'active') AS ativas,
           count(*) AS totais,
           (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS max_conn
         FROM pg_stat_activity`,
      );
      if (connRow) {
        conexoes_ativas = parseInt(connRow.ativas  ?? '0');
        conexoes_totais = parseInt(connRow.totais  ?? '0');
        max_conexoes    = parseInt(connRow.max_conn ?? '0');
      }

      const rawTabelas = await this.dataSource.query(
        `SELECT
           t.tablename AS nome,
           pg_size_pretty(pg_total_relation_size(quote_ident(t.tablename))) AS tamanho,
           pg_total_relation_size(quote_ident(t.tablename)) AS tamanho_bytes,
           c.reltuples::bigint AS linhas
         FROM pg_tables t
         LEFT JOIN pg_class c ON c.relname = t.tablename
         WHERE t.schemaname = 'public'
         ORDER BY pg_total_relation_size(quote_ident(t.tablename)) DESC
         LIMIT 20`,
      );
      tabelas = rawTabelas.map((r: any) => ({
        nome:    r.nome,
        tamanho: r.tamanho,
        linhas:  Math.max(0, parseInt(r.linhas ?? '0')),
      }));
    } catch { /* Neon pode não suportar todas as pg_stat_* views */ }

    return {
      servidor: {
        uptime_segundos: Math.floor(process.uptime()),
        node_version: process.version,
        ambiente: process.env.NODE_ENV ?? 'development',
        plataforma: process.platform,
        arquitetura: process.arch,
        memoria: {
          heap_usado_mb:  toMB(mem.heapUsed),
          heap_total_mb:  toMB(mem.heapTotal),
          rss_mb:         toMB(mem.rss),
          externo_mb:     toMB(mem.external),
          percentual:     +((mem.heapUsed / mem.heapTotal) * 100).toFixed(1),
        },
        cpu: {
          usuario_ms:  Math.round(cpu.user   / 1000),
          sistema_ms:  Math.round(cpu.system / 1000),
        },
      },
      banco: {
        latencia_ms,
        tamanho:         db_tamanho,
        tamanho_bytes:   db_tamanho_bytes,
        cache_hit_pct,
        conexoes_ativas,
        conexoes_totais,
        max_conexoes,
        tabelas,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
