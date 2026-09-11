"use client";

import { useEffect, useState } from "react";
import { tabela, th, td, painel, Selo, botao } from "../ui";

type Infra = {
  cpu_ram: { load_1min: number | null; load_5min: number | null; load_15min: number | null; ram_total_mb: number | null; ram_disponivel_mb: number | null; ram_uso_pct: number | null };
  disco: { total_mb: number; usado_mb: number; disponivel_mb: number; uso_pct: number };
  uptime_swap: { uptime: string; swap_total_mb: number | null; swap_usado_mb: number | null };
  rede: { conexoes_estabelecidas: number | null; portas_ouvindo: string[] };
  top_processos: { pid: string; comando: string; cpu_pct: string; mem_pct: string }[];
  containers: { nome: string; status: string; imagem: string; rodando: boolean }[];
  containers_stats: { nome: string; cpu_pct: string; mem_uso: string; mem_pct: string }[];
  postgres: {
    conexoes_por_estado: Record<string, number>;
    tamanho_banco: string | null;
    maiores_tabelas: { tabela: string; tamanho: string; linhas_estimadas: number }[];
    query_mais_antiga_ativa: { duracao_s: number; estado: string; query: string } | null;
    schemas: string[];
  };
  endpoints_criticos: { nome: string; url: string; status_code: number | null; tempo_s: number | null; ok: boolean }[];
  coletado_em: string;
};

function corPct(pct: number | null): string {
  if (pct === null) return "#8a8f98";
  if (pct >= 90) return "#8f1620";
  if (pct >= 75) return "#8a5a00";
  return "#1e5c1e";
}

function BarraUso({ pct, rotulo }: { pct: number | null; rotulo: string }) {
  return (
    <div style={{ ...painel, padding: 14, flex: 1, minWidth: 200 }}>
      <div style={{ fontSize: 11, color: "#8a8f98", textTransform: "uppercase", marginBottom: 6 }}>{rotulo}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: corPct(pct) }}>{pct !== null ? `${pct}%` : "—"}</div>
      <div style={{ background: "#e4e6ea", borderRadius: 3, height: 6, marginTop: 8, overflow: "hidden" }}>
        <div style={{ width: `${pct ?? 0}%`, background: corPct(pct), height: "100%" }} />
      </div>
    </div>
  );
}

export default function InfraPage() {
  const [dados, setDados] = useState<Infra | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = () => {
    setCarregando(true);
    fetch("/backend-api/api/infra")
      .then((r) => r.json())
      .then(setDados)
      .finally(() => setCarregando(false));
  };

  useEffect(() => {
    carregar();
    const id = setInterval(carregar, 30000);
    return () => clearInterval(id);
  }, []);

  if (carregando && !dados) return <main><p>Carregando...</p></main>;
  if (!dados) return <main><p>Sem dados.</p></main>;

  return (
    <main>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 4px" }}>Infraestrutura — vm-itp-prod</h1>
          <p style={{ color: "#5b6068", fontSize: 12.5, margin: "0 0 14px" }}>
            Visão rápida, atualiza a cada 30s. Coletado em {new Date(dados.coletado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.
          </p>
        </div>
        <a
          href="https://grafana.itp.institutotiapretinha.org"
          target="_blank" rel="noopener noreferrer"
          style={{ ...botao, background: "#4c1d95", color: "#fff", border: "none", textDecoration: "none" }}
        >
          📊 Ver histórico completo no Grafana ↗
        </a>
      </div>
      <p style={{ fontSize: 11.5, color: "#8a8f98", margin: "-8px 0 14px" }}>
        Grafana tem histórico, alertas e métricas de negócio (KPI) — essa página aqui é só o retrato do momento.
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <BarraUso pct={dados.cpu_ram.ram_uso_pct} rotulo="RAM em uso" />
        <BarraUso pct={dados.disco.uso_pct} rotulo="Disco em uso" />
        <div style={{ ...painel, padding: 14, flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 11, color: "#8a8f98", textTransform: "uppercase", marginBottom: 6 }}>Load average (1/5/15min)</div>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "monospace" }}>
            {dados.cpu_ram.load_1min} / {dados.cpu_ram.load_5min} / {dados.cpu_ram.load_15min}
          </div>
          <div style={{ fontSize: 11, color: "#8a8f98", marginTop: 4 }}>2 vCPUs — acima de 2.0 já satura</div>
        </div>
        <div style={{ ...painel, padding: 14, flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 11, color: "#8a8f98", textTransform: "uppercase", marginBottom: 6 }}>Postgres</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            {Object.values(dados.postgres.conexoes_por_estado || {}).reduce((a, b) => a + b, 0)} conexões
          </div>
          <div style={{ fontSize: 12, color: "#5b6068", marginTop: 4 }}>{dados.postgres.tamanho_banco ?? "—"}</div>
          <div style={{ fontSize: 11, color: "#8a8f98", marginTop: 4 }}>
            {Object.entries(dados.postgres.conexoes_por_estado || {}).map(([k, v]) => `${k}:${v}`).join(" · ")}
          </div>
        </div>
        <div style={{ ...painel, padding: 14, flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 11, color: "#8a8f98", textTransform: "uppercase", marginBottom: 6 }}>Uptime / Swap / Rede</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{dados.uptime_swap.uptime || "—"}</div>
          <div style={{ fontSize: 11, color: "#5b6068", marginTop: 4 }}>
            Swap: {dados.uptime_swap.swap_usado_mb ?? 0}MB / {dados.uptime_swap.swap_total_mb ?? 0}MB ·
            {" "}{dados.rede.conexoes_estabelecidas ?? "—"} conexões TCP estabelecidas
          </div>
        </div>
      </div>

      {dados.postgres.query_mais_antiga_ativa && dados.postgres.query_mais_antiga_ativa.duracao_s > 30 && (
        <div style={{ ...painel, padding: 12, marginBottom: 16, background: "#fdf6ea", border: "1px solid #f2b705" }}>
          <strong>⚠ Query ativa há {dados.postgres.query_mais_antiga_ativa.duracao_s}s</strong> ({dados.postgres.query_mais_antiga_ativa.estado}):{" "}
          <code style={{ fontSize: 11 }}>{dados.postgres.query_mais_antiga_ativa.query}</code>
        </div>
      )}

      <div style={{ display: "flex", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 340px" }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 8px" }}>Endpoints críticos</h3>
          <div style={{ border: "1px solid #c9ccd1" }}>
            <table style={tabela}>
              <thead><tr><th style={th}>Status</th><th style={th}>Nome</th><th style={th}>Tempo</th></tr></thead>
              <tbody>
                {dados.endpoints_criticos.map((e) => (
                  <tr key={e.nome}>
                    <td style={td}>
                      <Selo texto={e.ok ? `OK (${e.status_code})` : `FALHA (${e.status_code ?? "sem resposta"})`} cor={e.ok ? { bg: "#dcefdc", fg: "#1e5c1e" } : { bg: "#f6cdd0", fg: "#8f1620" }} />
                    </td>
                    <td style={td}>{e.nome}<div style={{ fontSize: 10, color: "#8a8f98" }}>{e.url}</div></td>
                    <td style={{ ...td, fontFamily: "monospace" }}>{e.tempo_s !== null ? `${(e.tempo_s * 1000).toFixed(0)}ms` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ flex: "1 1 340px" }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 8px" }}>Top 5 processos (CPU)</h3>
          <div style={{ border: "1px solid #c9ccd1" }}>
            <table style={tabela}>
              <thead><tr><th style={th}>PID</th><th style={th}>Comando</th><th style={th}>CPU%</th><th style={th}>MEM%</th></tr></thead>
              <tbody>
                {dados.top_processos.map((p) => (
                  <tr key={p.pid}>
                    <td style={td}>{p.pid}</td>
                    <td style={{ ...td, fontFamily: "monospace" }}>{p.comando}</td>
                    <td style={td}>{p.cpu_pct}</td>
                    <td style={td}>{p.mem_pct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 8px" }}>Containers (uso de CPU/memória)</h3>
      <div style={{ border: "1px solid #c9ccd1", marginBottom: 16 }}>
        <table style={tabela}>
          <thead>
            <tr><th style={th}>Status</th><th style={th}>Nome</th><th style={th}>Imagem</th><th style={th}>CPU</th><th style={th}>Memória</th></tr>
          </thead>
          <tbody>
            {dados.containers.map((c) => {
              const stats = dados.containers_stats.find((s) => s.nome === c.nome);
              return (
                <tr key={c.nome}>
                  <td style={td}>
                    <Selo texto={c.rodando ? "RODANDO" : "PARADO"} cor={c.rodando ? { bg: "#dcefdc", fg: "#1e5c1e" } : { bg: "#f6cdd0", fg: "#8f1620" }} />
                  </td>
                  <td style={td}>{c.nome}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{c.imagem}</td>
                  <td style={{ ...td, fontFamily: "monospace" }}>{stats?.cpu_pct ?? "—"}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{stats ? `${stats.mem_uso} (${stats.mem_pct})` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 8px" }}>Maiores tabelas — erp_itp_db</h3>
      <p style={{ fontSize: 11.5, color: "#8a8f98", margin: "0 0 8px" }}>
        Schemas no banco: {dados.postgres.schemas.join(", ") || "—"}
      </p>
      <div style={{ border: "1px solid #c9ccd1" }}>
        <table style={tabela}>
          <thead><tr><th style={th}>Tabela</th><th style={th}>Tamanho</th><th style={th}>Linhas (estimado)</th></tr></thead>
          <tbody>
            {dados.postgres.maiores_tabelas.map((t) => (
              <tr key={t.tabela}>
                <td style={td}>{t.tabela}</td>
                <td style={{ ...td, fontFamily: "monospace" }}>{t.tamanho}</td>
                <td style={{ ...td, fontFamily: "monospace" }}>{t.linhas_estimadas.toLocaleString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
