"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { painel } from "./ui";

type ResumoTarefas = { total: number; comErro: number; nuncaRodou: number };
type ResumoErros = { abertos: number; escalados: number };

function Cartao({ titulo, href, children }: { titulo: string; href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
      <div style={{ ...painel, padding: 18, minHeight: 120, transition: "border-color .15s" }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, color: "#5b21b6" }}>
          {titulo}
        </h3>
        {children}
      </div>
    </Link>
  );
}

export default function VisaoGeral() {
  const [tarefas, setTarefas] = useState<ResumoTarefas | null>(null);
  const [erros, setErros] = useState<ResumoErros | null>(null);
  const [custoTotal, setCustoTotal] = useState<number | null>(null);

  useEffect(() => {
    fetch("/backend-api/api/tarefas")
      .then((r) => r.json())
      .then((data) => {
        const lista = data.tarefas || [];
        setTarefas({
          total: lista.length,
          comErro: lista.filter((t: any) => t.ultima_execucao_status === "erro").length,
          nuncaRodou: lista.filter((t: any) => t.ultima_execucao_status === "nunca_rodou").length,
        });
      })
      .catch(() => setTarefas({ total: 0, comErro: 0, nuncaRodou: 0 }));

    fetch("/backend-api/api/erros")
      .then((r) => r.json())
      .then((data) => {
        const lista = data.itens || [];
        setErros({
          abertos: lista.filter((i: any) => i.UltimoStatusConhecido === "aberto").length,
          escalados: lista.filter((i: any) => i.UltimoStatusConhecido === "escalado").length,
        });
      })
      .catch(() => setErros({ abertos: 0, escalados: 0 }));

    fetch("/backend-api/api/custos")
      .then((r) => r.json())
      .then((data) => setCustoTotal(data.total_usd ?? 0))
      .catch(() => setCustoTotal(0));
  }, []);

  return (
    <main>
      <h1 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 4px" }}>Visão Geral</h1>
      <p style={{ color: "#5b6068", fontSize: 12.5, margin: "0 0 18px" }}>
        Console operacional da equipe de TI do Instituto Tia Pretinha.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
        <Cartao titulo="Catálogo de Erros" href="/erros">
          {erros === null ? (
            <p style={{ color: "#8a8f98", fontSize: 13 }}>Carregando...</p>
          ) : (
            <>
              <p style={{ fontSize: 24, fontWeight: 700, margin: "0 0 2px" }}>{erros.abertos}</p>
              <p style={{ fontSize: 12, color: "#5b6068", margin: 0 }}>aberto(s) — {erros.escalados} escalado(s)</p>
            </>
          )}
        </Cartao>

        <Cartao titulo="Tarefas Agendadas" href="/tarefas">
          {tarefas === null ? (
            <p style={{ color: "#8a8f98", fontSize: 13 }}>Carregando...</p>
          ) : (
            <>
              <p style={{ fontSize: 24, fontWeight: 700, margin: "0 0 2px" }}>{tarefas.total}</p>
              <p style={{ fontSize: 12, color: "#5b6068", margin: 0 }}>
                {tarefas.comErro} com erro na última execução, {tarefas.nuncaRodou} nunca rodaram
              </p>
            </>
          )}
        </Cartao>

        <Cartao titulo="Custos IA (Claude)" href="/custos">
          {custoTotal === null ? (
            <p style={{ color: "#8a8f98", fontSize: 13 }}>Carregando...</p>
          ) : (
            <>
              <p style={{ fontSize: 24, fontWeight: 700, margin: "0 0 2px", fontFamily: "monospace" }}>${custoTotal.toFixed(2)}</p>
              <p style={{ fontSize: 12, color: "#5b6068", margin: 0 }}>uso do Claude CLI nesta VM</p>
            </>
          )}
        </Cartao>
      </div>
    </main>
  );
}
