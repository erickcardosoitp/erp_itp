"use client";

import { useEffect, useState } from "react";
import { CORES_CRITICIDADE, CORES_STATUS, Selo, tabela, th, td, botao, botaoPrimario, input as inputStyle, painel } from "../ui";

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
  ultima_execucao_status: "ok" | "erro" | "nunca_rodou";
  ultima_execucao_ultimo_timestamp: string | null;
  ultima_execucao_resumo: string | null;
};

export default function TarefasPage() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [executando, setExecutando] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [detalhe, setDetalhe] = useState<Tarefa | null>(null);

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

  return (
    <main>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Tarefas Agendadas</h1>
        <button onClick={() => setMostrarForm((v) => !v)} style={botaoPrimario}>
          {mostrarForm ? "Cancelar" : "+ Nova tarefa"}
        </button>
      </div>
      <p style={{ color: "#5b6068", fontSize: 12.5, margin: "2px 0 14px" }}>
        Monitoramento e execução manual das tarefas agendadas do vm-itp-prod.
      </p>

      {mostrarForm && <NovaTarefaForm onCriada={() => { setMostrarForm(false); carregar(); }} />}

      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div style={{ flex: detalhe ? "0 0 62%" : "1 1 auto", border: "1px solid #c9ccd1", overflow: "auto" }}>
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
                  <th style={th}>Criador</th>
                  <th style={th}>Crontab</th>
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
                    <td style={td}><Selo texto={CORES_STATUS[t.ultima_execucao_status].label} cor={CORES_STATUS[t.ultima_execucao_status]} /></td>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{t.nome}</div>
                      <div style={{ color: "#8a8f98", fontSize: 11 }}>{t.id}</div>
                    </td>
                    <td style={td}>{t.aplicacao}</td>
                    <td style={td}><Selo texto={t.criticidade} cor={CORES_CRITICIDADE[t.criticidade]} /></td>
                    <td style={td}>{t.intervalo_legivel}</td>
                    <td style={td}>{t.criador}</td>
                    <td style={td}>{t.presente_no_crontab ? "sim" : "NÃO"}</td>
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
    </main>
  );
}

function DetalheTarefa({ tarefa, onFechar }: { tarefa: Tarefa; onFechar: () => void }) {
  const [log, setLog] = useState<string[] | null>(null);

  useEffect(() => {
    setLog(null);
    fetch(`/backend-api/api/tarefas/${tarefa.id}/log?linhas=150`)
      .then((r) => r.json())
      .then((data) => setLog(data.linhas || []));
  }, [tarefa.id]);

  return (
    <div style={{ ...painel, flex: 1, padding: 14, position: "sticky", top: 60 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, textTransform: "uppercase" }}>{tarefa.nome}</h3>
        <button onClick={onFechar} style={{ ...botao, padding: "2px 8px" }}>✕</button>
      </div>
      <table style={{ width: "100%", fontSize: 12.5, marginBottom: 12 }}>
        <tbody>
          <LinhaDetalhe rotulo="Descrição" valor={tarefa.descricao} />
          <LinhaDetalhe rotulo="Tipo" valor={tarefa.tipo} />
          <LinhaDetalhe rotulo="Comando/Endpoint" valor={<code style={{ fontSize: 11 }}>{tarefa.caminho}</code>} />
          <LinhaDetalhe rotulo="Schedule" valor={<code>{tarefa.schedule}</code>} />
          <LinhaDetalhe rotulo="Permissão mínima" valor={tarefa.permissao_minima} />
          <LinhaDetalhe rotulo="Criado em" valor={tarefa.criado_em} />
          <LinhaDetalhe rotulo="Log" valor={tarefa.log_path || "—"} />
          <LinhaDetalhe rotulo="Último timestamp" valor={tarefa.ultima_execucao_ultimo_timestamp || "—"} />
        </tbody>
      </table>

      <h4 style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: "#5b6068" }}>Log recente</h4>
      <div style={{
        background: "#1a1d21", color: "#d8dbe0", fontFamily: "monospace", fontSize: 11,
        padding: 10, maxHeight: 360, overflow: "auto", whiteSpace: "pre-wrap", borderRadius: 3,
      }}>
        {log === null ? "carregando..." : log.length === 0 ? "(sem log ainda)" : log.join("\n")}
      </div>
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
