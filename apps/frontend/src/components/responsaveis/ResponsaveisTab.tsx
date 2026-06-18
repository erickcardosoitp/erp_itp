'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Plus, Pencil, Trash2, X, Save, Loader2,
  User, MapPin, Phone, Mail, Baby,
} from 'lucide-react';
import api from '@/services/api';
import { toast } from 'sonner';

interface Responsavel {
  id: string;
  nome_completo: string;
  cpf?: string | null;
  data_nascimento?: string | null;
  email?: string | null;
  telefone?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado_uf?: string | null;
  pais?: string;
  foto_url?: string | null;
  eh_aluno?: boolean;
  ativo?: boolean;
}

const EMPTY: Partial<Responsavel> = { pais: 'Brasil', eh_aluno: false };

const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400';

function calcIdade(dob?: string | null): number | null {
  if (!dob) return null;
  const n = new Date();
  const b = new Date(dob);
  let age = n.getFullYear() - b.getFullYear();
  if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) age--;
  return age;
}

function fmtCPF(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
          .replace(/(\d{3})(\d{3})(\d{1,3})$/, '$1.$2.$3')
          .replace(/(\d{3})(\d{1,3})$/, '$1.$2');
}

interface ModalProps {
  responsavel: Partial<Responsavel> | null;
  onClose: () => void;
  onSaved: () => void;
}

function ModalResponsavel({ responsavel, onClose, onSaved }: ModalProps) {
  const [form, setForm] = useState<Partial<Responsavel>>(responsavel ?? EMPTY);
  const [salvando, setSalvando] = useState(false);
  const [buscandoCEP, setBuscandoCEP] = useState(false);

  const set = (k: keyof Responsavel, v: any) => setForm(p => ({ ...p, [k]: v }));

  const buscarCEP = async (cep: string) => {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setBuscandoCEP(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const d = await r.json();
      if (!d.erro) {
        setForm(p => ({
          ...p,
          logradouro: d.logradouro || p.logradouro,
          bairro:     d.bairro     || p.bairro,
          cidade:     d.localidade || p.cidade,
          estado_uf:  d.uf         || p.estado_uf,
        }));
      }
    } catch { /* silent */ }
    finally { setBuscandoCEP(false); }
  };

  const salvar = async () => {
    if (!form.nome_completo?.trim()) { toast.error('Nome é obrigatório'); return; }
    setSalvando(true);
    try {
      if (form.id) {
        await api.patch(`/responsaveis/${form.id}`, form);
      } else {
        await api.post('/responsaveis', form);
      }
      toast.success(form.id ? 'Responsável atualizado' : 'Responsável cadastrado');
      onSaved();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-black text-sm text-slate-800 dark:text-slate-100">
            {form.id ? 'Editar Responsável' : 'Novo Responsável'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
            <X size={16}/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Dados principais */}
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Identificação</p>

          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Nome Completo *</label>
            <input value={form.nome_completo ?? ''} onChange={e => set('nome_completo', e.target.value)}
              className={`${inputCls} mt-1`} placeholder="Nome completo"/>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">CPF</label>
              <input value={form.cpf ?? ''} onChange={e => set('cpf', fmtCPF(e.target.value))}
                className={`${inputCls} mt-1`} placeholder="000.000.000-00"/>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Data de Nascimento</label>
              <input type="date" value={form.data_nascimento ?? ''} onChange={e => set('data_nascimento', e.target.value)}
                className={`${inputCls} mt-1`}/>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Telefone</label>
              <input value={form.telefone ?? ''} onChange={e => set('telefone', e.target.value)}
                className={`${inputCls} mt-1`} placeholder="(11) 99999-9999"/>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">E-mail</label>
              <input type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value)}
                className={`${inputCls} mt-1`} placeholder="email@exemplo.com"/>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input type="checkbox" id="eh_aluno" checked={!!form.eh_aluno} onChange={e => set('eh_aluno', e.target.checked)}
              className="w-4 h-4 rounded accent-purple-600"/>
            <label htmlFor="eh_aluno" className="text-xs text-slate-600 dark:text-slate-300 select-none">É aluno do ITP também</label>
          </div>

          {/* Endereço */}
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 pt-1">Endereço</p>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">CEP</label>
              <input value={form.cep ?? ''} onChange={e => { set('cep', e.target.value); buscarCEP(e.target.value); }}
                className={`${inputCls} mt-1`} placeholder="00000-000"/>
              {buscandoCEP && <p className="text-[10px] text-slate-400 mt-0.5">Buscando...</p>}
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Logradouro</label>
              <input value={form.logradouro ?? ''} onChange={e => set('logradouro', e.target.value)}
                className={`${inputCls} mt-1`} placeholder="Rua, Av..."/>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Número</label>
              <input value={form.numero ?? ''} onChange={e => set('numero', e.target.value)} className={`${inputCls} mt-1`}/>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Complemento</label>
              <input value={form.complemento ?? ''} onChange={e => set('complemento', e.target.value)}
                className={`${inputCls} mt-1`} placeholder="Apto, Bloco..."/>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Bairro</label>
              <input value={form.bairro ?? ''} onChange={e => set('bairro', e.target.value)} className={`${inputCls} mt-1`}/>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Cidade</label>
              <input value={form.cidade ?? ''} onChange={e => set('cidade', e.target.value)} className={`${inputCls} mt-1`}/>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">UF</label>
              <input value={form.estado_uf ?? ''} maxLength={2}
                onChange={e => set('estado_uf', e.target.value.toUpperCase())}
                className={`${inputCls} mt-1`} placeholder="SP"/>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-black uppercase text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            Cancelar
          </button>
          <button onClick={salvar} disabled={salvando}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-black uppercase bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50">
            {salvando ? <Loader2 size={13} className="animate-spin"/> : <Save size={13}/>}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ResponsaveisTab() {
  const [lista, setLista]           = useState<Responsavel[]>([]);
  const [busca, setBusca]           = useState('');
  const [carregando, setCarregando] = useState(false);
  const [modal, setModal]           = useState<Partial<Responsavel> | null | false>(false);

  const load = useCallback(async (search = busca) => {
    setCarregando(true);
    try {
      const r = await api.get('/responsaveis', { params: { search: search || undefined, limit: 50 } });
      setLista(r.data);
    } catch { toast.error('Erro ao carregar responsáveis'); }
    finally { setCarregando(false); }
  }, [busca]);

  useEffect(() => { load(); }, []);

  // debounce busca
  useEffect(() => {
    const t = setTimeout(() => load(busca), 300);
    return () => clearTimeout(t);
  }, [busca]);

  const desativar = async (r: Responsavel) => {
    if (!confirm(`Remover "${r.nome_completo}" do cadastro?`)) return;
    try {
      await api.delete(`/responsaveis/${r.id}`);
      toast.success('Responsável removido');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao remover');
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome, CPF ou e-mail..."
            className="w-full pl-8 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400"/>
        </div>
        <button onClick={() => setModal(EMPTY)}
          className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl font-black text-xs uppercase transition-colors">
          <Plus size={13}/> Novo Responsável
        </button>
      </div>

      {/* Lista */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        {/* Summary */}
        <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {lista.length} responsável{lista.length !== 1 ? 'is' : ''}
          </span>
        </div>

        {carregando ? (
          <div className="py-16 text-center">
            <Loader2 size={20} className="animate-spin text-purple-400 mx-auto mb-2"/>
            <p className="text-slate-400 text-xs">Carregando...</p>
          </div>
        ) : lista.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-slate-400 text-sm font-semibold">Nenhum responsável encontrado</p>
            <p className="text-slate-300 dark:text-slate-600 text-xs mt-1">
              {busca ? 'Tente outro termo' : 'Clique em "Novo Responsável" para começar'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
            {lista.map(r => {
              const idade = calcIdade(r.data_nascimento);
              return (
                <div key={r.id} className="flex items-center gap-4 px-4 py-3 hover:bg-purple-50/40 dark:hover:bg-purple-900/10 group transition-colors">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-xs font-black text-purple-600 shrink-0 select-none">
                    {r.nome_completo[0]?.toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-bold text-xs text-slate-800 dark:text-slate-100">{r.nome_completo}</p>
                      {idade !== null && (
                        <span className="text-[9px] font-black text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">{idade}a</span>
                      )}
                      {r.eh_aluno && (
                        <span className="text-[9px] font-black text-purple-600 bg-purple-100 dark:bg-purple-900/30 px-1.5 py-0.5 rounded-full">É aluno</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      {r.cpf && (
                        <span className="text-[10px] text-slate-400 font-mono">{r.cpf}</span>
                      )}
                      {r.telefone && (
                        <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
                          <Phone size={9}/> {r.telefone}
                        </span>
                      )}
                      {r.email && (
                        <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
                          <Mail size={9}/> {r.email}
                        </span>
                      )}
                      {(r.cidade || r.estado_uf) && (
                        <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
                          <MapPin size={9}/> {[r.cidade, r.estado_uf].filter(Boolean).join('/')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => setModal(r)}
                      className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-purple-600 transition-colors">
                      <Pencil size={13}/>
                    </button>
                    <button onClick={() => desativar(r)}
                      className="p-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 size={13}/>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal !== false && (
        <ModalResponsavel
          responsavel={modal}
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); load(); }}
        />
      )}
    </div>
  );
}
