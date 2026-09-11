// Estilo compartilhado do ITP_TEC — visual denso/tabular tipo console
// administrativo (bordas solidas, pouco arredondamento, cabecalho solido),
// em vez do estilo "card solto" anterior.
import type { CSSProperties } from "react";

// Paleta baseada na marca do Instituto Tia Pretinha (roxo + amarelo).
export const CORES = {
  fundo: "#f4f5f7",
  painel: "#ffffff",
  borda: "#c9ccd1",
  bordaForte: "#8a8f98",
  texto: "#1a1d21",
  textoSuave: "#5b6068",
  cabecalho: "#e4e6ea",
  destaque: "#5b21b6",
  destaqueTexto: "#ffffff",
  acento: "#f2b705",
};

export const CORES_CRITICIDADE: Record<string, { bg: string; fg: string }> = {
  baixa: { bg: "#dcefdc", fg: "#1e5c1e" },
  media: { bg: "#fbead0", fg: "#8a5a00" },
  alta: { bg: "#fbdccb", fg: "#9a3b00" },
  critica: { bg: "#f6cdd0", fg: "#8f1620" },
};

export const CORES_STATUS: Record<string, { bg: string; fg: string; label: string }> = {
  ok: { bg: "#dcefdc", fg: "#1e5c1e", label: "OK" },
  erro: { bg: "#f6cdd0", fg: "#8f1620", label: "ERRO" },
  nunca_rodou: { bg: "#e4e6ea", fg: "#5b6068", label: "NUNCA RODOU" },
  aberto: { bg: "#fbead0", fg: "#8a5a00", label: "ABERTO" },
  resolvido: { bg: "#dcefdc", fg: "#1e5c1e", label: "RESOLVIDO" },
  escalado: { bg: "#f6cdd0", fg: "#8f1620", label: "ESCALADO" },
  descartado: { bg: "#e4e6ea", fg: "#5b6068", label: "DESCARTADO" },
};

export const painel: CSSProperties = {
  background: CORES.painel,
  border: `1px solid ${CORES.borda}`,
  borderRadius: 3,
};

export const tabela: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
  background: CORES.painel,
};

export const th: CSSProperties = {
  textAlign: "left",
  padding: "7px 10px",
  background: CORES.cabecalho,
  borderBottom: `1px solid ${CORES.bordaForte}`,
  borderTop: `1px solid ${CORES.bordaForte}`,
  fontWeight: 700,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 0.3,
  color: CORES.textoSuave,
  whiteSpace: "nowrap",
};

export const td: CSSProperties = {
  padding: "6px 10px",
  borderBottom: `1px solid ${CORES.borda}`,
  verticalAlign: "top",
};

export const trHover: CSSProperties = {
  cursor: "pointer",
};

export const botao: CSSProperties = {
  padding: "5px 12px",
  borderRadius: 3,
  border: `1px solid ${CORES.bordaForte}`,
  background: "#eceef1",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

export const botaoPrimario: CSSProperties = {
  ...botao,
  background: CORES.destaque,
  color: CORES.destaqueTexto,
  border: `1px solid ${CORES.destaque}`,
};

export const input: CSSProperties = {
  padding: "5px 8px",
  borderRadius: 3,
  border: `1px solid ${CORES.bordaForte}`,
  fontSize: 12.5,
};

export function formatarDataBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function Selo({ texto, cor }: { texto: string; cor: { bg: string; fg: string } }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 3,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.3,
        textTransform: "uppercase",
        background: cor.bg,
        color: cor.fg,
        border: `1px solid ${cor.fg}22`,
      }}
    >
      {texto}
    </span>
  );
}
