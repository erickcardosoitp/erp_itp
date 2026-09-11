"use client";

import { useEffect, useState } from "react";
import { CORES_CRITICIDADE, CORES_STATUS, Selo, tabela, th, td, botao, botaoPrimario, input as inputStyle, painel, formatarDataBR } from "../ui";

type Tarefa = {
  id: string;
  nome: string;
  aplicacao: string;
  tipo: string;
  caminho: string;
  schedule: string;
  intervalo_legivel: string;
  criador: string;
  criado_em: string;
  criticidade: string;
  descricao: string;
  executavel_manualmente: boolean;
  permissao_minima: string;
  log_path: string | null;
  presente_no_crontab: boolean;
  proxima_execucao: string | null;
  ultima_execucao_status: "ok" | "erro" | "nunca_rodou";
  ultima_execucao_ultima_execucao: string | null;
  ultima_execucao_duracao_s: number | null;
  ultima_execucao_duracao_media_s: number | null;
  ultima_execucao_exit_code: number | null;
};

const _PADRAO_TS_LOG = /^\[?(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[+-]\d{2}:?\d{2}|Z)?)\]?\s*(.*)$/;

function horaBrasilia(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour12: false });
}

function LogViewer({ linhas }: { linhas: string[] | null }) {
  if (linhas === null) return <p style={{ color: "#8a8f98", fontSize: 12, margin: 0 }}>carregando...</p>;
  if (linhas.length === 0) return <p style={{ color: "#8a8f98", fontSize: 12, margin: 0 }}>(sem log ainda)</p>;

  return (
    <div style={{ background: "#1a1d21", borderRadius: 3, maxHeight: 380, overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, fontFamily: "monospace" }}>
        <tbody>
          {linhas.map((linha, i) => {
            const m = linha.match(_PADRAO_TS_LOG);
            const hora = m ? horaBrasilia(m[1]) : null;
            const texto = m ? m[2] : linha;
            const ehSeparador = linha.startsWith("===");
            return (
              <tr key={i} style={{ borderTop: i > 0 ? "1px solid #2a2e35" : undefined }}>
                <td style={{
                  padding: "3px 8px", color: "#7dd3fc", whiteSpace: "nowrap",
                  verticalAlign: "top", width: 60, opacity: hora ? 1 : 0.3,
                }}>
                  {hora || "·"}
                </td>
                <td style={{
                  padding: "3px 8px", color: ehSeparador ? "#f2b705" : "#d8dbe0",
                  fontWeight: ehSeparador ? 700 : 400, whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>
                  {texto}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatarDuracao(s: number | null): string {
  if (s === null || s === undefined) return "—";
  if (s < 60) return `${s.toFixed(1)}s`;
  const min = Math.floor(s / 60);
  const seg = Math.round(s % 60);
  return `${min}m${seg.toString().padStart(2, "0")}s`;
}

export default function TarefasPage() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [executando, setExecutando] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [detalhe, setDetalhe] = useState<Tarefa | null>(null);
  const [erroPopup, setErroPopup] = useState<Tarefa | null>(null);

  const carregar = () => {
    setCarregando(true);
    fetch("/backend-api/api/tarefas")
      .then((r) => r.json())
      .then((data) => setTarefas(data.tarefas || []))
      .finally(() => setCarregando(false));
  };

  useEffect(carregar, []);

  const executar = async (id: string, ev: React.MouseEvent) => {
    ev.stopPropagation();
    if (!confirm(`Rodar a tarefa "${id}" agora, manualmente?`)) return;
    setExecutando(id);
    try {
      await fetch(`/backend-api/api/tarefas/${id}/executar`, { method: "POST" });
    } finally {
      setExecutando(null);
      carregar();
    }
  };

  const mudarCriticidade = async (id: string, criticidade: string, ev: React.SyntheticEvent) => {
    ev.stopPropagation();
    await fetch(`/backend-api/api/tarefas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ criticidade }),
    });
    carregar();
  };

  return (
    <main>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Tarefas Agendadas</h1>
        <button onClick={() => setMostrarForm((v) => !v)} style={botaoPrimario}>
          {mostrarForm ? "Cancelar" : "+ Nova tarefa"}
        </button>
      </div>
      <p style={{ color: "#5b6068", fontSize: 12.5, margin: "2px 0 14px" }}>
        Monitoramento e execução manual das tarefas agendadas do vm-itp-prod. Clique numa linha pra ver o log completo;
        clique em ERRO pra ver o que quebrou.
      </p>

      {mostrarForm && <NovaTarefaForm onCriada={() => { setMostrarForm(false); carregar(); }} />}

      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div style={{ flex: detalhe ? "0 0 58%" : "1 1 auto", border: "1px solid #c9ccd1", overflow: "auto" }}>
          {carregando ? (
            <p style={{ padding: 16 }}>Carregando...</p>
          ) : (
            <table style={tabela}>
              <thead>
                <tr>
                  <th style={th}>Status</th>
                  <th style={th}>Tarefa</th>
                  <th style={th}>Aplicação</th>
                  <th style={th}>Criticidade</th>
                  <th style={th}>Intervalo</th>
                  <th style={th}>Última execução</th>
                  <th style={th}>Próxima agendada</th>
                  <th style={th}>Duração média</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {tarefas.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setDetalhe(t)}
                    style={{ cursor: "pointer", background: detalhe?.id === t.id ? "#ede4fb" : undefined }}
                  >
                    <td style={td}>
                      <span onClick={(e) => { if (t.ultima_execucao_status === "erro") { e.stopPropagation(); setErroPopup(t); } }}>
                        <Selo texto={CORES_STATUS[t.ultima_execucao_status].label} cor={CORES_STATUS[t.ultima_execucao_status]} />
                      </span>
                    </td>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{t.nome}</div>
                      <div style={{ color: "#8a8f98", fontSize: 11 }}>{t.id}</div>
                    </td>
                    <td style={td}>{t.aplicacao}</td>
                    <td style={td} onClick={(e) => e.stopPropagation()}>
                      <select
                        value={t.criticidade}
                        onChange={(e) => mudarCriticidade(t.id, e.target.value, e)}
                        style={{ ...inputStyle, padding: "2px 4px", fontSize: 11 }}
                      >
                        <option value="baixa">baixa</option>
                        <option value="media">media</option>
                        <option value="alta">alta</option>
                        <option value="critica">critica</option>
                      </select>
                    </td>
                    <td style={td}>{t.intervalo_legivel}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>
                      {formatarDataBR(t.ultima_execucao_ultima_execucao)}
                    </td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>
                      {formatarDataBR(t.proxima_execucao)}
                    </td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>
                      {formatarDuracao(t.ultima_execucao_duracao_media_s)}
                    </td>
                    <td style={td}>
                      {t.executavel_manualmente && (
                        <button onClick={(e) => executar(t.id, e)} disabled={executando === t.id} style={{ ...botao, opacity: executando === t.id ? 0.6 : 1 }}>
                          {executando === t.id ? "Rodando..." : "▶ Rodar"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {detalhe && <DetalheTarefa tarefa={detalhe} onFechar={() => setDetalhe(null)} />}
      </div>

      {erroPopup && <PopupErro tarefa={erroPopup} onFechar={() => setErroPopup(null)} />}
    </main>
  );
}

function PopupErro({ tarefa, onFechar }: { tarefa: Tarefa; onFechar: () => void }) {
  const [log, setLog] = useState<string[] | null>(null);

  useEffect(() => {
    fetch(`/backend-api/api/tarefas/${tarefa.id}/log?linhas=80`)
      .then((r) => r.json())
      .then((data) => setLog(data.linhas || []));
  }, [tarefa.id]);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
    }} onClick={onFechar}>
      <div style={{ ...painel, width: "min(720px, 90vw)", maxHeight: "80vh", padding: 18, overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#8f1620" }}>
            Erro — {tarefa.nome} (exit code {tarefa.ultima_execucao_exit_code})
          </h3>
          <button onClick={onFechar} style={{ ...botao, padding: "2px 8px" }}>✕</button>
        </div>
        <p style={{ fontSize: 12, color: "#5b6068", marginTop: 0 }}>
          Última execução: {formatarDataBR(tarefa.ultima_execucao_ultima_execucao)} · duração {formatarDuracao(tarefa.ultima_execucao_duracao_s)}
        </p>
        <LogViewer linhas={log} />
      </div>
    </div>
  );
}

function DetalheTarefa({ tarefa, onFechar }: { tarefa: Tarefa; onFechar: () => void }) {
  const [log, setLog] = useState<string[] | null>(null);
  const [analise, setAnalise] = useState<string | null>(null);
  const [analisando, setAnalisando] = useState(false);

  useEffect(() => {
    setLog(null);
    setAnalise(null);
    fetch(`/backend-api/api/tarefas/${tarefa.id}/log?linhas=150`)
      .then((r) => r.json())
      .then((data) => setLog(data.linhas || []));
  }, [tarefa.id]);

  const pedirAnalise = async () => {
    setAnalisando(true);
    try {
      const r = await fetch(`/backend-api/api/tarefas/${tarefa.id}/analise-ia`, { method: "POST" });
      const data = await r.json();
      setAnalise(data.analise || data.detail || "sem resposta");
    } catch (e) {
      setAnalise(String(e));
    } finally {
      setAnalisando(false);
    }
  };

  return (
    <div style={{ ...painel, flex: 1, padding: 14, position: "sticky", top: 60 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h3 style={{ margin: "0 0 3px", fontSize: 13, fontWeight: 700, textTransform: "uppercase" }}>{tarefa.nome}</h3>
          <p style={{ margin: 0, fontSize: 11.5, color: "#8a8f98" }}>{tarefa.id}</p>
        </div>
        <button onClick={onFechar} style={{ ...botao, padding: "2px 8px" }}>✕</button>
      </div>
      <p style={{ fontSize: 12.5, color: "#5b6068", margin: "8px 0 12px" }}>{tarefa.descricao}</p>

      {/* Tira de metricas-chave, escaneavel de relance */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
        <Metrica rotulo="Status" valor={<Selo texto={CORES_STATUS[tarefa.ultima_execucao_status].label} cor={CORES_STATUS[tarefa.ultima_execucao_status]} />} />
        <Metrica rotulo="Última execução" valor={formatarDataBR(tarefa.ultima_execucao_ultima_execucao)} pequeno />
        <Metrica rotulo="Próxima agendada" valor={formatarDataBR(tarefa.proxima_execucao)} pequeno />
        <Metrica rotulo="Duração (média)" valor={`${formatarDuracao(tarefa.ultima_execucao_duracao_s)} / ${formatarDuracao(tarefa.ultima_execucao_duracao_media_s)}`} pequeno />
      </div>

      <table style={{ width: "100%", fontSize: 12.5, marginBottom: 12 }}>
        <tbody>
          <LinhaDetalhe rotulo="Tipo" valor={tarefa.tipo} />
          <LinhaDetalhe rotulo="Comando/Endpoint" valor={<code style={{ fontSize: 11 }}>{tarefa.caminho}</code>} />
          <LinhaDetalhe rotulo="Schedule (cron)" valor={<code>{tarefa.schedule}</code>} />
          <LinhaDetalhe rotulo="Permissão mínima" valor={tarefa.permissao_minima} />
          <LinhaDetalhe rotulo="Criado em" valor={tarefa.criado_em} />
          <LinhaDetalhe rotulo="Arquivo de log" valor={<code style={{ fontSize: 11 }}>{tarefa.log_path}</code>} />
        </tbody>
      </table>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <h4 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#5b6068" }}>Análise IA</h4>
        <button onClick={pedirAnalise} disabled={analisando} style={{ ...botao, fontSize: 11, opacity: analisando ? 0.6 : 1 }}>
          {analisando ? "Analisando..." : "🤖 Analisar com IA"}
        </button>
      </div>
      {analise && (
        <p style={{ fontSize: 12.5, background: "#f4f0fb", border: "1px solid #d8c8f0", borderRadius: 3, padding: 8, marginTop: 0 }}>
          {analise}
        </p>
      )}

      <h4 style={{ margin: "10px 0 6px", fontSize: 12, fontWeight: 700, color: "#5b6068" }}>Log recente</h4>
      <LogViewer linhas={log} />
    </div>
  );
}

function Metrica({ rotulo, valor, pequeno }: { rotulo: string; valor: React.ReactNode; pequeno?: boolean }) {
  return (
    <div style={{ background: "#f4f5f7", border: "1px solid #e4e6ea", borderRadius: 3, padding: "6px 8px" }}>
      <div style={{ fontSize: 10, color: "#8a8f98", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 3 }}>{rotulo}</div>
      <div style={{ fontSize: pequeno ? 11 : 13, fontWeight: pequeno ? 500 : 700, fontFamily: pequeno ? "monospace" : undefined }}>{valor}</div>
    </div>
  );
}

function LinhaDetalhe({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <tr style={{ borderTop: "1px solid #e4e6ea" }}>
      <td style={{ padding: "5px 6px", color: "#5b6068", width: 150, verticalAlign: "top" }}>{rotulo}</td>
      <td style={{ padding: "5px 6px", wordBreak: "break-word" }}>{valor}</td>
    </tr>
  );
}

function NovaTarefaForm({ onCriada }: { onCriada: () => void }) {
  const [tipo, setTipo] = useState<"script" | "http">("script");
  const [form, setForm] = useState({
    id: "", nome: "", aplicacao: "ITP", schedule: "", intervalo_legivel: "",
    criticidade: "baixa", descricao: "", criador: "", permissao_minima: "tec",
    conteudo_script: "#!/bin/bash\n", endpoint_http: "",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const campo = (k: keyof typeof form) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value })),
  });

  const enviar = async () => {
    setErro(null);
    setEnviando(true);
    try {
      const r = await fetch("/backend-api/api/tarefas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, tipo }),
      });
      const data = await r.json();
      if (!r.ok) {
        setErro(data.detail || "erro ao criar tarefa");
        return;
      }
      onCriada();
    } catch (e) {
      setErro(String(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div style={{ ...painel, padding: 16, marginBottom: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label>ID (slug) <input placeholder="minha-tarefa" style={{ ...inputStyle, width: "100%" }} {...campo("id")} /></label>
        <label>Nome <input style={{ ...inputStyle, width: "100%" }} {...campo("nome")} /></label>
        <label>Aplicação <input style={{ ...inputStyle, width: "100%" }} {...campo("aplicacao")} /></label>
        <label>Criador <input style={{ ...inputStyle, width: "100%" }} {...campo("criador")} /></label>
        <label>Schedule (cron) <input placeholder="0 */6 * * *" style={{ ...inputStyle, width: "100%" }} {...campo("schedule")} /></label>
        <label>Intervalo legível <input placeholder="a cada 6 horas" style={{ ...inputStyle, width: "100%" }} {...campo("intervalo_legivel")} /></label>
        <label>
          Criticidade
          <select style={{ ...inputStyle, width: "100%" }} {...campo("criticidade")}>
            <option value="baixa">baixa</option>
            <option value="media">media</option>
            <option value="alta">alta</option>
            <option value="critica">critica</option>
          </select>
        </label>
        <label>
          Permissão mínima p/ rodar manualmente
          <select style={{ ...inputStyle, width: "100%" }} {...campo("permissao_minima")}>
            <option value="tec">tec</option>
            <option value="admin">admin</option>
          </select>
        </label>
        <label style={{ gridColumn: "span 2" }}>
          Descrição <input style={{ ...inputStyle, width: "100%" }} {...campo("descricao")} />
        </label>
        <label>
          Tipo
          <select style={{ ...inputStyle, width: "100%" }} value={tipo} onChange={(e) => setTipo(e.target.value as "script" | "http")}>
            <option value="script">script (bash)</option>
            <option value="http">http (endpoint existente)</option>
          </select>
        </label>
      </div>

      {tipo === "script" ? (
        <label style={{ display: "block", marginTop: 10 }}>
          Conteúdo do script (.sh)
          <textarea style={{ ...inputStyle, width: "100%", height: 160, fontFamily: "monospace", marginTop: 4 }} {...campo("conteudo_script")} />
        </label>
      ) : (
        <label style={{ display: "block", marginTop: 10 }}>
          URL do endpoint
          <input style={{ ...inputStyle, width: "100%", marginTop: 4 }} placeholder="http://localhost:3001/api/..." {...campo("endpoint_http")} />
        </label>
      )}

      {erro && <p style={{ color: "#8f1620", fontSize: 13 }}>{erro}</p>}

      <button onClick={enviar} disabled={enviando || !form.id || !form.nome || !form.schedule} style={{ ...botaoPrimario, marginTop: 12, opacity: enviando ? 0.6 : 1 }}>
        {enviando ? "Criando..." : "Criar tarefa"}
      </button>
    </div>
  );
}
