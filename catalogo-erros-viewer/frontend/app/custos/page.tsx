"use client";

import { useEffect, useState } from "react";
import { tabela, th, td, painel } from "../ui";

type PorDia = { dia: string; total_usd: number };
type Evento = { dia: string; valor_usd: number; linha: string };

export default function CustosPage() {
  const [totalUsd, setTotalUsd] = useState<number | null>(null);
  const [porDia, setPorDia] = useState<PorDia[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    fetch("/backend-api/api/custos")
      .then((r) => r.json())
      .then((data) => {
        setTotalUsd(data.total_usd ?? 0);
        setPorDia(data.por_dia || []);
        setEventos(data.eventos_recentes || []);
      })
      .finally(() => setCarregando(false));
  }, []);

  return (
    <main>
      <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Custos IA (Claude) — neste servidor</h1>
      <p style={{ color: "#5b6068", fontSize: 12.5, margin: "2px 0 14px" }}>
        Só o uso do Claude Code CLI feito pelo <code>coletor.py</code>/<code>aplicador.py</code> nesta VM
        (vm-itp-prod) — não é o uso total da conta.
      </p>

      {carregando ? (
        <p>Carregando...</p>
      ) : (
        <>
          <div style={{ ...painel, display: "inline-block", padding: "14px 24px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#5b6068", textTransform: "uppercase", letterSpacing: 0.3 }}>
              Total registrado (histórico do log atual)
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "monospace" }}>
              ${totalUsd?.toFixed(4)}
            </div>
          </div>

          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{ flex: "0 0 260px", border: "1px solid #c9ccd1" }}>
              <table style={tabela}>
                <thead>
                  <tr><th style={th}>Dia</th><th style={th}>Total (USD)</th></tr>
                </thead>
                <tbody>
                  {porDia.map((p) => (
                    <tr key={p.dia}>
                      <td style={td}>{p.dia}</td>
                      <td style={{ ...td, fontFamily: "monospace" }}>${p.total_usd.toFixed(4)}</td>
                    </tr>
                  ))}
                  {porDia.length === 0 && (
                    <tr><td colSpan={2} style={{ ...td, textAlign: "center", color: "#8a8f98" }}>Sem dados ainda</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ flex: 1, border: "1px solid #c9ccd1", overflow: "auto" }}>
              <table style={tabela}>
                <thead>
                  <tr><th style={th}>Dia</th><th style={th}>Valor (USD)</th><th style={th}>Linha do log</th></tr>
                </thead>
                <tbody>
                  {eventos.map((e, i) => (
                    <tr key={i}>
                      <td style={td}>{e.dia}</td>
                      <td style={{ ...td, fontFamily: "monospace" }}>${e.valor_usd.toFixed(4)}</td>
                      <td style={{ ...td, fontFamily: "monospace", fontSize: 11, color: "#5b6068" }}>{e.linha}</td>
                    </tr>
                  ))}
                  {eventos.length === 0 && (
                    <tr><td colSpan={3} style={{ ...td, textAlign: "center", color: "#8a8f98" }}>Sem eventos registrados ainda</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <p style={{ color: "#8a8f98", fontSize: 11, marginTop: 14 }}>
            Fonte: parsing dos logs de texto do catálogo de erros (sem persistência estruturada ainda —
            pendência registrada no spec pra gravar isso no Parquet/SharePoint).
          </p>
        </>
      )}
    </main>
  );
}
