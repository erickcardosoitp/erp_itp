"use client";

import { useEffect, useMemo, useState } from "react";
import { CORES_CRITICIDADE, CORES_STATUS, Selo, tabela, th, td as tdBase, botao, botaoPrimario, input as inputStyle } from "../ui";

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

// Fundo bem suave da linha inteira, pra bater o olho na criticidade sem
// competir com o destaque de seleção (azul).
const FUNDO_LINHA_CRITICIDADE: Record<string, string> = {
  baixa: "transparent",
  media: "#fdf6ea",
  alta: "#fdf0e8",
  critica: "#fbe9ea",
};

// Cor da contagem de ocorrências por volume — não é sobre gravidade do
// erro, é sobre "isso está acontecendo demais" independente da criticidade.
function formatarDataBR(iso: string): string {
  // Parquet grava timestamp UTC-aware; sem timeZone explícito, o browser
  // usa o fuso do próprio SO de quem acessa (não o do Brasil), causando
  // exibição errada quando a máquina/servidor está em UTC.
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function corPorOcorrencias(qtd: number): string {
  if (qtd >= 10) return "#dc2626";
  if (qtd >= 4) return "#ea580c";
  if (qtd >= 2) return "#ca8a04";
  return "#334155";
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

  const carregarItens = () => {
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
  };

  useEffect(carregarItens, [filtroAplicacao, filtroCategoria, filtroCriticidade, filtroStatus]);

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
    <main style={{ height: "calc(100vh - 76px)", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
      <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Catálogo de Erros</h1>
      <p style={{ color: "#5b6068", fontSize: 12.5, margin: "2px 0 14px" }}>
        Histórico analítico (Parquet), só leitura. Aprovação/resolução ao vivo ficam na SharePoint List.
      </p>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input
          placeholder="Buscar por tipo de erro ou código..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ ...inputStyle, minWidth: 260 }}
        />
        <select value={filtroAplicacao} onChange={(e) => setFiltroAplicacao(e.target.value)} style={inputStyle}>
          <option value="">Aplicação: todas</option>
          <option value="ITP">ITP</option>
          <option value="APRXM">APRXM</option>
          <option value="DW">DW</option>
          <option value="BD">BD</option>
        </select>
        <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} style={inputStyle}>
          <option value="">Categoria: todas</option>
          <option value="banco">banco</option>
          <option value="código">código</option>
          <option value="infra">infra</option>
          <option value="security">security</option>
          <option value="integracao">integracao</option>
          <option value="usuario">usuario</option>
          <option value="terceiros">terceiros</option>
        </select>
        <select value={filtroCriticidade} onChange={(e) => setFiltroCriticidade(e.target.value)} style={inputStyle}>
          <option value="">Criticidade: todas</option>
          <option value="baixa">baixa</option>
          <option value="media">media</option>
          <option value="alta">alta</option>
          <option value="critica">critica</option>
        </select>
        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} style={inputStyle}>
          <option value="">Status: todos</option>
          <option value="aberto">aberto</option>
          <option value="resolvido">resolvido</option>
          <option value="reaberto">reaberto</option>
          <option value="conhecido">conhecido</option>
          <option value="descartado">descartado</option>
        </select>
        <button
          onClick={() => {
            carregarItens();
            if (selecionado) selecionar(selecionado);
          }}
          disabled={carregando}
          style={{ ...botaoPrimario, cursor: carregando ? "default" : "pointer", opacity: carregando ? 0.6 : 1 }}
        >
          {carregando ? "Atualizando..." : "↻ Atualizar"}
        </button>
        <span style={{ fontSize: 12, color: "#94a3b8", alignSelf: "center", marginLeft: "auto" }}>
          {itensFiltrados.length} erro(s)
        </span>
      </div>

      {aviso && <p style={{ color: "#b91c1c", fontSize: 13 }}>{aviso}</p>}

      {/* Painel 1: tabela (Overview, estilo SAP) */}
      <div style={{ flex: "0 0 45%", overflow: "auto", border: "1px solid #c9ccd1" }}>
        {carregando ? (
          <p style={{ padding: 16, color: "#5b6068" }}>Carregando...</p>
        ) : (
          <table style={tabela}>
            <thead style={{ position: "sticky", top: 0 }}>
              <tr>
                {["Aplicação", "Categoria", "Tipo de Erro", "Criticidade", "Status", "Ocorrências", "Última vez"].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {itensFiltrados.map((item) => (
                <tr
                  key={item.CodErro}
                  onClick={() => selecionar(item)}
                  style={{
                    cursor: "pointer",
                    background:
                      selecionado?.CodErro === item.CodErro
                        ? "#dbe7f5"
                        : FUNDO_LINHA_CRITICIDADE[item.Criticidade] || undefined,
                  }}
                >
                  <td style={tdBase}>{item.Aplicacao}</td>
                  <td style={tdBase}>{item.Categoria}</td>
                  <td style={tdBase}>{item.TipoErro}</td>
                  <td style={tdBase}>
                    {CORES_CRITICIDADE[item.Criticidade] && <Selo texto={item.Criticidade} cor={CORES_CRITICIDADE[item.Criticidade]} />}
                  </td>
                  <td style={tdBase}>
                    {CORES_STATUS[item.UltimoStatusConhecido]
                      ? <Selo texto={item.UltimoStatusConhecido} cor={CORES_STATUS[item.UltimoStatusConhecido]} />
                      : item.UltimoStatusConhecido}
                  </td>
                  <td style={{ ...tdBase, fontWeight: 700, color: corPorOcorrencias(item.OcorrenciasNoPeriodo), fontFamily: "monospace" }}>
                    {item.OcorrenciasNoPeriodo}
                  </td>
                  <td style={{ ...tdBase, fontFamily: "monospace", fontSize: 12 }}>{formatarDataBR(item.UltimaNoPeriodo)}</td>
                </tr>
              ))}
              {itensFiltrados.length === 0 && !carregando && (
                <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#5b6068" }}>Nenhum erro encontrado com esses filtros.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Painel 2: detalhe fixo embaixo (Error Context, estilo SAP) */}
      <div style={{ flex: 1, marginTop: 10, overflow: "auto", background: "#fff", border: "1px solid #c9ccd1", padding: 16 }}>
        {!selecionado ? (
          <p style={{ color: "#5b6068", fontSize: 13 }}>Selecione um erro na tabela acima pra ver o contexto completo.</p>
        ) : (
          <>
            <h3 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>
              Contexto — {selecionado.CodErro}
            </h3>
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20 }}>
              <tbody>
                <LinhaContexto nome="Aplicação" valor={selecionado.Aplicacao} />
                <LinhaContexto nome="Categoria" valor={selecionado.Categoria} />
                <LinhaContexto nome="Tipo de Erro" valor={selecionado.TipoErro} />
                {selecionado.Criticidade && CORES_CRITICIDADE[selecionado.Criticidade] && (
                  <LinhaContexto nome="Criticidade" valor={<Selo texto={selecionado.Criticidade} cor={CORES_CRITICIDADE[selecionado.Criticidade]} />} />
                )}
                <LinhaContexto nome="Status" valor={selecionado.UltimoStatusConhecido} />
                <LinhaContexto
                  nome="Ocorrências no período"
                  valor={
                    <span style={{ fontWeight: 700, color: corPorOcorrencias(selecionado.OcorrenciasNoPeriodo) }}>
                      {selecionado.OcorrenciasNoPeriodo}
                    </span>
                  }
                />
                <LinhaContexto nome="Primeira ocorrência" valor={formatarDataBR(selecionado.PrimeiraNoPeriodo)} />
                <LinhaContexto nome="Última ocorrência" valor={formatarDataBR(selecionado.UltimaNoPeriodo)} />
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
                    nome={formatarDataBR(h.TimestampOcorrencia)}
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


