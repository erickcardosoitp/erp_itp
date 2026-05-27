'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, X, Edit3, Trash2, ShieldCheck, AlertTriangle, Star, Heart,
} from 'lucide-react';
import api from '@/services/api';
import { toast } from 'sonner';
import { calcularIdade } from './_shared';
import type { Aluno } from './_types';

// ─── Local interfaces ─────────────────────────────────────────────────────────

interface ControleFutebol {
  id: string;
  aluno_id: string;
  aluno_nome?: string;
  aluno_data_nascimento?: string;
  aluno_celular?: string;
  responsavel_nome?: string;
  responsavel_telefone?: string;
  turma_nome?: string;
  turma_id?: string;
  tamanho_camisa?: string;
  tamanho_short?: string;
  numero_chuteira?: string;
  estoque_uniforme_id?: string;
  estoque_chuteira_id?: string;
  uniforme_recebido: boolean;
  chuteira_recebida: boolean;
  status: string;
  observacoes?: string;
  docs_ok?: boolean;
  docs_total_obrig?: number;
  docs_enviados?: number;
  lgpd_aceito?: boolean;
  uniforme_nome?: string;
  chuteira_nome?: string;
}

interface EstoqueProduto { id: string; nome: string; categoria?: string; quantidade_atual: number; }

interface ControleBallet {
  id: string; aluno_id: string; aluno_nome?: string; aluno_data_nascimento?: string;
  aluno_celular?: string; responsavel_nome?: string; responsavel_telefone?: string; turma_nome?: string;
  tamanho_roupa?: string; numero_sapatilha?: string; tamanho_meia?: string;
  estoque_roupa_id?: string; estoque_sapatilha_id?: string;
  roupa_encomendada: boolean; sapatilha_encomendada: boolean;
  roupa_entregue: boolean; sapatilha_entregue: boolean;
  status: string; observacoes?: string;
  roupa_nome?: string; sapatilha_nome?: string;
  itens_pendentes?: string;
  valor_total?: number; valor_entrada?: number; data_entrada?: string;
  forma_pagamento?: string; num_parcelas?: number; valor_parcela?: number;
  venc_1?: string; venc_2?: string; venc_3?: string;
  status_pagamento?: string;
  movimentacao_ids?: string[];
}

// ─── Local constants ──────────────────────────────────────────────────────────

const STATUS_FUTEBOL = ['Pendente', 'Separado', 'Enviado', 'Entregue'];
const STATUS_COLORS: Record<string, string> = {
  Pendente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  Separado: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  Enviado:  'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  Entregue: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

const STATUS_BALLET = ['Pendente', 'Encomendado', 'Separado', 'Entregue'];
const STATUS_BALLET_COLORS: Record<string, string> = {
  Pendente:    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  Encomendado: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  Separado:    'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  Entregue:    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

// ─── ControlesTab ─────────────────────────────────────────────────────────────

export default function ControlesTab({ podeEditar }: { podeEditar: boolean }) {
  const [subTab, setSubTab] = useState<'futebol' | 'ballet'>('futebol');

  // ── Futebol state ──
  const [controles, setControles] = useState<ControleFutebol[]>([]);
  const [estoqueProdutos, setEstoqueProdutos] = useState<EstoqueProduto[]>([]);
  const [alunos, setAlunosCtrl] = useState<Aluno[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [modal, setModal] = useState<{ aberto: boolean; item: ControleFutebol | null }>({ aberto: false, item: null });
  const [form, setForm] = useState<Partial<ControleFutebol>>({});
  const [salvando, setSalvando] = useState<string | null>(null);

  // ── Ballet state ──
  const [controlesBallet, setControlesBallet] = useState<ControleBallet[]>([]);
  const [loadingBallet, setLoadingBallet] = useState(true);
  const [buscaBallet, setBuscaBallet] = useState('');
  const [filtroStatusBallet, setFiltroStatusBallet] = useState('');
  const [modalBallet, setModalBallet] = useState<{ aberto: boolean; item: ControleBallet | null }>({ aberto: false, item: null });
  const [formBallet, setFormBallet] = useState<Partial<ControleBallet>>({});
  const [salvandoBallet, setSalvandoBallet] = useState<string | null>(null);
  const [alunosBallet, setAlunosBallet] = useState<Aluno[]>([]);
  const [formPagamentoBallet, setFormPagamentoBallet] = useState<{ tipo: string; valor: string; data: string; forma_pagamento: string }>({ tipo: 'entrada', valor: '', data: '', forma_pagamento: 'PIX' });
  const [mostrarFormPagamento, setMostrarFormPagamento] = useState(false);
  const [salvandoPagamento, setSalvandoPagamento] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const [rc, re, ra] = await Promise.allSettled([
      api.get('/academico/controle-futebol'),
      api.get('/academico/estoque-produtos'),
      api.get('/academico/alunos'),
    ]);
    if (rc.status === 'fulfilled') setControles(Array.isArray(rc.value.data) ? rc.value.data : []);
    else toast.error('Erro ao carregar controles: ' + (rc.reason?.response?.data?.message || rc.reason?.message || 'Erro desconhecido'));
    if (re.status === 'fulfilled') setEstoqueProdutos(Array.isArray(re.value.data) ? re.value.data : []);
    if (ra.status === 'fulfilled') {
      const todos = Array.isArray(ra.value.data) ? ra.value.data : [];
      const futebolistas = todos.filter((a: any) =>
        Array.isArray(a.turmas) && a.turmas.some((t: any) => t.nome?.toLowerCase().includes('futebol'))
      );
      setAlunosCtrl(futebolistas.length > 0 ? futebolistas : todos);
      const bailarinas = todos.filter((a: any) =>
        Array.isArray(a.turmas) && a.turmas.some((t: any) => t.nome?.toLowerCase().includes('ballet') || t.nome?.toLowerCase().includes('balé') || t.nome?.toLowerCase().includes('dança'))
      );
      setAlunosBallet(bailarinas.length > 0 ? bailarinas : todos);
    } else {
      toast.error('Erro ao carregar alunos: ' + (ra.reason?.response?.data?.message || ra.reason?.message || 'Erro desconhecido'));
    }
    setLoading(false);
  }, []);

  const carregarBallet = useCallback(async () => {
    setLoadingBallet(true);
    try {
      const r = await api.get('/academico/controle-ballet');
      setControlesBallet(Array.isArray(r.data) ? r.data : []);
    } catch (e: any) {
      toast.error('Erro ao carregar ballet: ' + (e?.response?.data?.message || e?.message || 'Erro'));
    }
    setLoadingBallet(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { carregarBallet(); }, [carregarBallet]);

  // ── Futebol funcs ──
  const filtrados = controles.filter(c => {
    const q = busca.toLowerCase();
    const matchBusca = !q || (c.aluno_nome ?? '').toLowerCase().includes(q) || (c.responsavel_nome ?? '').toLowerCase().includes(q);
    const matchStatus = !filtroStatus || c.status === filtroStatus;
    return matchBusca && matchStatus;
  });

  const abrirCriar = () => { setForm({}); setModal({ aberto: true, item: null }); };
  const abrirEditar = (c: ControleFutebol) => { setForm({ ...c }); setModal({ aberto: true, item: c }); };

  const salvar = async () => {
    if (!form.aluno_id && !modal.item) { toast.error('Selecione um aluno.'); return; }
    setSalvando('form');
    try {
      if (modal.item) {
        await api.patch(`/academico/controle-futebol/${modal.item.id}`, form);
      } else {
        await api.post('/academico/controle-futebol', form);
      }
      setModal({ aberto: false, item: null });
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Erro ao salvar.');
    }
    setSalvando(null);
  };

  const deletar = async (id: string) => {
    if (!confirm('Remover este controle?')) return;
    await api.delete(`/academico/controle-futebol/${id}`);
    carregar();
  };

  const removerDaTurma = async (c: ControleFutebol) => {
    if (!c.turma_id || !c.aluno_id) return;
    if (!confirm(`Remover ${c.aluno_nome} da turma ${c.turma_nome}?`)) return;
    try {
      await api.patch(`/academico/turma-alunos/remover`, { aluno_id: c.aluno_id, turma_id: c.turma_id });
      toast.success('Aluno removido da turma.');
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao remover da turma.');
    }
  };

  const toggleField = async (c: ControleFutebol, field: 'uniforme_recebido' | 'chuteira_recebida') => {
    if (!podeEditar) return;
    const novoval = !c[field];
    setSalvando(c.id + field);
    try {
      await api.patch(`/academico/controle-futebol/${c.id}`, {
        [field]: novoval,
        estoque_uniforme_id: c.estoque_uniforme_id,
        estoque_chuteira_id: c.estoque_chuteira_id,
      });
      carregar();
    } catch {}
    setSalvando(null);
  };

  const mudarStatus = async (c: ControleFutebol, novoStatus: string) => {
    if (!podeEditar) return;
    setSalvando(c.id + 'status');
    try {
      await api.patch(`/academico/controle-futebol/${c.id}`, { status: novoStatus });
      setControles(prev => prev.map(x => x.id === c.id ? { ...x, status: novoStatus } : x));
    } catch {}
    setSalvando(null);
  };

  // ── Ballet funcs ──
  const filtradosBallet = controlesBallet.filter(c => {
    const q = buscaBallet.toLowerCase();
    const matchBusca = !q || (c.aluno_nome ?? '').toLowerCase().includes(q) || (c.responsavel_nome ?? '').toLowerCase().includes(q);
    const matchStatus = !filtroStatusBallet || c.status === filtroStatusBallet;
    return matchBusca && matchStatus;
  });

  const abrirCriarBallet = () => { setFormBallet({}); setModalBallet({ aberto: true, item: null }); setMostrarFormPagamento(false); setFormPagamentoBallet({ tipo: 'entrada', valor: '', data: '', forma_pagamento: 'PIX' }); };
  const abrirEditarBallet = (c: ControleBallet) => { setFormBallet({ ...c }); setModalBallet({ aberto: true, item: c }); setMostrarFormPagamento(false); setFormPagamentoBallet({ tipo: 'entrada', valor: '', data: '', forma_pagamento: 'PIX' }); };

  const salvarBallet = async () => {
    if (!formBallet.aluno_id && !modalBallet.item) { toast.error('Selecione um aluno.'); return; }
    setSalvandoBallet('form');
    try {
      if (modalBallet.item) {
        await api.patch(`/academico/controle-ballet/${modalBallet.item.id}`, formBallet);
      } else {
        await api.post('/academico/controle-ballet', formBallet);
      }
      setModalBallet({ aberto: false, item: null });
      carregarBallet();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Erro ao salvar.');
    }
    setSalvandoBallet(null);
  };

  const deletarBallet = async (id: string) => {
    if (!confirm('Remover este controle?')) return;
    await api.delete(`/academico/controle-ballet/${id}`);
    carregarBallet();
  };

  const toggleBallet = async (c: ControleBallet, field: 'roupa_encomendada' | 'sapatilha_encomendada' | 'roupa_entregue' | 'sapatilha_entregue') => {
    if (!podeEditar) return;
    setSalvandoBallet(c.id + field);
    try {
      await api.patch(`/academico/controle-ballet/${c.id}`, {
        [field]: !c[field],
        estoque_roupa_id: c.estoque_roupa_id,
        estoque_sapatilha_id: c.estoque_sapatilha_id,
      });
      carregarBallet();
    } catch {}
    setSalvandoBallet(null);
  };

  const mudarStatusBallet = async (c: ControleBallet, novoStatus: string) => {
    if (!podeEditar) return;
    setSalvandoBallet(c.id + 'status');
    try {
      await api.patch(`/academico/controle-ballet/${c.id}`, { status: novoStatus });
      setControlesBallet(prev => prev.map(x => x.id === c.id ? { ...x, status: novoStatus } : x));
    } catch {}
    setSalvandoBallet(null);
  };

  const lancarPagamentoBallet = async () => {
    if (!modalBallet.item) return;
    if (!formPagamentoBallet.valor || !formPagamentoBallet.data) { toast.error('Preencha valor e data.'); return; }
    setSalvandoPagamento(true);
    try {
      await api.post(`/academico/controle-ballet/${modalBallet.item.id}/pagamento`, {
        tipo: formPagamentoBallet.tipo,
        valor: Number(formPagamentoBallet.valor),
        data: formPagamentoBallet.data,
        forma_pagamento: formPagamentoBallet.forma_pagamento,
      });
      toast.success('Movimentação criada no financeiro!');
      setMostrarFormPagamento(false);
      setFormPagamentoBallet({ tipo: 'entrada', valor: '', data: '', forma_pagamento: 'PIX' });
      await carregarBallet();
    } catch (e: any) {
      toast.error('Erro ao lançar pagamento: ' + (e?.response?.data?.message || e?.message || 'Erro'));
    }
    setSalvandoPagamento(false);
  };

  const stats = {
    total: controles.length,
    uniforme: controles.filter(c => c.uniforme_recebido).length,
    chuteira: controles.filter(c => c.chuteira_recebida).length,
    docsOk: controles.filter(c => c.docs_ok).length,
    entregues: controles.filter(c => c.status === 'Entregue').length,
  };
  const statsBallet = {
    total: controlesBallet.length,
    roupaEncomendada: controlesBallet.filter(c => c.roupa_encomendada).length,
    sapatilhaEncomendada: controlesBallet.filter(c => c.sapatilha_encomendada).length,
    roupaEntregue: controlesBallet.filter(c => c.roupa_entregue).length,
    entregues: controlesBallet.filter(c => c.status === 'Entregue').length,
  };

  return (
    <div className="space-y-6">
      {/* Sub-navegação */}
      <div className="flex gap-2 bg-white dark:bg-slate-900 rounded-2xl p-1.5 border border-slate-100 dark:border-slate-800 w-fit">
        <button onClick={() => setSubTab('futebol')}
          className={`px-4 py-1.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors ${subTab === 'futebol' ? 'bg-green-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
          <Star size={14} /> Futebol
        </button>
        <button onClick={() => setSubTab('ballet')}
          className={`px-4 py-1.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors ${subTab === 'ballet' ? 'bg-pink-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
          <Heart size={14} /> Ballet
        </button>
      </div>

      {/* ── BALLET ──────────────────────────────────────────────────────────── */}
      {subTab === 'ballet' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Total', valor: statsBallet.total },
              { label: 'Roupa Enc.', valor: statsBallet.roupaEncomendada },
              { label: 'Sapat. Enc.', valor: statsBallet.sapatilhaEncomendada },
              { label: 'Roupa Ent.', valor: statsBallet.roupaEntregue },
              { label: 'Entregues', valor: statsBallet.entregues },
            ].map(k => (
              <div key={k.label} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 text-center">
                <div className="text-2xl font-black text-slate-800 dark:text-white">{k.valor}</div>
                <div className="text-xs text-slate-500 mt-1">{k.label}</div>
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            <div className="p-4 flex flex-wrap gap-3 items-center justify-between border-b border-slate-100 dark:border-slate-800">
              <div className="flex gap-2 flex-wrap flex-1">
                <div className="relative flex-1 min-w-[180px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={buscaBallet} onChange={e => setBuscaBallet(e.target.value)} placeholder="Buscar aluno..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-400" />
                </div>
                <select value={filtroStatusBallet} onChange={e => setFiltroStatusBallet(e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800">
                  <option value="">Todos os status</option>
                  {STATUS_BALLET.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              {podeEditar && (
                <button onClick={abrirCriarBallet}
                  className="flex items-center gap-2 px-4 py-2 bg-pink-500 text-white rounded-xl text-sm font-semibold hover:bg-pink-600 transition-colors">
                  <Plus size={14} /> Adicionar
                </button>
              )}
            </div>

            {loadingBallet ? (
              <div className="p-8 text-center text-slate-400 text-sm">Carregando...</div>
            ) : filtradosBallet.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">Nenhum registro encontrado.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Aluna</th>
                      <th className="px-4 py-3 text-center">Tam. Roupa</th>
                      <th className="px-4 py-3 text-center">Nº Sapatilha</th>
                      <th className="px-4 py-3 text-center">Tam. Meia</th>
                      <th className="px-4 py-3 text-center">Roupa Enc.</th>
                      <th className="px-4 py-3 text-center">Sapatilha Enc.</th>
                      <th className="px-4 py-3 text-center">Roupa Ent.</th>
                      <th className="px-4 py-3 text-center">Sapatilha Ent.</th>
                      <th className="px-4 py-3 text-center">Pagamento</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filtradosBallet.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">
                          <div>{c.aluno_nome ?? '—'}</div>
                          {c.turma_nome && <div className="text-xs bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 px-1.5 py-0.5 rounded-md font-medium mt-0.5 w-fit">{c.turma_nome}</div>}
                          {c.responsavel_nome && <div className="text-xs text-slate-400 mt-0.5">{c.responsavel_nome}</div>}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300">{c.tamanho_roupa ?? '—'}</td>
                        <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300">{c.numero_sapatilha ?? '—'}</td>
                        <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300">{c.tamanho_meia ?? '—'}</td>
                        {(['roupa_encomendada','sapatilha_encomendada','roupa_entregue','sapatilha_entregue'] as const).map(field => (
                          <td key={field} className="px-4 py-3 text-center">
                            <button disabled={!podeEditar || salvandoBallet === c.id + field}
                              onClick={() => toggleBallet(c, field)}
                              className={`px-2 py-1 rounded-lg text-xs font-semibold border transition-colors ${c[field] ? 'bg-pink-100 border-pink-300 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300' : 'bg-slate-100 border-slate-300 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                              {c[field] ? '✓ Sim' : 'Não'}
                            </button>
                          </td>
                        ))}
                        <td className="px-4 py-3 text-center">
                          {(() => {
                            const sp = c.status_pagamento ?? 'pendente';
                            const cor = sp === 'quitado' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : sp === 'parcial' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
                            return (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${cor}`}>{sp}</span>
                                {c.valor_total ? <span className="text-xs text-slate-400">R$ {Number(c.valor_total).toFixed(2)}</span> : null}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {podeEditar ? (
                            <select value={c.status} disabled={salvandoBallet === c.id + 'status'}
                              onChange={e => mudarStatusBallet(c, e.target.value)}
                              className={`px-2 py-1 rounded-lg text-xs font-semibold border-0 ${STATUS_BALLET_COLORS[c.status] ?? 'bg-slate-100'}`}>
                              {STATUS_BALLET.map(s => <option key={s}>{s}</option>)}
                            </select>
                          ) : (
                            <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${STATUS_BALLET_COLORS[c.status] ?? 'bg-slate-100'}`}>{c.status}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center gap-1">
                            {podeEditar && (
                              <>
                                <button onClick={() => abrirEditarBallet(c)} className="p-1.5 rounded-lg hover:bg-pink-50 dark:hover:bg-pink-900/20 text-pink-500"><Edit3 size={13}/></button>
                                <button onClick={() => deletarBallet(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"><Trash2 size={13}/></button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Modal Ballet */}
          {modalBallet.aberto && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                    {modalBallet.item ? 'Editar Controle Ballet' : 'Novo Controle — Ballet'}
                  </h3>
                  <button onClick={() => setModalBallet({ aberto: false, item: null })} className="text-slate-400 hover:text-slate-700"><X size={18}/></button>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {!modalBallet.item && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">Aluna *</label>
                      <select value={formBallet.aluno_id ?? ''} onChange={e => setFormBallet(f => ({ ...f, aluno_id: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800">
                        <option value="">Selecione...</option>
                        {alunosBallet.map(a => <option key={a.id} value={a.id}>{a.nome_completo}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { key: 'tamanho_roupa', label: 'Tam. Roupa', ph: 'P, M, G...' },
                      { key: 'numero_sapatilha', label: 'Nº Sapatilha', ph: '35, 36...' },
                      { key: 'tamanho_meia', label: 'Tam. Meia', ph: 'P, M, G...' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="text-xs font-semibold text-slate-500 mb-1 block">{f.label}</label>
                        <input value={(formBallet as any)[f.key] ?? ''} onChange={e => setFormBallet(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.ph}
                          className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800" />
                      </div>
                    ))}
                  </div>
                  {[
                    { id: 'estoque_roupa_id', label: 'Item Estoque — Roupa' },
                    { id: 'estoque_sapatilha_id', label: 'Item Estoque — Sapatilha' },
                  ].map(f => (
                    <div key={f.id}>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">{f.label}</label>
                      <select value={(formBallet as any)[f.id] ?? ''} onChange={e => setFormBallet(p => ({ ...p, [f.id]: e.target.value || undefined }))}
                        className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800">
                        <option value="">Nenhum</option>
                        {estoqueProdutos.map(p => <option key={p.id} value={p.id}>{p.nome} (qtd: {p.quantidade_atual})</option>)}
                      </select>
                    </div>
                  ))}
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Status</label>
                    <select value={formBallet.status ?? 'Pendente'} onChange={e => setFormBallet(f => ({ ...f, status: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800">
                      {STATUS_BALLET.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Pedidos (Encomendas)</label>
                    <div className="flex gap-4">
                      {[
                        { key: 'roupa_encomendada', label: 'Roupa encomendada' },
                        { key: 'sapatilha_encomendada', label: 'Sapatilha encomendada' },
                      ].map(f => (
                        <label key={f.key} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={!!(formBallet as any)[f.key]}
                            onChange={e => setFormBallet(p => ({ ...p, [f.key]: e.target.checked }))}
                            className="rounded accent-pink-500" />
                          {f.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Entregas</label>
                    <div className="flex gap-4">
                      {[
                        { key: 'roupa_entregue', label: 'Roupa entregue' },
                        { key: 'sapatilha_entregue', label: 'Sapatilha entregue' },
                      ].map(f => (
                        <label key={f.key} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={!!(formBallet as any)[f.key]}
                            onChange={e => setFormBallet(p => ({ ...p, [f.key]: e.target.checked }))}
                            className="rounded accent-pink-500" />
                          {f.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Observações</label>
                    <textarea value={formBallet.observacoes ?? ''} onChange={e => setFormBallet(f => ({ ...f, observacoes: e.target.value }))} rows={2}
                      className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 resize-none" />
                  </div>

                  {/* Seção Pagamento */}
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Pagamento</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Valor Total (R$)</label>
                        <input type="number" step="0.01" value={formBallet.valor_total ?? ''} onChange={e => setFormBallet(f => ({ ...f, valor_total: e.target.value ? Number(e.target.value) : undefined }))}
                          className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Entrada (R$)</label>
                        <input type="number" step="0.01" value={formBallet.valor_entrada ?? ''} onChange={e => setFormBallet(f => ({ ...f, valor_entrada: e.target.value ? Number(e.target.value) : undefined }))}
                          className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Data Entrada</label>
                        <input type="date" value={formBallet.data_entrada ?? ''} onChange={e => setFormBallet(f => ({ ...f, data_entrada: e.target.value || undefined }))}
                          className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Forma de Pagamento</label>
                        <select value={formBallet.forma_pagamento ?? ''} onChange={e => setFormBallet(f => ({ ...f, forma_pagamento: e.target.value || undefined }))}
                          className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800">
                          <option value="">Selecione...</option>
                          {['PIX', 'Dinheiro', 'Boleto', 'Cartão', 'Misto'].map(o => <option key={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Parcelas</label>
                        <input type="number" min="1" max="12" value={formBallet.num_parcelas ?? ''} onChange={e => setFormBallet(f => ({ ...f, num_parcelas: e.target.value ? Number(e.target.value) : undefined }))}
                          className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Valor por Parcela</label>
                        <input type="number" step="0.01" value={formBallet.valor_parcela ?? ''} onChange={e => setFormBallet(f => ({ ...f, valor_parcela: e.target.value ? Number(e.target.value) : undefined }))}
                          className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-3">
                      {(['venc_1', 'venc_2', 'venc_3'] as const).map((f, i) => (
                        <div key={f}>
                          <label className="text-xs font-semibold text-slate-500 mb-1 block">Venc. {i + 1}</label>
                          <input type="date" value={(formBallet as any)[f] ?? ''} onChange={e => setFormBallet(p => ({ ...p, [f]: e.target.value || undefined }))}
                            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800" />
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Status Pagamento</label>
                        <select value={formBallet.status_pagamento ?? 'pendente'} onChange={e => setFormBallet(f => ({ ...f, status_pagamento: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800">
                          {['pendente', 'parcial', 'quitado'].map(o => <option key={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Itens Pendentes</label>
                        <input value={formBallet.itens_pendentes ?? ''} onChange={e => setFormBallet(f => ({ ...f, itens_pendentes: e.target.value || undefined }))} placeholder="Ex: falta sapatilha"
                          className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800" />
                      </div>
                    </div>
                  </div>

                  {/* Lançar pagamento no financeiro (apenas ao editar) */}
                  {modalBallet.item && (
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                      <button type="button" onClick={() => setMostrarFormPagamento(v => !v)}
                        className="text-xs font-semibold text-pink-600 dark:text-pink-400 hover:underline">
                        {mostrarFormPagamento ? '▲ Ocultar' : '▼ Lançar Pagamento no Financeiro'}
                      </button>
                      {mostrarFormPagamento && (
                        <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs font-semibold text-slate-500 mb-1 block">Tipo</label>
                              <select value={formPagamentoBallet.tipo} onChange={e => setFormPagamentoBallet(f => ({ ...f, tipo: e.target.value }))}
                                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-700">
                                <option value="entrada">Entrada</option>
                                <option value="parcela">Parcela</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-slate-500 mb-1 block">Valor (R$)</label>
                              <input type="number" step="0.01" value={formPagamentoBallet.valor} onChange={e => setFormPagamentoBallet(f => ({ ...f, valor: e.target.value }))}
                                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-700" />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-slate-500 mb-1 block">Data</label>
                              <input type="date" value={formPagamentoBallet.data} onChange={e => setFormPagamentoBallet(f => ({ ...f, data: e.target.value }))}
                                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-700" />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-slate-500 mb-1 block">Forma</label>
                              <select value={formPagamentoBallet.forma_pagamento} onChange={e => setFormPagamentoBallet(f => ({ ...f, forma_pagamento: e.target.value }))}
                                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-700">
                                {['PIX', 'Dinheiro', 'Boleto', 'Cartão', 'Misto'].map(o => <option key={o}>{o}</option>)}
                              </select>
                            </div>
                          </div>
                          <button onClick={lancarPagamentoBallet} disabled={salvandoPagamento}
                            className="w-full py-2 bg-pink-500 text-white rounded-xl text-sm font-semibold hover:bg-pink-600 disabled:opacity-60">
                            {salvandoPagamento ? 'Lançando...' : 'Confirmar Lançamento'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={salvarBallet} disabled={salvandoBallet === 'form'}
                    className="flex-1 py-2.5 bg-pink-500 text-white rounded-xl font-semibold text-sm hover:bg-pink-600 disabled:opacity-60">
                    {salvandoBallet === 'form' ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button onClick={() => setModalBallet({ aberto: false, item: null })}
                    className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50">
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── FUTEBOL ─────────────────────────────────────────────────────────── */}
      {subTab !== 'ballet' && (<>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total', valor: stats.total, cor: 'blue' },
          { label: 'Uniforme OK', valor: stats.uniforme, cor: 'green' },
          { label: 'Chuteira OK', valor: stats.chuteira, cor: 'yellow' },
          { label: 'Docs OK', valor: stats.docsOk, cor: 'purple' },
          { label: 'Entregues', valor: stats.entregues, cor: 'emerald' },
        ].map(k => (
          <div key={k.label} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 text-center">
            <div className="text-2xl font-black text-slate-800 dark:text-white">{k.valor}</div>
            <div className="text-xs text-slate-500 mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Controles + filtros */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="p-4 flex flex-wrap gap-3 items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <div className="flex gap-2 flex-wrap flex-1">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar aluno ou responsável..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <select
              value={filtroStatus}
              onChange={e => setFiltroStatus(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800"
            >
              <option value="">Todos os status</option>
              {STATUS_FUTEBOL.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          {podeEditar && (
            <button
              onClick={abrirCriar}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors"
            >
              <Plus size={14} /> Adicionar
            </button>
          )}
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Carregando...</div>
        ) : filtrados.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">Nenhum registro encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-xs uppercase text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left">Aluno</th>
                  <th className="px-4 py-3 text-left">Idade</th>
                  <th className="px-4 py-3 text-left">Responsável</th>
                  <th className="px-4 py-3 text-center">Docs</th>
                  <th className="px-4 py-3 text-center">Tam. Camisa</th>
                  <th className="px-4 py-3 text-center">Tam. Short</th>
                  <th className="px-4 py-3 text-center">Chuteira</th>
                  <th className="px-4 py-3 text-center">Uniforme</th>
                  <th className="px-4 py-3 text-center">Chuteira</th>
                  <th className="px-4 py-3 text-center">Status Galo</th>
                  <th className="px-4 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtrados.map(c => {
                  const idade = c.aluno_data_nascimento ? calcularIdade(c.aluno_data_nascimento) : null;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">
                        <div>{c.aluno_nome ?? '—'}</div>
                        {c.turma_nome && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded-md font-medium">{c.turma_nome}</span>
                            {podeEditar && c.turma_id && (
                              <button onClick={() => removerDaTurma(c)} title="Remover da turma"
                                className="text-xs text-red-400 hover:text-red-600 px-1">✕</button>
                            )}
                          </div>
                        )}
                        {c.aluno_celular && <div className="text-xs text-slate-400">{c.aluno_celular}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{idade ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="text-slate-700 dark:text-slate-300">{c.responsavel_nome ?? '—'}</div>
                        {c.responsavel_telefone && <div className="text-xs text-slate-400">{c.responsavel_telefone}</div>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c.docs_ok
                          ? <span className="inline-flex items-center gap-1 text-green-600 font-semibold text-xs"><ShieldCheck size={12}/>OK</span>
                          : <span className="inline-flex items-center gap-1 text-red-500 text-xs"><AlertTriangle size={12}/>{c.docs_enviados ?? 0}/{c.docs_total_obrig ?? 0}</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300">{c.tamanho_camisa ?? '—'}</td>
                      <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300">{c.tamanho_short ?? '—'}</td>
                      <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300">{c.numero_chuteira ?? '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          disabled={!podeEditar || salvando === c.id + 'uniforme_recebido'}
                          onClick={() => toggleField(c, 'uniforme_recebido')}
                          className={`px-2 py-1 rounded-lg text-xs font-semibold border transition-colors ${c.uniforme_recebido ? 'bg-green-100 border-green-300 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-slate-100 border-slate-300 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}
                        >
                          {c.uniforme_recebido ? '✓ Sim' : 'Não'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          disabled={!podeEditar || salvando === c.id + 'chuteira_recebida'}
                          onClick={() => toggleField(c, 'chuteira_recebida')}
                          className={`px-2 py-1 rounded-lg text-xs font-semibold border transition-colors ${c.chuteira_recebida ? 'bg-green-100 border-green-300 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-slate-100 border-slate-300 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}
                        >
                          {c.chuteira_recebida ? '✓ Sim' : 'Não'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {podeEditar ? (
                          <select
                            value={c.status}
                            disabled={salvando === c.id + 'status'}
                            onChange={e => mudarStatus(c, e.target.value)}
                            className={`px-2 py-1 rounded-lg text-xs font-semibold border-0 ${STATUS_COLORS[c.status] ?? 'bg-slate-100'}`}
                          >
                            {STATUS_FUTEBOL.map(s => <option key={s}>{s}</option>)}
                          </select>
                        ) : (
                          <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${STATUS_COLORS[c.status] ?? 'bg-slate-100'}`}>{c.status}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-1">
                          {podeEditar && (
                            <>
                              <button onClick={() => abrirEditar(c)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500"><Edit3 size={13}/></button>
                              <button onClick={() => deletar(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"><Trash2 size={13}/></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal criar/editar */}
      {modal.aberto && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                {modal.item ? 'Editar Controle' : 'Novo Controle — Futebol'}
              </h3>
              <button onClick={() => setModal({ aberto: false, item: null })} className="text-slate-400 hover:text-slate-700"><X size={18}/></button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {!modal.item && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Aluno *</label>
                  <select
                    value={form.aluno_id ?? ''}
                    onChange={e => setForm(f => ({ ...f, aluno_id: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="">Selecione...</option>
                    {alunos.map(a => <option key={a.id} value={a.id}>{a.nome_completo}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Tam. Camisa</label>
                  <input value={form.tamanho_camisa ?? ''} onChange={e => setForm(f => ({ ...f, tamanho_camisa: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800" placeholder="P, M, G..." />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Tam. Short</label>
                  <input value={form.tamanho_short ?? ''} onChange={e => setForm(f => ({ ...f, tamanho_short: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800" placeholder="P, M, G..." />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Nº Chuteira</label>
                  <input value={form.numero_chuteira ?? ''} onChange={e => setForm(f => ({ ...f, numero_chuteira: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800" placeholder="36, 37..." />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Item de Estoque — Uniforme</label>
                <select
                  value={form.estoque_uniforme_id ?? ''}
                  onChange={e => setForm(f => ({ ...f, estoque_uniforme_id: e.target.value || undefined }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800"
                >
                  <option value="">Nenhum</option>
                  {estoqueProdutos
                    .filter(p => p.nome.toUpperCase().includes('FUT') || p.categoria?.toUpperCase().includes('FUT'))
                    .map(p => <option key={p.id} value={p.id}>{p.nome} (qtd: {p.quantidade_atual})</option>)}
                  {estoqueProdutos.filter(p => !p.nome.toUpperCase().includes('FUT') && !p.categoria?.toUpperCase().includes('FUT')).length > 0 && (
                    <>
                      <option disabled>── Outros ──</option>
                      {estoqueProdutos
                        .filter(p => !p.nome.toUpperCase().includes('FUT') && !p.categoria?.toUpperCase().includes('FUT'))
                        .map(p => <option key={p.id} value={p.id}>{p.nome} (qtd: {p.quantidade_atual})</option>)}
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Item de Estoque — Chuteira</label>
                <select
                  value={form.estoque_chuteira_id ?? ''}
                  onChange={e => setForm(f => ({ ...f, estoque_chuteira_id: e.target.value || undefined }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800"
                >
                  <option value="">Nenhum</option>
                  {estoqueProdutos
                    .filter(p => p.nome.toUpperCase().includes('FUT') || p.categoria?.toUpperCase().includes('FUT'))
                    .map(p => <option key={p.id} value={p.id}>{p.nome} (qtd: {p.quantidade_atual})</option>)}
                  {estoqueProdutos.filter(p => !p.nome.toUpperCase().includes('FUT') && !p.categoria?.toUpperCase().includes('FUT')).length > 0 && (
                    <>
                      <option disabled>── Outros ──</option>
                      {estoqueProdutos
                        .filter(p => !p.nome.toUpperCase().includes('FUT') && !p.categoria?.toUpperCase().includes('FUT'))
                        .map(p => <option key={p.id} value={p.id}>{p.nome} (qtd: {p.quantidade_atual})</option>)}
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Status Galo</label>
                <select
                  value={form.status ?? 'Pendente'}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800"
                >
                  {STATUS_FUTEBOL.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Observações</label>
                <textarea
                  value={form.observacoes ?? ''}
                  onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={salvar}
                disabled={salvando === 'form'}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-xl font-semibold text-sm hover:bg-green-700 disabled:opacity-60"
              >
                {salvando === 'form' ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                onClick={() => setModal({ aberto: false, item: null })}
                className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      </>)}
    </div>
  );
}
