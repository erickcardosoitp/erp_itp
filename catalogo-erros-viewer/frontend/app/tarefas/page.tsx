"use client";

import { useEffect, useState } from "react";

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
  ultima_execucao_log: string | null;
};

const CORES_CRITICIDADE: Record<string, string> = {
  baixa: "#16a34a",
  media: "#ca8a04",
  alta: "#ea580c",
  critica: "#dc2626",
};

const selectStyle: React.CSSProperties = {
  padding: "6px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13,
};

function Pill({ texto, cor }: { texto: string; cor?: string }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 999,
      fontSize: 12, fontWeight: 600, color: cor ? "#fff" : "#334155",
      background: cor || "#e2e8f0",
    }}>
      {texto}
    </span>
  );
}

export default function TarefasPage() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [executando, setExecutando] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ id: string; texto: string } | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);

  const carregar = () => {
    setCarregando(true);
    fetch("/backend-api/api/tarefas")
      .then((r) => r.json())
      .then((data) => setTarefas(data.tarefas || []))
      .finally(() => setCarregando(false));
  };

  useEffect(carregar, []);

  const executar = async (id: string) => {
    if (!confirm(`Rodar a tarefa "${id}" agora, manualmente?`)) return;
    setExecutando(id);
    setResultado(null);
    try {
      const r = await fetch(`/backend-api/api/tarefas/${id}/executar`, { method: "POST" });
      const data = await r.json();
      setResultado({
        id,
        texto: data.ok
          ? `OK (exit ${data.returncode})\n${data.stdout || "(sem saida)"}`
          : `FALHOU (exit ${data.returncode})\n${data.stderr || data.stdout || "(sem saida)"}`,
      });
    } catch (e) {
      setResultado({ id, texto: String(e) });
    } finally {
      setExecutando(null);
      carregar();
    }
  };

  return (
    <main style={{ padding: "20px 24px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>ITP_TEC — Tarefas Agendadas</h1>
        <button
          onClick={() => setMostrarForm((v) => !v)}
          style={{ ...selectStyle, background: "#1e293b", color: "#fff", fontWeight: 600, border: "none", cursor: "pointer" }}
        >
          {mostrarForm ? "Cancelar" : "+ Nova tarefa"}
        </button>
      </div>
      <p style={{ color: "#64748b", fontSize: 13, margin: "2px 0 16px" }}>
        Monitoramento e execução manual das tarefas agendadas do vm-itp-prod.
      </p>

      {mostrarForm && <NovaTarefaForm onCriada={() => { setMostrarForm(false); carregar(); }} />}

      {carregando ? (
        <p>Carregando...</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #e2e8f0", color: "#64748b" }}>
              <th style={{ padding: 8 }}>Tarefa</th>
              <th style={{ padding: 8 }}>Aplicação</th>
              <th style={{ padding: 8 }}>Criticidade</th>
              <th style={{ padding: 8 }}>Intervalo</th>
              <th style={{ padding: 8 }}>Criador</th>
              <th style={{ padding: 8 }}>No crontab?</th>
              <th style={{ padding: 8 }}>Última execução (log)</th>
              <th style={{ padding: 8 }}></th>
            </tr>
          </thead>
          <tbody>
            {tarefas.map((t) => (
              <tr key={t.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: 8 }}>
                  <div style={{ fontWeight: 600 }}>{t.nome}</div>
                  <div style={{ color: "#94a3b8", fontSize: 11 }}>{t.descricao}</div>
                </td>
                <td style={{ padding: 8 }}>{t.aplicacao}</td>
                <td style={{ padding: 8 }}><Pill texto={t.criticidade} cor={CORES_CRITICIDADE[t.criticidade]} /></td>
                <td style={{ padding: 8 }}>{t.intervalo_legivel}</td>
                <td style={{ padding: 8 }}>{t.criador}</td>
                <td style={{ padding: 8 }}>{t.presente_no_crontab ? "✅" : "⚠️ não"}</td>
                <td style={{ padding: 8, fontFamily: "monospace", fontSize: 11, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.ultima_execucao_log || "—"}
                </td>
                <td style={{ padding: 8 }}>
                  {t.executavel_manualmente && (
                    <button
                      onClick={() => executar(t.id)}
                      disabled={executando === t.id}
                      style={{ ...selectStyle, cursor: "pointer", opacity: executando === t.id ? 0.6 : 1 }}
                    >
                      {executando === t.id ? "Rodando..." : "▶ Rodar agora"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {resultado && (
        <div style={{ marginTop: 16, padding: 12, background: "#0f172a", color: "#e2e8f0", borderRadius: 8, fontFamily: "monospace", fontSize: 12, whiteSpace: "pre-wrap" }}>
          <strong>{resultado.id}:</strong>{"\n"}{resultado.texto}
        </div>
      )}
    </main>
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
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, marginBottom: 20, background: "#f8fafc" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label>ID (slug) <input placeholder="minha-tarefa" style={{ ...selectStyle, width: "100%" }} {...campo("id")} /></label>
        <label>Nome <input style={{ ...selectStyle, width: "100%" }} {...campo("nome")} /></label>
        <label>Aplicação <input style={{ ...selectStyle, width: "100%" }} {...campo("aplicacao")} /></label>
        <label>Criador <input style={{ ...selectStyle, width: "100%" }} {...campo("criador")} /></label>
        <label>Schedule (cron) <input placeholder="0 */6 * * *" style={{ ...selectStyle, width: "100%" }} {...campo("schedule")} /></label>
        <label>Intervalo legível <input placeholder="a cada 6 horas" style={{ ...selectStyle, width: "100%" }} {...campo("intervalo_legivel")} /></label>
        <label>
          Criticidade
          <select style={{ ...selectStyle, width: "100%" }} {...campo("criticidade")}>
            <option value="baixa">baixa</option>
            <option value="media">media</option>
            <option value="alta">alta</option>
            <option value="critica">critica</option>
          </select>
        </label>
        <label>
          Permissão mínima p/ rodar manualmente
          <select style={{ ...selectStyle, width: "100%" }} {...campo("permissao_minima")}>
            <option value="tec">tec</option>
            <option value="admin">admin</option>
          </select>
        </label>
        <label style={{ gridColumn: "span 2" }}>
          Descrição <input style={{ ...selectStyle, width: "100%" }} {...campo("descricao")} />
        </label>
        <label>
          Tipo
          <select style={{ ...selectStyle, width: "100%" }} value={tipo} onChange={(e) => setTipo(e.target.value as "script" | "http")}>
            <option value="script">script (bash)</option>
            <option value="http">http (endpoint existente)</option>
          </select>
        </label>
      </div>

      {tipo === "script" ? (
        <label style={{ display: "block", marginTop: 10 }}>
          Conteúdo do script (.sh)
          <textarea
            style={{ ...selectStyle, width: "100%", height: 160, fontFamily: "monospace", marginTop: 4 }}
            {...campo("conteudo_script")}
          />
        </label>
      ) : (
        <label style={{ display: "block", marginTop: 10 }}>
          URL do endpoint
          <input style={{ ...selectStyle, width: "100%", marginTop: 4 }} placeholder="http://localhost:3001/api/..." {...campo("endpoint_http")} />
        </label>
      )}

      {erro && <p style={{ color: "#dc2626", fontSize: 13 }}>{erro}</p>}

      <button
        onClick={enviar}
        disabled={enviando || !form.id || !form.nome || !form.schedule}
        style={{ ...selectStyle, marginTop: 12, background: "#1e293b", color: "#fff", fontWeight: 600, border: "none", cursor: "pointer", opacity: enviando ? 0.6 : 1 }}
      >
        {enviando ? "Criando..." : "Criar tarefa"}
      </button>
    </div>
  );
}
