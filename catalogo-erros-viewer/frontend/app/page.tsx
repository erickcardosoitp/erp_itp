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
        display: "inline-block", padding: "2px 10px", borderRadius: 999,
        fontSize: 12, fontWeight: 600, color: cor ? "#fff" : "#334155",
        background: cor || "#e2e8f0",
      }}
    >
      {texto}
    </span>
  );
}

/** Linha "chave: valor" do painel de contexto, no estilo SAP Error Log. */
function LinhaContexto({ nome, valor }: { nome: string; valor: React.ReactNode }) {
  if (valor === undefined || valor === null || valor === "") return null;
  return (
    <tr style={{ borderTop: "1px solid #f1f5f9" }}>
      <td style={{ padding: "6px 10px", fontSize: 12, color: "#64748b", width: 220, verticalAlign: "top" }}>
        {nome}
      </td>
      <td style={{ padding: "6px 10px", fontSize: 13, color: "#1e293b", fontFamily: nome.includes("Mensagem") || nome.includes("Assinatura") ? "monospace" : undefined }}>
        {valor}
      </td>
    </tr>
  );
}

export default function Home() {
  const [itens, setItens] = useState<ErroAgrupado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);

  const [filtroAplicacao, setFiltroAplicacao] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroCriticidade, setFiltroCriticidade] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [busca, setBusca] = useState("");

  const [selecionado, setSelecionado] = useState<ErroAgrupado | null>(null);
  const [historico, setHistorico] = useState<Ocorrencia[]>([]);

  useEffect(() => {
    setCarregando(true);
    const params = new URLSearchParams();
    if (filtroAplicacao) params.set("aplicacao", filtroAplicacao);
    if (filtroCategoria) params.set("categoria", filtroCategoria);
    if (filtroCriticidade) params.set("criticidade", filtroCriticidade);
    if (filtroStatus) params.set("status", filtroStatus);

    fetch(`/backend-api/api/erros?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setItens(data.itens || []);
        setAviso(data.aviso || null);
      })
      .catch((e) => setAviso(String(e)))
      .finally(() => setCarregando(false));
  }, [filtroAplicacao, filtroCategoria, filtroCriticidade, filtroStatus]);

  const itensFiltrados = useMemo(() => {
    if (!busca.trim()) return itens;
    const alvo = busca.toLowerCase();
    return itens.filter(
      (i) =>
        i.TipoErro?.toLowerCase().includes(alvo) ||
        i.CodErro?.toLowerCase().includes(alvo)
    );
  }, [itens, busca]);

  const selecionar = (item: ErroAgrupado) => {
    setSelecionado(item);
    fetch(`/backend-api/api/erros/${item.CodErro}/historico`)
      .then((r) => r.json())
      .then((data) => setHistorico(data.ocorrencias || []));
  };

  return (
    <main style={{ padding: "20px 24px", height: "100vh", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Catálogo de Erros — Overview</h1>
      <p style={{ color: "#64748b", fontSize: 13, margin: "2px 0 16px" }}>
        Histórico analítico (Parquet), só leitura. Aprovação/resolução ao vivo ficam na SharePoint List.
      </p>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input
          placeholder="Buscar por tipo de erro ou código..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ ...selectStyle, minWidth: 260 }}
        />
        <select value={filtroAplicacao} onChange={(e) => setFiltroAplicacao(e.target.value)} style={selectStyle}>
          <option value="">Aplicação: todas</option>
          <option value="ITP">ITP</option>
          <option value="APRXM">APRXM</option>
          <option value="DW">DW</option>
          <option value="BD">BD</option>
        </select>
        <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} style={selectStyle}>
          <option value="">Categoria: todas</option>
          <option value="banco">banco</option>
          <option value="código">código</option>
          <option value="infra">infra</option>
          <option value="security">security</option>
          <option value="integracao">integracao</option>
          <option value="usuario">usuario</option>
          <option value="terceiros">terceiros</option>
        </select>
        <select value={filtroCriticidade} onChange={(e) => setFiltroCriticidade(e.target.value)} style={selectStyle}>
          <option value="">Criticidade: todas</option>
          <option value="baixa">baixa</option>
          <option value="media">media</option>
          <option value="alta">alta</option>
          <option value="critica">critica</option>
        </select>
        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} style={selectStyle}>
          <option value="">Status: todos</option>
          <option value="aberto">aberto</option>
          <option value="resolvido">resolvido</option>
          <option value="reaberto">reaberto</option>
          <option value="conhecido">conhecido</option>
          <option value="descartado">descartado</option>
        </select>
        <span style={{ fontSize: 12, color: "#94a3b8", alignSelf: "center", marginLeft: "auto" }}>
          {itensFiltrados.length} erro(s)
        </span>
      </div>

      {aviso && <p style={{ color: "#b91c1c", fontSize: 13 }}>{aviso}</p>}

      {/* Painel 1: tabela (Overview, estilo SAP) */}
      <div style={{ flex: "0 0 45%", overflow: "auto", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }}>
        {carregando ? (
          <p style={{ padding: 16, color: "#94a3b8" }}>Carregando...</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ position: "sticky", top: 0, background: "#f8fafc" }}>
              <tr>
                {["", "Aplicação", "Categoria", "Tipo de Erro", "Criticidade", "Status", "Ocorrências", "Última vez"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {itensFiltrados.map((item) => (
                <tr
                  key={item.CodErro}
                  onClick={() => selecionar(item)}
                  style={{
                    borderTop: "1px solid #f1f5f9",
                    cursor: "pointer",
                    background: selecionado?.CodErro === item.CodErro ? "#eff6ff" : undefined,
                  }}
                >
                  <td style={tdStyle}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, display: "inline-block", background: CORES_CRITICIDADE[item.Criticidade] || "#cbd5e1" }} />
                  </td>
                  <td style={tdStyle}>{item.Aplicacao}</td>
                  <td style={tdStyle}>{item.Categoria}</td>
                  <td style={tdStyle}>{item.TipoErro}</td>
                  <td style={tdStyle}><Pill texto={item.Criticidade} cor={CORES_CRITICIDADE[item.Criticidade]} /></td>
                  <td style={tdStyle}>{item.UltimoStatusConhecido}</td>
                  <td style={tdStyle}>{item.OcorrenciasNoPeriodo}</td>
                  <td style={tdStyle}>{new Date(item.UltimaNoPeriodo).toLocaleString("pt-BR")}</td>
                </tr>
              ))}
              {itensFiltrados.length === 0 && !carregando && (
                <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>Nenhum erro encontrado com esses filtros.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Painel 2: detalhe fixo embaixo (Error Context, estilo SAP) */}
      <div style={{ flex: 1, marginTop: 12, overflow: "auto", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 16 }}>
        {!selecionado ? (
          <p style={{ color: "#94a3b8", fontSize: 13 }}>Selecione um erro na tabela acima pra ver o contexto completo.</p>
        ) : (
          <>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700 }}>
              Contexto — {selecionado.CodErro}
            </h3>
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20 }}>
              <tbody>
                <LinhaContexto nome="Aplicação" valor={selecionado.Aplicacao} />
                <LinhaContexto nome="Categoria" valor={selecionado.Categoria} />
                <LinhaContexto nome="Tipo de Erro" valor={selecionado.TipoErro} />
                <LinhaContexto nome="Criticidade" valor={<Pill texto={selecionado.Criticidade} cor={CORES_CRITICIDADE[selecionado.Criticidade]} />} />
                <LinhaContexto nome="Status" valor={selecionado.UltimoStatusConhecido} />
                <LinhaContexto nome="Ocorrências no período" valor={selecionado.OcorrenciasNoPeriodo} />
                <LinhaContexto nome="Primeira ocorrência" valor={new Date(selecionado.PrimeiraNoPeriodo).toLocaleString("pt-BR")} />
                <LinhaContexto nome="Última ocorrência" valor={new Date(selecionado.UltimaNoPeriodo).toLocaleString("pt-BR")} />
              </tbody>
            </table>

            <h4 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "#475569" }}>
              Histórico de ocorrências ({historico.length})
            </h4>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {historico.map((h, i) => (
                  <LinhaContexto
                    key={i}
                    nome={new Date(h.TimestampOcorrencia).toLocaleString("pt-BR")}
                    valor={h.MensagemNormalizada}
                  />
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </main>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "6px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 13,
};
const thStyle: React.CSSProperties = { padding: "8px 10px", fontSize: 11, color: "#64748b", fontWeight: 600, textAlign: "left" };
const tdStyle: React.CSSProperties = { padding: "8px 10px", fontSize: 13, color: "#1e293b" };
