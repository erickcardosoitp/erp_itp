"use client";
import React, { useState } from 'react';
import { X, GraduationCap, CheckCircle2, RefreshCw } from 'lucide-react';
import api from '@/services/api';

interface Turma { id: string; nome: string; codigo: string; }
interface Curso { id: string; nome: string; sigla: string; turmas: Turma[]; }

interface Props {
  cursosAcademico: Curso[];
  onClose: () => void;
  onSuccess: () => void;
}

const OPCOES_CUIDADO_ESPECIAL = [
  'Não', 'PCD – Pessoa com Deficiência', 'Transtorno do Espectro Autista (TEA)',
  'TDAH – Déficit de Atenção e Hiperatividade', 'Deficiência Visual', 'Deficiência Auditiva',
  'Deficiência Física / Motora', 'Deficiência Intelectual', 'Altas Habilidades / Superdotação', 'Outro',
];

const GRAU_PARENTESCO = ['Mãe', 'Pai', 'Avó', 'Avô', 'Tia', 'Tio', 'Irmã', 'Irmão', 'Responsável Legal', 'Outro'];

// ── Mascaramento ────────────────────────────────────────────────────────────
function fmtCpf(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
}

function fmtCep(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0,5)}-${d.slice(5)}`;
}

function fmtPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}
// ───────────────────────────────────────────────────────────────────────────

const FORM_VAZIO = {
  nome_completo: '', cpf: '', email: '', celular: '',
  data_nascimento: '', sexo: '', escolaridade: '', turno_escolar: '',
  cep: '', logradouro: '', numero: '', complemento: '',
  bairro: '', cidade: '', estado_uf: '',
  nome_responsavel: '', email_responsavel: '', grau_parentesco: '',
  cpf_responsavel: '', telefone_alternativo: '',
  possui_alergias: 'Não', cuidado_especial: 'Não', detalhes_cuidado: '', uso_medicamento: 'Não',
  lgpd_aceito: false, autoriza_imagem: false,
  turma_ids: [] as string[],
  auto_declaracao: '',
  curso_especial: false,
  rg: '', orgao_expedidor: '', uf_expedicao: '', genero: '',
  banco: '', agencia: '', agencia_digito: '', conta_corrente: '', conta_digito: '', tipo_conta: '',
};

export default function CadastroDiretoModal({ cursosAcademico, onClose, onSuccess }: Props) {
  const [form, setForm] = useState<Record<string, any>>({ ...FORM_VAZIO });
  const [salvando, setSalvando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ numero_matricula: string; nome_completo: string } | null>(null);

  const set = (field: string, value: any) => setForm(p => ({ ...p, [field]: value }));

  const menorDeIdade = form.data_nascimento
    ? (() => {
        const d = new Date(form.data_nascimento + 'T12:00:00');
        if (isNaN(d.getTime())) return false;
        const hoje = new Date();
        let idade = hoje.getFullYear() - d.getFullYear();
        const m = hoje.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) idade--;
        return idade < 18;
      })()
    : false;

  const toggleTurma = (id: string) =>
    setForm(p => ({
      ...p,
      turma_ids: p.turma_ids.includes(id) ? p.turma_ids.filter((t: string) => t !== id) : [...p.turma_ids, id],
    }));

  const buscarCep = async (cep: string) => {
    const limpo = cep.replace(/\D/g, '');
    if (limpo.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      const data = await res.json();
      if (!data.erro)
        setForm(p => ({ ...p, logradouro: data.logradouro || p.logradouro, bairro: data.bairro || p.bairro, cidade: data.localidade || p.cidade, estado_uf: data.uf || p.estado_uf }));
    } catch { /* silencia erro de rede */ }
    finally { setBuscandoCep(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome_completo.trim()) { setErro('Nome completo é obrigatório.'); return; }
    setSalvando(true);
    setErro(null);
    try {
      const t = (v: string) => v?.trim() || undefined;
      const raw = (v: string) => v?.replace(/\D/g, '') || undefined;
      const payload: Record<string, any> = {
        nome_completo: t(form.nome_completo),
        cpf: raw(form.cpf) ? fmtCpf(form.cpf) : undefined,
        data_nascimento: form.data_nascimento || undefined,
        sexo: form.sexo || undefined,
        escolaridade: form.escolaridade || undefined,
        turno_escolar: form.turno_escolar || undefined,
        cep: t(form.cep), logradouro: t(form.logradouro), numero: t(form.numero), complemento: t(form.complemento),
        bairro: t(form.bairro), cidade: t(form.cidade), estado_uf: t(form.estado_uf),
        maior_18_anos: !menorDeIdade,
        possui_alergias: form.possui_alergias || undefined,
        cuidado_especial: form.cuidado_especial || undefined,
        detalhes_cuidado: t(form.detalhes_cuidado),
        uso_medicamento: form.uso_medicamento || undefined,
        lgpd_aceito: form.lgpd_aceito, autoriza_imagem: form.autoriza_imagem,
        turma_ids: form.turma_ids,
      };

      if (menorDeIdade) {
        // Para menor: celular = telefone do responsável, email é do responsável
        payload.celular             = t(form.celular) ? form.celular : undefined;
        payload.email               = t(form.email) || undefined;
        payload.nome_responsavel    = t(form.nome_responsavel);
        payload.email_responsavel   = t(form.email_responsavel);
        payload.grau_parentesco     = t(form.grau_parentesco);
        payload.cpf_responsavel     = raw(form.cpf_responsavel) ? fmtCpf(form.cpf_responsavel) : undefined;
        payload.telefone_alternativo = t(form.telefone_alternativo) ? form.telefone_alternativo : undefined;
      } else {
        payload.email               = t(form.email);
        payload.celular             = t(form.celular) ? form.celular : undefined;
        payload.telefone_alternativo = t(form.telefone_alternativo) ? form.telefone_alternativo : undefined;
        if (form.curso_especial) {
          payload.nome_responsavel  = t(form.nome_responsavel);
          payload.email_responsavel = t(form.email_responsavel);
          payload.grau_parentesco   = t(form.grau_parentesco);
          payload.cpf_responsavel   = raw(form.cpf_responsavel) ? fmtCpf(form.cpf_responsavel) : undefined;
        }
      }

      const r = await api.post('/matriculas/aluno-direto', payload);
      const alunoId = r.data?.id;
      if (alunoId) {
        const campos = ['rg','orgao_expedidor','uf_expedicao','genero','banco','agencia','agencia_digito','conta_corrente','conta_digito','tipo_conta'] as const;
        const comp: Record<string, any> = {};
        campos.forEach(k => { if (form[k]) comp[k] = form[k]; });
        const reqs: Promise<any>[] = [api.patch(`/alunos/${alunoId}/complemento`, comp)];
        if (form.auto_declaracao) reqs.push(api.patch(`/alunos/${alunoId}/auto-declaracao`, { auto_declaracao: form.auto_declaracao }));
        await Promise.allSettled(reqs);
      }
      setResultado(r.data);
      onSuccess();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Erro ao cadastrar.';
      setErro(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setSalvando(false);
    }
  };

  const todasTurmas = cursosAcademico.flatMap(c => (c.turmas ?? []).map(t => ({ ...t, curso_nome: c.nome, curso_sigla: c.sigla })));
  const inp = 'w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400';
  const sel = inp + ' bg-white';
  const inpOrg = 'w-full border border-orange-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400';
  const selOrg = inpOrg + ' bg-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">

        <div className="bg-green-600 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl"><GraduationCap size={20} className="text-white" /></div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-green-100">Matrícula Direta</p>
              <p className="text-sm font-black text-white">Cadastrar Aluno sem Workflow</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">
          {resultado ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} className="text-green-600" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-green-600">Aluno Cadastrado!</p>
              <p className="font-bold text-slate-800 dark:text-white">{resultado.nome_completo}</p>
              <p className="text-[10px] text-slate-500">Número de Matrícula</p>
              <p className="font-mono text-2xl font-black text-green-700 tracking-wider">{resultado.numero_matricula}</p>
              <div className="flex gap-3 justify-center mt-4">
                <button onClick={() => { setResultado(null); setForm({ ...FORM_VAZIO, turma_ids: [] }); setErro(null); }}
                  className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black text-xs uppercase">
                  + Cadastrar Outro
                </button>
                <button onClick={onClose}
                  className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-black text-xs uppercase hover:bg-slate-50">
                  Fechar
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* ── Identificação ─────────────────────────────────────────── */}
              <fieldset className="space-y-3">
                <legend className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Identificação</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Nome Completo *</label>
                    <input required value={form.nome_completo} onChange={e => set('nome_completo', e.target.value)} className={inp} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">CPF</label>
                    <input value={form.cpf} onChange={e => set('cpf', fmtCpf(e.target.value))}
                      placeholder="000.000.000-00" maxLength={14} className={inp} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Data de Nascimento</label>
                    <input type="date" value={form.data_nascimento} onChange={e => set('data_nascimento', e.target.value)} className={inp} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Sexo</label>
                    <select value={form.sexo} onChange={e => set('sexo', e.target.value)} className={sel}>
                      <option value="">Selecione...</option>
                      <option>Masculino</option><option>Feminino</option><option>Outro</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Nível de Escolaridade</label>
                    <select value={form.escolaridade} onChange={e => set('escolaridade', e.target.value)} className={sel}>
                      <option value="">Selecione...</option>
                      <option>Ensino Fundamental Incompleto</option>
                      <option>Ensino Fundamental Completo</option>
                      <option>Ensino Médio Incompleto</option>
                      <option>Ensino Médio Completo</option>
                      <option>Ensino Superior Incompleto</option>
                      <option>Ensino Superior Completo</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Turno Escolar</label>
                    <select value={form.turno_escolar} onChange={e => set('turno_escolar', e.target.value)} className={sel}>
                      <option value="">Selecione...</option>
                      <option>Manhã</option><option>Tarde</option><option>Noite</option><option>Integral</option><option>Não estuda no momento</option>
                    </select>
                  </div>
                </div>
              </fieldset>

              {/* ── Contato ───────────────────────────────────────────────── */}
              <fieldset className="space-y-3">
                <legend className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">
                  Contato {menorDeIdade && <span className="text-orange-400 font-normal normal-case">(aluno menor — telefone fica em Responsável)</span>}
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {!menorDeIdade && (
                    <>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">E-mail</label>
                        <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className={inp} />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Celular</label>
                        <input value={form.celular} onChange={e => set('celular', fmtPhone(e.target.value))} placeholder="(21) 99999-9999" maxLength={15} className={inp} />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Telefone Alternativo</label>
                        <input value={form.telefone_alternativo} onChange={e => set('telefone_alternativo', fmtPhone(e.target.value))} placeholder="(21) 99999-9999" maxLength={15} className={inp} />
                      </div>
                    </>
                  )}
                  {menorDeIdade && (
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">E-mail (opcional)</label>
                      <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className={inp} />
                    </div>
                  )}
                </div>
              </fieldset>

              {/* ── Endereço ──────────────────────────────────────────────── */}
              <fieldset className="space-y-3">
                <legend className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Endereço</legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                      CEP {buscandoCep && <span className="text-green-500 ml-1">buscando...</span>}
                    </label>
                    <input value={form.cep}
                      onChange={e => { const v = fmtCep(e.target.value); set('cep', v); if (v.replace(/\D/g,'').length === 8) buscarCep(v); }}
                      onBlur={e => buscarCep(e.target.value)}
                      placeholder="00000-000" maxLength={9} className={inp} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Logradouro</label>
                    <input value={form.logradouro} onChange={e => set('logradouro', e.target.value)} placeholder="Rua, Avenida..." className={inp} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Número</label>
                    <input value={form.numero} onChange={e => set('numero', e.target.value)} className={inp} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Complemento</label>
                    <input value={form.complemento} onChange={e => set('complemento', e.target.value)} placeholder="Apto, Casa..." className={inp} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Bairro</label>
                    <input value={form.bairro} onChange={e => set('bairro', e.target.value)} className={inp} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Cidade</label>
                    <input value={form.cidade} onChange={e => set('cidade', e.target.value)} className={inp} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Estado (UF)</label>
                    <input value={form.estado_uf} onChange={e => set('estado_uf', e.target.value.toUpperCase().slice(0,2))} placeholder="RJ" maxLength={2} className={inp + ' uppercase'} />
                  </div>
                </div>
              </fieldset>

              {/* ── Responsável ────────────────────────────────────────────── */}
              {(menorDeIdade || form.curso_especial) && (
                <fieldset className="space-y-3 border border-orange-200 rounded-2xl p-4 bg-orange-50">
                  <legend className="text-[9px] font-black uppercase tracking-widest text-orange-500 px-1">
                    {menorDeIdade ? 'Responsável (aluno menor de idade)' : 'Nome da Mãe / Responsável'}
                  </legend>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Nome Completo do Responsável</label>
                      <input value={form.nome_responsavel} onChange={e => set('nome_responsavel', e.target.value)} className={inpOrg} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Grau de Parentesco</label>
                      <select value={form.grau_parentesco} onChange={e => set('grau_parentesco', e.target.value)} className={selOrg}>
                        <option value="">Selecione...</option>
                        {GRAU_PARENTESCO.map(g => <option key={g}>{g}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">CPF do Responsável</label>
                      <input value={form.cpf_responsavel} onChange={e => set('cpf_responsavel', fmtCpf(e.target.value))}
                        placeholder="000.000.000-00" maxLength={14} className={inpOrg} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">E-mail do Responsável</label>
                      <input type="email" value={form.email_responsavel} onChange={e => set('email_responsavel', e.target.value)} className={inpOrg} />
                    </div>
                    {menorDeIdade && (
                      <>
                        <div>
                          <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Telefone do Responsável</label>
                          <input value={form.celular} onChange={e => set('celular', fmtPhone(e.target.value))}
                            placeholder="(21) 99999-9999" maxLength={15} className={inpOrg} />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Telefone Alternativo</label>
                          <input value={form.telefone_alternativo} onChange={e => set('telefone_alternativo', fmtPhone(e.target.value))}
                            placeholder="(21) 99999-9999" maxLength={15} className={inpOrg} />
                        </div>
                      </>
                    )}
                  </div>
                </fieldset>
              )}

              {/* ── Saúde e Cuidados ──────────────────────────────────────── */}
              <fieldset className="space-y-3">
                <legend className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Saúde e Cuidados</legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Possui Alergias?</label>
                    <select value={form.possui_alergias} onChange={e => set('possui_alergias', e.target.value)} className={sel}>
                      <option>Não</option><option>Sim</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Necessidade de Cuidado Especial?</label>
                    <select value={form.cuidado_especial} onChange={e => set('cuidado_especial', e.target.value)} className={sel}>
                      {OPCOES_CUIDADO_ESPECIAL.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Usa Medicamento?</label>
                    <select value={form.uso_medicamento} onChange={e => set('uso_medicamento', e.target.value)} className={sel}>
                      <option>Não</option><option>Sim</option>
                    </select>
                  </div>
                </div>
                {(form.possui_alergias === 'Sim' || (form.cuidado_especial && form.cuidado_especial !== 'Não') || form.uso_medicamento === 'Sim') && (
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Detalhes (alergias, cuidados, medicamentos)</label>
                    <textarea value={form.detalhes_cuidado} onChange={e => set('detalhes_cuidado', e.target.value)}
                      rows={2} placeholder="Descreva alergias, cuidados especiais e medicamentos em uso..."
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none" />
                  </div>
                )}
              </fieldset>

              {/* ── Autodeclaração ─────────────────────────────────────────── */}
              <fieldset className="space-y-2">
                <legend className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Autodeclaração Racial</legend>
                <select value={form.auto_declaracao} onChange={e => set('auto_declaracao', e.target.value)} className={sel}>
                  <option value="">Prefiro não informar</option>
                  <option value="branco">Branco</option><option value="preto">Preto</option>
                  <option value="pardo">Pardo</option><option value="amarelo">Amarelo</option>
                  <option value="indigena">Indígena</option>
                </select>
              </fieldset>

              {/* ── Curso Especial ─────────────────────────────────────────── */}
              <div className={`rounded-2xl border-2 transition-colors ${form.curso_especial ? 'border-purple-400 bg-purple-50' : 'border-slate-200 bg-slate-50'}`}>
                <button type="button" onClick={() => set('curso_especial', !form.curso_especial)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                  <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${form.curso_especial ? 'bg-purple-600 border-purple-600' : 'border-slate-300 bg-white'}`}>
                    {form.curso_especial && <span className="text-white text-[10px] font-black">✓</span>}
                  </span>
                  <div>
                    <p className="text-[11px] font-black uppercase text-slate-700">Curso Especial — Pré-ENCCEJA / Pré-Vestibular</p>
                    <p className="text-[10px] text-slate-400 font-normal normal-case">Solicita documentação adicional: RG, dados bancários</p>
                  </div>
                </button>
                {form.curso_especial && (
                  <div className="px-4 pb-4 space-y-4 border-t border-purple-200 pt-4">
                    <fieldset className="space-y-3">
                      <legend className="text-[9px] font-black uppercase tracking-widest text-purple-500 mb-2">Documentação</legend>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">RG</label>
                          <input value={form.rg} onChange={e => set('rg', e.target.value)} placeholder="0000000" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Órgão Expedidor</label>
                          <input value={form.orgao_expedidor} onChange={e => set('orgao_expedidor', e.target.value)} placeholder="SSP" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">UF Expedição</label>
                          <input value={form.uf_expedicao} onChange={e => set('uf_expedicao', e.target.value.toUpperCase().slice(0,2))} placeholder="RJ" maxLength={2} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 uppercase" />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Gênero (texto livre)</label>
                          <input value={form.genero} onChange={e => set('genero', e.target.value)} placeholder="Ex: feminino, masculino, não-binário..." className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                        </div>
                      </div>
                    </fieldset>
                    <fieldset className="space-y-3">
                      <legend className="text-[9px] font-black uppercase tracking-widest text-purple-500 mb-2">Dados Bancários</legend>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="col-span-2">
                          <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Banco</label>
                          <input value={form.banco} onChange={e => set('banco', e.target.value)} placeholder="Caixa Econômica, Nubank..." className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Tipo de Conta</label>
                          <select value={form.tipo_conta} onChange={e => set('tipo_conta', e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                            <option value="">Selecione...</option>
                            <option value="corrente">Corrente</option><option value="poupanca">Poupança</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Agência</label>
                          <div className="flex gap-1">
                            <input value={form.agencia} onChange={e => set('agencia', e.target.value)} placeholder="0000" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                            <input value={form.agencia_digito} onChange={e => set('agencia_digito', e.target.value)} placeholder="X" maxLength={1} className="w-10 border border-slate-200 rounded-xl px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 text-center" />
                          </div>
                        </div>
                        <div className="col-span-2">
                          <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Conta Corrente</label>
                          <div className="flex gap-1">
                            <input value={form.conta_corrente} onChange={e => set('conta_corrente', e.target.value)} placeholder="000000" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                            <input value={form.conta_digito} onChange={e => set('conta_digito', e.target.value)} placeholder="X" maxLength={1} className="w-10 border border-slate-200 rounded-xl px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 text-center" />
                          </div>
                        </div>
                      </div>
                    </fieldset>
                  </div>
                )}
              </div>

              {/* ── Turmas ─────────────────────────────────────────────────── */}
              {todasTurmas.length > 0 && (
                <fieldset>
                  <legend className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">
                    Turma a Matricular
                    <span className="ml-2 font-normal normal-case text-slate-400">({form.turma_ids.length} selecionada{form.turma_ids.length !== 1 ? 's' : ''})</span>
                  </legend>
                  <div className="grid grid-cols-2 gap-1.5">
                    {todasTurmas.map((t: any) => {
                      const ativo = form.turma_ids.includes(t.id);
                      return (
                        <button key={t.id} type="button" onClick={() => toggleTurma(t.id)}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-[11px] font-bold transition-all ${
                            ativo ? 'bg-green-600 border-green-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-green-400'
                          }`}>
                          <span className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border ${ativo ? 'bg-white border-white' : 'border-slate-300'}`}>
                            {ativo && <span className="text-green-600 text-[10px] font-black">✓</span>}
                          </span>
                          <div className="min-w-0">
                            <span className="truncate block">{t.nome}</span>
                            <span className={`text-[9px] font-normal truncate block ${ativo ? 'text-green-100' : 'text-slate-400'}`}>{t.curso_sigla}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              {/* ── Termos ─────────────────────────────────────────────────── */}
              <fieldset className="space-y-2">
                <legend className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Termos</legend>
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <input type="checkbox" id="lgpd_direto" checked={form.lgpd_aceito} onChange={e => set('lgpd_aceito', e.target.checked)} className="mt-0.5 rounded" />
                  <label htmlFor="lgpd_direto" className="text-[11px] font-bold text-amber-700 cursor-pointer">
                    Confirmo que o aluno autorizou o uso de seus dados conforme a LGPD (Lei 13.709/2018)
                  </label>
                </div>
                <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <input type="checkbox" id="autoriza_imagem_direto" checked={form.autoriza_imagem} onChange={e => set('autoriza_imagem', e.target.checked)} className="mt-0.5 rounded" />
                  <label htmlFor="autoriza_imagem_direto" className="text-[11px] font-bold text-blue-700 cursor-pointer">
                    Autorizo o ITP a utilizar fotos e vídeos do aluno para fins institucionais e redes sociais
                  </label>
                </div>
              </fieldset>

              {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-[11px] font-bold rounded-xl px-4 py-3">⚠ {erro}</div>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-black text-xs uppercase hover:bg-slate-50">
                  Cancelar
                </button>
                <button type="submit" disabled={salvando}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-black text-xs uppercase">
                  {salvando ? <><RefreshCw size={13} className="animate-spin" /> Cadastrando...</> : <><GraduationCap size={13} /> Cadastrar Aluno</>}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
