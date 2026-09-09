"use client";

import { useEffect, useMemo, useState } from "react";

type ErroAgrupado = {
  CodErro: string;
  Aplicacao: string;
  Categoria: string;
  TipoErro: string;
  Criticidade: string;
  UltimoStatusConhecido: string;
  OcorrenciasNoPeriodo: number;
  PrimeiraNoPeriodo: string;
  UltimaNoPeriodo: string;
};

type Ocorrencia = {
  TimestampOcorrencia: string;
  MensagemNormalizada: string;
  Categoria: string;
  Criticidade: string;
};

type PontoTendencia = { dia: string; Categoria: string; total: number };

const CORES_CRITICIDADE: Record<string, string> = {
  baixa: "#16a34a",
  media: "#ca8a04",
  alta: "#ea580c",
  critica: "#dc2626",
};

function Pill({ texto, cor }: { texto: string; cor?: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        color: cor ? "#fff" : "#334155",
        background: cor || "#e2e8f0",
      }}
    >
      {texto}
    </span>
  );
}

export default function Home() {
  const [itens, setItens] = useState<ErroAgrupado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [tendencia, setTendencia] = useState<PontoTendencia[]>([]);

  const [filtroAplicacao, setFiltroAplicacao] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroCriticidade, setFiltroCriticidade] = useState("");

  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [historico, setHistorico] = useState<Ocorrencia[]>([]);

  const carregarLista = () => {
    setCarregando(true);
    const params = new URLSearchParams();
    if (filtroAplicacao) params.set("aplicacao", filtroAplicacao);
    if (filtroCategoria) params.set("categoria", filtroCategoria);
    if (filtroCriticidade) params.set("criticidade", filtroCriticidade);

    fetch(`/backend-api/api/erros?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setItens(data.itens || []);
        setErro(data.aviso || null);
      })
      .catch((e) => setErro(String(e)))
      .finally(() => setCarregando(false));
  };

  useEffect(() => {
    carregarLista();
    fetch("/backend-api/api/tendencia?dias=30")
      .then((r) => r.json())
      .then((data) => setTendencia(data.pontos || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroAplicacao, filtroCategoria, filtroCriticidade]);

  const abrirHistorico = (codErro: string) => {
    setSelecionado(codErro);
    fetch(`/backend-api/api/erros/${codErro}/historico`)
      .then((r) => r.json())
      .then((data) => setHistorico(data.ocorrencias || []));
  };

  const totalPorCategoria = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const p of tendencia) acc[p.Categoria] = (acc[p.Categoria] || 0) + p.total;
    return Object.entries(acc).sort((a, b) => b[1] - a[1]);
  }, [tendencia]);
  const maxCategoria = Math.max(1, ...totalPorCategoria.map(([, v]) => v));

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Catálogo de Erros</h1>
      <p style={{ color: "#64748b", marginBottom: 24, fontSize: 14 }}>
        Histórico analítico (Parquet) — só leitura. Aprovação e status ao vivo ficam na
        SharePoint List.
      </p>

      <section
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 16,
          marginBottom: 24,
          border: "1px solid #e2e8f0",
        }}
      >
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "#475569" }}>
          Tendência — últimos 30 dias, por categoria
        </h2>
        {totalPorCategoria.length === 0 && (
          <p style={{ fontSize: 13, color: "#94a3b8" }}>Sem dados no período.</p>
        )}
        {totalPorCategoria.map(([categoria, total]) => (
          <div key={categoria} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div style={{ width: 100, fontSize: 12, color: "#334155" }}>{categoria}</div>
            <div style={{ flex: 1, background: "#f1f5f9", borderRadius: 4, height: 16 }}>
              <div
                style={{
                  width: `${(total / maxCategoria) * 100}%`,
                  background: "#6366f1",
                  height: "100%",
                  borderRadius: 4,
                }}
              />
            </div>
            <div style={{ width: 30, fontSize: 12, textAlign: "right", color: "#334155" }}>{total}</div>
          </div>
        ))}
      </section>

      <section style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <select value={filtroAplicacao} onChange={(e) => setFiltroAplicacao(e.target.value)} style={selectStyle}>
          <option value="">Todas as aplicações</option>
          <option value="ITP">ITP</option>
          <option value="APRXM">APRXM</option>
          <option value="DW">DW</option>
          <option value="BD">BD</option>
        </select>
        <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} style={selectStyle}>
          <option value="">Todas as categorias</option>
          <option value="banco">banco</option>
          <option value="código">código</option>
          <option value="infra">infra</option>
          <option value="security">security</option>
          <option value="integracao">integracao</option>
          <option value="usuario">usuario</option>
          <option value="terceiros">terceiros</option>
        </select>
        <select value={filtroCriticidade} onChange={(e) => setFiltroCriticidade(e.target.value)} style={selectStyle}>
          <option value="">Todas as criticidades</option>
          <option value="baixa">baixa</option>
          <option value="media">media</option>
          <option value="alta">alta</option>
          <option value="critica">critica</option>
        </select>
      </section>

      {erro && <p style={{ color: "#b91c1c", fontSize: 13 }}>{erro}</p>}
      {carregando ? (
        <p style={{ color: "#94a3b8" }}>Carregando...</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 12, overflow: "hidden" }}>
          <thead>
            <tr style={{ background: "#f8fafc", textAlign: "left" }}>
              {["Aplicação", "Categoria", "Tipo", "Criticidade", "Status", "Ocorrências", "Última vez"].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => (
              <tr
                key={item.CodErro}
                onClick={() => abrirHistorico(item.CodErro)}
                style={{ borderTop: "1px solid #f1f5f9", cursor: "pointer" }}
              >
                <td style={tdStyle}>{item.Aplicacao}</td>
                <td style={tdStyle}>{item.Categoria}</td>
                <td style={tdStyle}>{item.TipoErro}</td>
                <td style={tdStyle}>
                  <Pill texto={item.Criticidade} cor={CORES_CRITICIDADE[item.Criticidade]} />
                </td>
                <td style={tdStyle}>{item.UltimoStatusConhecido}</td>
                <td style={tdStyle}>{item.OcorrenciasNoPeriodo}</td>
                <td style={tdStyle}>{new Date(item.UltimaNoPeriodo).toLocaleString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selecionado && (
        <div
          onClick={() => setSelecionado(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 12, padding: 20, maxWidth: 700, width: "100%", maxHeight: "80vh", overflow: "auto" }}
          >
            <h3 style={{ marginTop: 0 }}>Histórico — {selecionado}</h3>
            {historico.map((h, i) => (
              <div key={i} style={{ borderBottom: "1px solid #f1f5f9", padding: "8px 0", fontSize: 13 }}>
                <div style={{ color: "#64748b" }}>{new Date(h.TimestampOcorrencia).toLocaleString("pt-BR")}</div>
                <div style={{ fontFamily: "monospace", fontSize: 12 }}>{h.MensagemNormalizada}</div>
              </div>
            ))}
            <button onClick={() => setSelecionado(null)} style={{ marginTop: 12 }}>Fechar</button>
          </div>
        </div>
      )}
    </main>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  fontSize: 13,
};

const thStyle: React.CSSProperties = { padding: "10px 12px", fontSize: 12, color: "#64748b", fontWeight: 600 };
const tdStyle: React.CSSProperties = { padding: "10px 12px", fontSize: 13, color: "#1e293b" };
