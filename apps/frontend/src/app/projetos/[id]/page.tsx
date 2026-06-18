'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Users, ClipboardCheck, Printer, X, Edit3, Trash2,
  AlertTriangle, Search, Camera, Upload, CheckCircle2, AlertCircle,
  Mail, MessageSquare, ChevronRight, ChevronUp, ChevronDown, RefreshCw, FileCheck, Download, Filter, Clipboard,
} from 'lucide-react';
import api from '@/services/api';
import { toast } from 'sonner';
import DocumentCamera from '@/components/projetos/DocumentCamera';
import DrawerDocumentos from '@/components/projetos/DrawerDocumentos';
import { LABELS_DOCS } from '@/components/projetos/DrawerDocumentos';

// ── Constants ────────────────────────────────────────────────────────────────

const TIPOS_DOCS = [
  'foto_aluno', 'identidade_aluno', 'identidade_responsavel',
  'comprovante_residencia', 'certidao_nascimento', 'declaracao_escolar',
] as const;

const OBRIGATORIOS: string[] = ['identidade_aluno', 'declaracao_escolar'];

type TipoDoc = typeof TIPOS_DOCS[number];

// ── Types ────────────────────────────────────────────────────────────────────

interface Equipe {
  id: string; nome: string; cor: string;
  faixa_min?: number; faixa_max?: number;
}

interface Inscricao {
  id: string; tipo: string; nome_completo: string;
  data_nascimento?: string; nome_responsavel?: string;
  telefone_responsavel?: string; email_responsavel?: string;
  cep?: string; logradouro?: string; numero?: string; bairro?: string;
  complemento?: string; cidade?: string; estado_uf?: string;
  cpf?: string; celular?: string; sexo?: string;
  cuidado_especial?: string;
  detalhes_cuidado?: string; status: string;
  equipe_id?: string; equipe?: Equipe; aluno_id?: string;
  created_at?: string;
  doc_status?: 'ok' | 'pendente';
  docs_pendentes?: string[];
}

interface Presenca {
  id: string; inscricao_id: string; data: string;
  presente: boolean; hora_entrada?: string; hora_saida?: string;
}

interface Projeto {
  id: string; nome: string; data_inicio: string;
  data_fim: string; pulseira_largura_mm: number; pulseira_altura_mm: number;
}

type Tab       = 'inscritos' | 'equipes' | 'presenca';
type UpStatus  = 'idle' | 'uploading' | 'done' | 'error';

// ── Helpers ──────────────────────────────────────────────────────────────────

function exportarInscritosExcel(inscritos: any[], equipes: any[], nomeProjeto: string) {
  import('xlsx').then(mod => {
    const XLSX = (mod.default ?? mod) as typeof import('xlsx');
    const dados = inscritos.map(ins => {
      const eq = equipes.find((e: any) => e.id === ins.equipe_id);
      const pendentes: string[] = ins.docs_pendentes ?? [];
      return {
        'Nome':              ins.nome_completo,
        'Tipo':              ins.tipo === 'regular' ? 'Aluno ITP' : 'Externo',
        'Idade':             ins.data_nascimento ? `${calcIdade(ins.data_nascimento)} anos` : '—',
        'Responsável':       ins.nome_responsavel || '—',
        'Telefone':          ins.telefone_responsavel || '—',
        'Cuidados Especiais': ins.cuidado_especial && ins.cuidado_especial !== 'Não' ? ins.cuidado_especial : '—',
        'Data Inscrição':    ins.created_at ? new Date(ins.created_at).toLocaleDateString('pt-BR') : '—',
        'Equipe':            eq?.nome || '—',
        'Docs Status':       ins.doc_status === 'ok' ? 'OK' : 'Pendente',
        'Docs Pendentes':    pendentes.length > 0
          ? pendentes.map((t: string) => LABELS_DOCS[t] ?? t).join(', ')
          : '—',
      };
    });
    const ws = XLSX.utils.json_to_sheet(dados);
    ws['!cols'] = [
      { wch: 30 }, { wch: 12 }, { wch: 8 }, { wch: 28 }, { wch: 16 },
      { wch: 30 }, { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 40 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inscritos');
    XLSX.writeFile(wb, `${nomeProjeto}_inscritos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  });
}

function fmtDate(v?: string) {
  if (!v) return '—';
  return new Date(v.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR');
}

function fmtDateShort(v?: string) {
  if (!v) return '—';
  return new Date(v.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function calcIdade(dob?: string) {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob.slice(0, 10) + 'T12:00:00').getTime();
  const age  = Math.floor(diff / (365.25 * 24 * 3600 * 1000));
  return isNaN(age) ? null : age;
}

function fmtTelefone(t?: string) {
  if (!t) return '';
  return t.replace(/\D/g, '').replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');
}

function InputField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
        {label}{required && ' *'}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

const inputCls = 'w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400';

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ProjetoDashboard() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const hoje    = new Date().toISOString().slice(0, 10);

  const [projeto,   setProjeto]   = useState<Projeto | null>(null);
  const [equipes,   setEquipes]   = useState<Equipe[]>([]);
  const [inscritos, setInscritos] = useState<Inscricao[]>([]);
  const [presencas, setPresencas] = useState<Presenca[]>([]);
  const [tab,           setTab]           = useState<Tab>('inscritos');
  const [dataPresenca,  setDataPresenca]  = useState(hoje);
  const [busca,         setBusca]         = useState('');
  const [filtroStatus,   setFiltroStatus]   = useState<'todos' | 'ok' | 'pendente'>('todos');
  const [filtroEquipe,   setFiltroEquipe]   = useState('');
  const [filtroResp,     setFiltroResp]     = useState('');
  const [filtroRua,      setFiltroRua]      = useState('');
  const [filtroBairro,   setFiltroBairro]   = useState('');
  const [filtroCondicao, setFiltroCondicao] = useState<'' | 'sim' | 'nao'>('');
  const [sortCol,        setSortCol]        = useState('nome');
  const [sortDir,        setSortDir]        = useState<'asc' | 'desc'>('asc');
  const [loading,        setLoading]        = useState(true);

  // Drawer de documentos
  const [drawerInscricao, setDrawerInscricao] = useState<Inscricao | null>(null);

  // Modal inscrição — estado geral
  const [modalInscricao, setModalInscricao] = useState(false);
  const [modoExterno,    setModoExterno]    = useState(false);
  const [formInscricao,  setFormInscricao]  = useState<Partial<Inscricao> & { email_responsavel?: string }>({});
  const [salvando,       setSalvando]       = useState(false);
  const [buscandoCEP,    setBuscandoCEP]    = useState(false);

  // ITP: busca de aluno
  const [buscaAluno,      setBuscaAluno]      = useState('');
  const [resultadosAluno, setResultadosAluno] = useState<any[]>([]);
  const [buscandoAluno,   setBuscandoAluno]   = useState(false);
  const [alunoSelecionado,setAlunoSelecionado]= useState<any>(null);
  const [equipeAutoSugerida, setEquipeAutoSugerida] = useState<string | null>(null);

  // Externo: wizard
  const [passoExterno,    setPassoExterno]    = useState<1 | 2 | 3>(1);
  const [inscricaoCriada, setInscricaoCriada] = useState<Inscricao | null>(null);
  const [uploadStatus,    setUploadStatus]    = useState<Record<TipoDoc, UpStatus>>({} as any);
  const [cameraDocWizard, setCameraDocWizard] = useState<string | null>(null);
  const fileInputWizardRef  = useRef<HTMLInputElement>(null);
  const fileInputWizardTipo = useRef('');

  // Reinscrição
  const [reinscrFound,   setReinscrFound]   = useState<any>(null);
  const [reinscrLoading, setReinscrLoading] = useState(false);

  // Modal equipe
  const [modalEquipe, setModalEquipe] = useState<{ open: boolean; editando: Equipe | null }>({ open: false, editando: null });
  const [formEquipe,  setFormEquipe]  = useState<Partial<Equipe>>({});

  // ── Sugestão de equipe por idade ──────────────────────────────────────────

  const sugerirEquipe = useCallback((dob: string | undefined) => {
    if (!dob || equipes.length === 0) return undefined;
    const idade = calcIdade(dob);
    if (idade === null) return undefined;
    return equipes.find(eq =>
      (eq.faixa_min == null || idade >= eq.faixa_min) &&
      (eq.faixa_max == null || idade <= eq.faixa_max)
    )?.id;
  }, [equipes]);

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    try {
      const [rp, re, ri] = await Promise.all([
        api.get(`/projetos/${id}`),
        api.get(`/projetos/${id}/equipes`),
        api.get(`/projetos/${id}/inscricoes`),
      ]);
      setProjeto(rp.data);
      setEquipes(re.data);
      setInscritos(ri.data);
    } catch { toast.error('Erro ao carregar projeto'); }
    finally { setLoading(false); }
  }, [id]);

  const loadPresencas = useCallback(async () => {
    const r = await api.get(`/projetos/${id}/presencas`, { params: { data: dataPresenca } });
    setPresencas(r.data);
  }, [id, dataPresenca]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === 'presenca') loadPresencas(); }, [tab, dataPresenca, loadPresencas]);

  // Busca aluno ITP
  useEffect(() => {
    if (buscaAluno.length < 3) { setResultadosAluno([]); return; }
    const t = setTimeout(async () => {
      setBuscandoAluno(true);
      try {
        const r = await api.get('/academico/alunos', { params: { nome: buscaAluno } });
        setResultadosAluno(r.data?.alunos || r.data || []);
      } catch { setResultadosAluno([]); }
      finally { setBuscandoAluno(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [buscaAluno]);

  // ── Reinscrição detection ─────────────────────────────────────────────────

  const checkReinscrição = useCallback(async () => {
    const nome = formInscricao.nome_completo?.trim();
    const nasc = formInscricao.data_nascimento;
    if (!nome || nome.length < 4 || !nasc) return;
    setReinscrLoading(true);
    try {
      const r = await api.get('/projetos/inscricoes/buscar', { params: { nome, nascimento: nasc } });
      if (r.data) setReinscrFound(r.data);
    } catch { /* silently ignore */ }
    finally { setReinscrLoading(false); }
  }, [formInscricao.nome_completo, formInscricao.data_nascimento]);

  const aplicarReinscrição = () => {
    if (!reinscrFound) return;
    setFormInscricao(p => ({
      ...p,
      nome_completo:        reinscrFound.nome_completo,
      data_nascimento:      reinscrFound.data_nascimento,
      nome_responsavel:     reinscrFound.nome_responsavel,
      telefone_responsavel: reinscrFound.telefone_responsavel,
      email_responsavel:    reinscrFound.email_responsavel,
      cep:                  reinscrFound.cep,
      logradouro:           reinscrFound.logradouro,
      numero:               reinscrFound.numero,
      complemento:          reinscrFound.complemento,
      cuidado_especial:     reinscrFound.cuidado_especial,
      detalhes_cuidado:     reinscrFound.detalhes_cuidado,
    }));
    setReinscrFound(null);
    toast.success('Dados da inscrição anterior preenchidos');
  };

  // ── CEP ───────────────────────────────────────────────────────────────────

  async function buscarCEP(cep: string) {
    const raw = cep.replace(/\D/g, '');
    if (raw.length !== 8) return;
    setBuscandoCEP(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
      const d = await r.json();
      if (!d.erro) {
        setFormInscricao(prev => ({
          ...prev,
          logradouro: d.logradouro || prev.logradouro,
          complemento: d.complemento || prev.complemento,
          bairro: d.bairro || prev.bairro,
          cidade: d.localidade || prev.cidade,
          estado_uf: d.uf || prev.estado_uf,
        }));
      }
    } catch {}
    setBuscandoCEP(false);
  }

  // ── Inscrição ITP ─────────────────────────────────────────────────────────

  const salvarInscricaoITP = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      await api.post(`/projetos/${id}/inscricoes`, formInscricao);
      resetModal();
      await load();
      toast.success('Aluno inscrito com sucesso');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao inscrever');
    } finally { setSalvando(false); }
  };

  // ── Inscrição Externo — Passo 1 ───────────────────────────────────────────

  const salvarPasso1 = async () => {
    // Se já criou no passo 1, apenas avança (evita duplicata ao usar botão "Voltar")
    if (inscricaoCriada) { setPassoExterno(2); return; }
    const { nome_completo, data_nascimento, nome_responsavel, email_responsavel } = formInscricao;
    if (!nome_completo) return;
    setSalvando(true);
    try {
      const equipe_id = formInscricao.equipe_id || sugerirEquipe(data_nascimento);
      const r = await api.post(`/projetos/${id}/inscricoes`, {
        ...formInscricao,
        tipo: 'externo',
        equipe_id,
        email_responsavel: email_responsavel || null,
      });
      setInscricaoCriada(r.data);
      setUploadStatus({} as any);
      setPassoExterno(2);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao salvar inscrição');
    } finally { setSalvando(false); }
  };

  // ── Inscrição Externo — Passo 2: upload ───────────────────────────────────

  const uploadDocWizard = async (tipo: TipoDoc, blob: Blob) => {
    if (!inscricaoCriada) return;
    setUploadStatus(p => ({ ...p, [tipo]: 'uploading' }));
    try {
      const fd = new FormData();
      fd.append('arquivo', blob, `${tipo}.jpg`);
      fd.append('tipo', tipo);
      await api.post(`/projetos/${id}/inscricoes/${inscricaoCriada.id}/documentos`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadStatus(p => ({ ...p, [tipo]: 'done' }));
    } catch (err: any) {
      setUploadStatus(p => ({ ...p, [tipo]: 'error' }));
      toast.error(err?.response?.data?.message || `Erro ao enviar ${LABELS_DOCS[tipo]}`);
    } finally { setCameraDocWizard(null); }
  };

  async function compressImageBlob(blob: Blob): Promise<Blob> {
    if (!blob.type.startsWith('image/')) return blob;
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX_W = 1920;
        const scale = Math.min(1, MAX_W / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => resolve(b ?? blob), 'image/jpeg', 0.85);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(blob); };
      img.src = url;
    });
  }

  const colarDocWizard = async (tipo: string) => {
    if (!inscricaoCriada) return;
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find(t => t.startsWith('image/'));
        if (imageType) {
          const raw = await item.getType(imageType);
          const blob = await compressImageBlob(raw);
          await uploadDocWizard(tipo as TipoDoc, blob);
          return;
        }
      }
      toast.error('Nenhuma imagem na área de transferência');
    } catch {
      toast.error('Permissão negada para acessar área de transferência');
    }
  };

  const marcarDeclaracaoFisica = async () => {
    if (!inscricaoCriada) return;
    try {
      await api.post(`/projetos/${id}/inscricoes/${inscricaoCriada.id}/documentos/declaracao-fisica`);
      setUploadStatus(p => ({ ...p, declaracao_escolar: 'done' }));
      toast.success('Declaração marcada como recebida');
    } catch { toast.error('Erro ao marcar declaração'); }
  };

  const handleFileWizard = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fileInputWizardTipo.current) return;
    const blob = new Blob([file], { type: file.type });
    await uploadDocWizard(fileInputWizardTipo.current as TipoDoc, blob);
    e.target.value = '';
  };

  const obrigatoriosConcluidos = OBRIGATORIOS.every(t => uploadStatus[t as keyof typeof uploadStatus] === 'done');

  const concluirPasso2 = async () => {
    await load();
    setPassoExterno(3);
  };

  // ── Reset ─────────────────────────────────────────────────────────────────

  const resetModal = () => {
    setModalInscricao(false);
    setModoExterno(false);
    setFormInscricao({});
    setBuscaAluno('');
    setResultadosAluno([]);
    setAlunoSelecionado(null);
    setEquipeAutoSugerida(null);
    setPassoExterno(1);
    setInscricaoCriada(null);
    setUploadStatus({} as any);
    setCameraDocWizard(null);
    setReinscrFound(null);
  };

  // ── Equipes ───────────────────────────────────────────────────────────────

  const salvarEquipe = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      if (modalEquipe.editando) await api.patch(`/projetos/${id}/equipes/${modalEquipe.editando.id}`, formEquipe);
      else await api.post(`/projetos/${id}/equipes`, formEquipe);
      setModalEquipe({ open: false, editando: null });
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao salvar equipe');
    } finally { setSalvando(false); }
  };

  const removerEquipe = async (eq: Equipe) => {
    if (!confirm(`Remover equipe "${eq.nome}"?`)) return;
    await api.delete(`/projetos/${id}/equipes/${eq.id}`);
    await load();
  };

  // ── Presença ──────────────────────────────────────────────────────────────

  const togglePresenca = async (ins: Inscricao) => {
    const atual    = presencas.find(p => p.inscricao_id === ins.id);
    const presente = !atual?.presente;
    await api.post(`/projetos/${id}/presencas/${ins.id}/${dataPresenca}`, {
      presente, equipe_id: ins.equipe_id,
      hora_entrada: presente ? new Date().toTimeString().slice(0, 8) : null,
    });
    await loadPresencas();
  };

  // ── Filters ───────────────────────────────────────────────────────────────

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const inscritosFiltrados = (() => {
    const list = inscritos.filter(i => {
      if (busca && !i.nome_completo.toLowerCase().includes(busca.toLowerCase())) return false;
      if (filtroStatus !== 'todos' && i.doc_status !== filtroStatus) return false;
      if (filtroEquipe && i.equipe_id !== filtroEquipe) return false;
      if (filtroResp && !(i.nome_responsavel || '').toLowerCase().includes(filtroResp.toLowerCase())) return false;
      if (filtroRua && !(i.logradouro || '').toLowerCase().includes(filtroRua.toLowerCase())) return false;
      if (filtroBairro && !(i.bairro || '').toLowerCase().includes(filtroBairro.toLowerCase())) return false;
      if (filtroCondicao === 'sim' && (!i.cuidado_especial || i.cuidado_especial === 'Não')) return false;
      if (filtroCondicao === 'nao' && i.cuidado_especial && i.cuidado_especial !== 'Não') return false;
      return true;
    });
    return [...list].sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      switch (sortCol) {
        case 'nome':       av = a.nome_completo; bv = b.nome_completo; break;
        case 'idade':      av = calcIdade(a.data_nascimento) ?? 999; bv = calcIdade(b.data_nascimento) ?? 999; break;
        case 'responsavel': av = a.nome_responsavel || ''; bv = b.nome_responsavel || ''; break;
        case 'rua':        av = a.logradouro || ''; bv = b.logradouro || ''; break;
        case 'bairro':     av = a.bairro || ''; bv = b.bairro || ''; break;
        case 'condicao':   av = a.cuidado_especial || ''; bv = b.cuidado_especial || ''; break;
        case 'inscricao':  av = a.created_at || ''; bv = b.created_at || ''; break;
        case 'docs':       av = a.doc_status || ''; bv = b.doc_status || ''; break;
      }
      const cmp = typeof av === 'number' ? av - (bv as number) : String(av).localeCompare(String(bv), 'pt-BR');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  })();

  // ── WhatsApp link ─────────────────────────────────────────────────────────

  const whatsappLink = () => {
    const phone = formInscricao.telefone_responsavel?.replace(/\D/g, '') ?? '';
    if (!phone || !projeto) return '#';
    const msg = `Olá${formInscricao.nome_responsavel ? `, ${formInscricao.nome_responsavel}` : ''}! ✅ A inscrição de *${formInscricao.nome_completo}* no projeto *${projeto.nome}* foi confirmada! Em caso de dúvidas, entre em contato com o ITP.`;
    return `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`;
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading)  return <div className="flex items-center justify-center min-h-screen text-slate-400">Carregando...</div>;
  if (!projeto) return <div className="flex items-center justify-center min-h-screen text-red-400">Projeto não encontrado</div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

      {/* Camera wizard overlay (above everything) */}
      {cameraDocWizard && (
        <DocumentCamera
          tipo={cameraDocWizard}
          onCapture={blob => uploadDocWizard(cameraDocWizard as TipoDoc, blob)}
          onClose={() => setCameraDocWizard(null)}
        />
      )}

      {/* Document drawer */}
      <DrawerDocumentos
        projetoId={id}
        inscricao={drawerInscricao}
        onClose={() => setDrawerInscricao(null)}
        onRefresh={load}
      />

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-purple-700 via-purple-600 to-indigo-700 px-6 pt-6 pb-8">
        <button onClick={() => router.push('/projetos')}
          className="flex items-center gap-1.5 text-purple-200 hover:text-white text-xs font-bold mb-4 transition-colors">
          <ArrowLeft size={13}/> Projetos
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-white font-black text-2xl tracking-tight">{projeto.nome}</h1>
            <p className="text-purple-200 text-xs mt-1">{fmtDate(projeto.data_inicio)} → {fmtDate(projeto.data_fim)}</p>
          </div>
          <button onClick={() => router.push(`/projetos/${id}/pulseiras`)}
            className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 border border-white/20 text-white px-3 py-2 rounded-xl text-xs font-black uppercase transition-all">
            <Printer size={13}/> Pulseiras
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-5">
          {[
            { label: 'Inscritos',      val: inscritos.length },
            { label: 'Equipes',        val: equipes.length },
            { label: 'Hoje presentes', val: presencas.filter(p => p.presente).length },
          ].map(s => (
            <div key={s.label} className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-white">{s.val}</p>
              <p className="text-[9px] font-bold text-purple-200 uppercase tracking-wider mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4">
        <div className="flex gap-1 max-w-5xl mx-auto py-2">
          {([
            { id: 'inscritos', label: 'Inscritos',  Icon: Users },
            { id: 'equipes',   label: 'Equipes',    Icon: Users },
            { id: 'presenca',  label: 'Presença',   Icon: ClipboardCheck },
          ] as { id: Tab; label: string; Icon: any }[]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                ${tab === t.id ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}>
              <t.Icon size={12}/>{t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">

        {/* ── TAB INSCRITOS ──────────────────────────────────────────────────── */}
        {tab === 'inscritos' && (
          <>
            {/* Toolbar */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[160px]">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome..."
                  className="w-full pl-8 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400"/>
              </div>
              {/* Status filter */}
              <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden text-[10px] font-black uppercase">
                {(['todos', 'ok', 'pendente'] as const).map(s => (
                  <button key={s} onClick={() => setFiltroStatus(s)}
                    className={`px-3 py-2 transition-colors ${filtroStatus === s
                      ? s === 'ok' ? 'bg-green-600 text-white' : s === 'pendente' ? 'bg-orange-500 text-white' : 'bg-purple-600 text-white'
                      : 'bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    {s}
                  </button>
                ))}
              </div>
              {/* Equipe filter */}
              {equipes.length > 0 && (
                <select value={filtroEquipe} onChange={e => setFiltroEquipe(e.target.value)}
                  className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-[11px] bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-400">
                  <option value="">Todas as equipes</option>
                  {equipes.map(eq => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
                </select>
              )}
              <button
                onClick={() => exportarInscritosExcel(inscritosFiltrados, equipes, projeto?.nome ?? 'projeto')}
                className="flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 px-3 py-2 rounded-xl font-black text-xs uppercase transition-colors"
                title="Exportar Excel">
                <Download size={13}/> Excel
              </button>
              <button
                onClick={() => { setFormInscricao({}); setBuscaAluno(''); setResultadosAluno([]); setAlunoSelecionado(null); setModoExterno(false); setEquipeAutoSugerida(null); setPassoExterno(1); setInscricaoCriada(null); setUploadStatus({} as any); setReinscrFound(null); setModalInscricao(true); }}
                className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl font-black text-xs uppercase transition-colors">
                <Plus size={13}/> Inscrever
              </button>
            </div>

            {/* Second filter row */}
            <div className="flex flex-wrap gap-2 items-center">
              <Filter size={12} className="text-slate-400 shrink-0"/>
              <input value={filtroResp} onChange={e => setFiltroResp(e.target.value)} placeholder="Responsável..."
                className="flex-1 min-w-[130px] px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400"/>
              <input value={filtroRua} onChange={e => setFiltroRua(e.target.value)} placeholder="Rua..."
                className="flex-1 min-w-[120px] px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400"/>
              <input value={filtroBairro} onChange={e => setFiltroBairro(e.target.value)} placeholder="Bairro..."
                className="flex-1 min-w-[120px] px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400"/>
              <select value={filtroCondicao} onChange={e => setFiltroCondicao(e.target.value as '' | 'sim' | 'nao')}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-400">
                <option value="">Condição: Todos</option>
                <option value="sim">Com cuidados especiais</option>
                <option value="nao">Sem cuidados especiais</option>
              </select>
              {(filtroResp || filtroRua || filtroBairro || filtroCondicao) && (
                <button onClick={() => { setFiltroResp(''); setFiltroRua(''); setFiltroBairro(''); setFiltroCondicao(''); }}
                  className="px-3 py-1.5 rounded-xl text-xs font-black text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  Limpar
                </button>
              )}
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-x-auto">
              <div className="rounded-2xl min-w-[900px]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      {([
                        { key: 'nome',       label: 'Nome' },
                        { key: 'idade',      label: 'Idade' },
                        { key: 'responsavel',label: 'Responsável' },
                        { key: 'rua',        label: 'Endereço' },
                        { key: 'condicao',   label: 'Condição' },
                        { key: 'inscricao',  label: 'Insc.' },
                        { key: null,         label: 'Equipe' },
                        { key: 'docs',       label: 'Docs' },
                      ] as { key: string | null; label: string }[]).map(({ key, label }) => (
                        <th key={label}
                          onClick={key ? () => handleSort(key) : undefined}
                          className={`text-left px-2 py-2.5 text-[9px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap select-none ${key ? 'cursor-pointer hover:text-purple-500 transition-colors' : ''}`}>
                          <span className="inline-flex items-center gap-1">
                            {label}
                            {key && sortCol === key && (sortDir === 'asc'
                              ? <ChevronUp size={10} className="text-purple-500"/>
                              : <ChevronDown size={10} className="text-purple-500"/>)}
                          </span>
                        </th>
                      ))}
                      <th className="w-6"/>
                    </tr>
                  </thead>
                  <tbody>
                    {inscritosFiltrados.map(ins => {
                      const eq    = equipes.find(e => e.id === ins.equipe_id);
                      const idade = calcIdade(ins.data_nascimento);
                      const temCuidado = ins.cuidado_especial && ins.cuidado_especial !== 'Não';
                      return (
                        <tr key={ins.id}
                          onClick={() => setDrawerInscricao(ins)}
                          className="border-b border-slate-50 dark:border-slate-800/50 last:border-0 hover:bg-purple-50/40 dark:hover:bg-purple-900/10 cursor-pointer transition-colors">
                          {/* Nome */}
                          <td className="px-2 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-[10px] font-black text-purple-600 shrink-0">
                                {ins.nome_completo[0]}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-slate-800 dark:text-slate-100 text-xs leading-tight">{ins.nome_completo}</p>
                                <span className={`text-[8px] font-black px-1 py-0.5 rounded-full ${ins.tipo === 'regular' ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                                  {ins.tipo}
                                </span>
                              </div>
                            </div>
                          </td>
                          {/* Idade */}
                          <td className="px-2 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                            {idade !== null ? `${idade}a` : '—'}
                          </td>
                          {/* Responsável */}
                          <td className="px-2 py-2.5 max-w-[220px]">
                            <p className="text-xs text-slate-700 dark:text-slate-300 leading-tight break-words">{ins.nome_responsavel || '—'}</p>
                            {ins.telefone_responsavel && (
                              <p className="text-[10px] text-slate-400 whitespace-nowrap">{fmtTelefone(ins.telefone_responsavel)}</p>
                            )}
                          </td>
                          {/* Rua / Bairro */}
                          <td className="px-2 py-2.5 max-w-[180px]">
                            {ins.logradouro
                              ? <p className="text-xs text-slate-700 dark:text-slate-300 leading-tight truncate">{ins.logradouro}{ins.numero ? `, ${ins.numero}` : ''}</p>
                              : <span className="text-xs text-slate-300">—</span>}
                            {ins.bairro && <p className="text-[10px] text-slate-400 truncate">{ins.bairro}</p>}
                          </td>
                          {/* Cuidados */}
                          <td className="px-2 py-2.5 max-w-[140px]">
                            {temCuidado ? (
                              <span className="flex items-start gap-1 text-[10px] font-black text-red-600 dark:text-red-400 leading-tight">
                                <AlertTriangle size={10} className="shrink-0 mt-0.5"/> {ins.cuidado_especial}
                              </span>
                            ) : <span className="text-xs text-slate-300">—</span>}
                          </td>
                          {/* Data inscrição */}
                          <td className="px-2 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                            {fmtDateShort(ins.created_at)}
                          </td>
                          {/* Equipe */}
                          <td className="px-2 py-2.5" onClick={e => e.stopPropagation()}>
                            <select value={ins.equipe_id ?? ''}
                              onChange={async e => {
                                await api.patch(`/projetos/${id}/inscricoes/${ins.id}`, { equipe_id: e.target.value || null });
                                await load();
                              }}
                              className="text-[10px] font-black border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-400"
                              style={eq ? { borderColor: eq.cor, color: eq.cor } : {}}>
                              <option value="">—</option>
                              {equipes.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                            </select>
                          </td>
                          {/* Docs */}
                          <td className="px-2 py-2.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase
                              ${ins.doc_status === 'ok'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                              }`}
                              title={ins.doc_status !== 'ok' ? `Pendentes: ${ins.docs_pendentes?.map(t => LABELS_DOCS[t]).join(', ')}` : undefined}>
                              {ins.doc_status === 'ok' ? <CheckCircle2 size={9}/> : <AlertCircle size={9}/>}
                              {ins.doc_status === 'ok' ? 'OK' : 'Pend.'}
                            </span>
                          </td>
                          {/* Delete */}
                          <td className="px-1 py-2.5" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={async () => {
                                if (!confirm(`Remover "${ins.nome_completo}" do projeto?`)) return;
                                await api.delete(`/projetos/${id}/inscricoes/${ins.id}`);
                                await load();
                              }}
                              className="p-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-300 hover:text-red-500 transition-colors">
                              <Trash2 size={12}/>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {inscritosFiltrados.length === 0 && (
                  <p className="py-12 text-center text-slate-400 text-sm">Nenhum inscrito encontrado.</p>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── TAB EQUIPES ──────────────────────────────────────────────────── */}
        {tab === 'equipes' && (
          <>
            <div className="flex justify-end">
              <button onClick={() => { setFormEquipe({ cor: '#7c3aed' }); setModalEquipe({ open: true, editando: null }); }}
                className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase">
                <Plus size={13}/> Nova Equipe
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {equipes.map(eq => {
                const membros = inscritos.filter(i => i.equipe_id === eq.id);
                return (
                  <div key={eq.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: eq.cor }}/>
                      <span className="font-black text-sm text-slate-800 dark:text-slate-100">{eq.nome}</span>
                      {(eq.faixa_min || eq.faixa_max) && (
                        <span className="text-[9px] font-black text-slate-400">{eq.faixa_min ?? '?'}–{eq.faixa_max ?? '?'} anos</span>
                      )}
                      <div className="flex gap-1 ml-auto">
                        <button onClick={() => { setFormEquipe({ ...eq }); setModalEquipe({ open: true, editando: eq }); }}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"><Edit3 size={12}/></button>
                        <button onClick={() => removerEquipe(eq)}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500"><Trash2 size={12}/></button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">{membros.length} {membros.length === 1 ? 'membro' : 'membros'}</p>
                    <div className="mt-2 space-y-1">
                      {membros.slice(0, 5).map(m => (
                        <div key={m.id} className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-[8px] font-black text-purple-600">
                            {m.nome_completo[0]}
                          </div>
                          <span className="text-[11px] text-slate-700 dark:text-slate-300 truncate">{m.nome_completo}</span>
                        </div>
                      ))}
                      {membros.length > 5 && <p className="text-[10px] text-slate-400">+{membros.length - 5} mais</p>}
                    </div>
                  </div>
                );
              })}
              {equipes.length === 0 && (
                <div className="col-span-2 py-12 text-center text-slate-400 text-sm">Nenhuma equipe cadastrada.</div>
              )}
            </div>
          </>
        )}

        {/* ── TAB PRESENÇA ─────────────────────────────────────────────────── */}
        {tab === 'presenca' && (
          <>
            <div className="flex items-center gap-3">
              <label className="text-[10px] font-black uppercase text-slate-500">Data</label>
              <input type="date" value={dataPresenca} onChange={e => setDataPresenca(e.target.value)}
                className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400"/>
              <span className="text-xs text-slate-400">{presencas.filter(p => p.presente).length} / {inscritos.length} presentes</span>
            </div>
            <div className="space-y-2">
              {inscritos.map(ins => {
                const p  = presencas.find(p => p.inscricao_id === ins.id);
                const eq = equipes.find(e => e.id === ins.equipe_id);
                return (
                  <div key={ins.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all
                      ${p?.presente ? 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-purple-200'}`}
                    onClick={() => togglePresenca(ins)}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors
                      ${p?.presente ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
                      {p?.presente && <span className="text-white text-[10px] font-black">✓</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{ins.nome_completo}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {eq && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full text-white" style={{ background: eq.cor }}>{eq.nome}</span>}
                        {p?.hora_entrada && <span className="text-[9px] text-slate-400">entrada {p.hora_entrada.slice(0, 5)}</span>}
                        {p?.hora_saida   && <span className="text-[9px] text-slate-400">saída {p.hora_saida.slice(0, 5)}</span>}
                        {ins.cuidado_especial && ins.cuidado_especial !== 'Não' && (
                          <span className="flex items-center gap-0.5 text-[9px] font-black text-red-600 dark:text-red-400">
                            <AlertTriangle size={8}/> {ins.cuidado_especial}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Modal Inscrição ──────────────────────────────────────────────────── */}
      {modalInscricao && (
        <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-h-[92vh] overflow-y-auto transition-all
            ${modoExterno && passoExterno === 2 ? 'max-w-2xl' : 'max-w-lg'}`}>

            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div>
                <h3 className="font-black text-sm uppercase tracking-tight text-slate-800 dark:text-slate-100">
                  {modoExterno && passoExterno === 1 && 'Inscrição Externo — Dados'}
                  {modoExterno && passoExterno === 2 && 'Inscrição Externo — Documentos'}
                  {modoExterno && passoExterno === 3 && 'Inscrição Confirmada'}
                  {!modoExterno && 'Inscrever Aluno ITP'}
                </h3>
                {modoExterno && passoExterno !== 3 && (
                  <p className="text-[10px] text-slate-400 mt-0.5">Passo {passoExterno} de 3</p>
                )}
              </div>
              <button onClick={resetModal} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"><X size={16}/></button>
            </div>

            {/* ── ALUNO ITP ─────────────────────────────────────────────────── */}
            {!modoExterno && (
              <form onSubmit={salvarInscricaoITP} className="p-6 space-y-4">
                {/* Tipo toggle */}
                {!alunoSelecionado && (
                  <div className="flex gap-2">
                    <button type="button"
                      className="flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-purple-600 text-white">
                      Aluno do ITP
                    </button>
                    <button type="button"
                      onClick={() => { setModoExterno(true); setBuscaAluno(''); setResultadosAluno([]); setFormInscricao({ tipo: 'externo' }); }}
                      className="flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700">
                      Externo
                    </button>
                  </div>
                )}

                {!alunoSelecionado && (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                      <input value={buscaAluno} onChange={e => setBuscaAluno(e.target.value)}
                        placeholder="Buscar aluno pelo nome..." autoFocus
                        className="w-full pl-9 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400"/>
                    </div>
                    {buscandoAluno && <p className="text-xs text-slate-400 px-1">Buscando...</p>}
                    {resultadosAluno.length > 0 && (
                      <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
                        {resultadosAluno.map((a: any) => (
                          <button key={a.id} type="button"
                            onClick={() => {
                              const equipe_id = sugerirEquipe(a.data_nascimento);
                              setAlunoSelecionado(a);
                              setFormInscricao({
                                aluno_id: a.id, tipo: 'regular',
                                nome_completo: a.nome_completo,
                                data_nascimento: a.data_nascimento,
                                nome_responsavel: a.nome_responsavel,
                                telefone_responsavel: a.telefone_alternativo,
                                cuidado_especial: a.cuidado_especial || '',
                                detalhes_cuidado: a.detalhes_cuidado || '',
                                equipe_id,
                              });
                              setEquipeAutoSugerida(equipe_id ?? null);
                              setResultadosAluno([]);
                            }}
                            className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0">
                            <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-sm font-black text-purple-600 shrink-0">
                              {a.nome_completo[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{a.nome_completo}</p>
                              <p className="text-[10px] text-slate-400">{a.numero_matricula}</p>
                            </div>
                            {a.data_nascimento && (
                              <span className="text-[10px] text-slate-400 shrink-0">{calcIdade(a.data_nascimento)} anos</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    {buscaAluno.length >= 3 && !buscandoAluno && resultadosAluno.length === 0 && (
                      <p className="text-xs text-slate-400 px-1">Nenhum aluno encontrado.</p>
                    )}
                  </div>
                )}

                {alunoSelecionado && (
                  <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/40 rounded-2xl p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-base font-black text-green-700 dark:text-green-400 shrink-0">
                          {alunoSelecionado.nome_completo[0]}
                        </div>
                        <div>
                          <p className="font-black text-sm text-slate-800 dark:text-slate-100">{alunoSelecionado.nome_completo}</p>
                          <p className="text-[10px] text-slate-500">{alunoSelecionado.numero_matricula}</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => { setAlunoSelecionado(null); setFormInscricao({}); setBuscaAluno(''); }}
                        className="p-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 shrink-0">
                        <X size={14}/>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {alunoSelecionado.data_nascimento && (
                        <div className="bg-white dark:bg-slate-900/50 rounded-xl px-3 py-2">
                          <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Idade</p>
                          <p className="font-bold text-slate-700 dark:text-slate-300 mt-0.5">{calcIdade(alunoSelecionado.data_nascimento)} anos</p>
                        </div>
                      )}
                      {alunoSelecionado.nome_responsavel && (
                        <div className="bg-white dark:bg-slate-900/50 rounded-xl px-3 py-2">
                          <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Responsável</p>
                          <p className="font-bold text-slate-700 dark:text-slate-300 mt-0.5 truncate">{alunoSelecionado.nome_responsavel}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {alunoSelecionado && (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Equipe</label>
                        {equipeAutoSugerida && formInscricao.equipe_id === equipeAutoSugerida && (
                          <span className="text-[9px] font-black text-purple-500 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded-full">✦ sugerida pela idade</span>
                        )}
                      </div>
                      <select value={formInscricao.equipe_id ?? ''}
                        onChange={e => { setFormInscricao(p => ({ ...p, equipe_id: e.target.value || undefined })); setEquipeAutoSugerida(null); }}
                        className={inputCls}>
                        <option value="">Sem equipe</option>
                        {equipes.map(eq => <option key={eq.id} value={eq.id}>{eq.nome}{eq.faixa_min != null || eq.faixa_max != null ? ` (${eq.faixa_min ?? '?'}–${eq.faixa_max ?? '?'} anos)` : ''}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Cuidado Especial</label>
                      <input value={formInscricao.cuidado_especial ?? ''} onChange={e => setFormInscricao(p => ({ ...p, cuidado_especial: e.target.value }))}
                        placeholder="ex: TEA, alérgico a glúten..."
                        className={`mt-1 ${inputCls}`}/>
                    </div>
                  </>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={resetModal}
                    className="px-4 py-2 rounded-xl text-xs font-black uppercase text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Cancelar</button>
                  <button type="submit"
                    disabled={salvando || !alunoSelecionado}
                    className="px-5 py-2 rounded-xl text-xs font-black uppercase bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50">
                    {salvando ? 'Salvando...' : 'Inscrever'}
                  </button>
                </div>
              </form>
            )}

            {/* ── EXTERNO PASSO 1: Dados ─────────────────────────────────────── */}
            {modoExterno && passoExterno === 1 && (
              <div className="p-4 sm:p-6 space-y-4">
                {/* Tipo toggle */}
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => { setModoExterno(false); setFormInscricao({}); setBuscaAluno(''); setResultadosAluno([]); }}
                    className="flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700">
                    Aluno do ITP
                  </button>
                  <button type="button"
                    className="flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-purple-600 text-white">
                    Externo
                  </button>
                </div>

                {/* Reinscrição alert */}
                {reinscrFound && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3 flex items-start gap-3">
                    <RefreshCw size={14} className="text-amber-600 mt-0.5 shrink-0"/>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-amber-800 dark:text-amber-200">Inscrição anterior encontrada</p>
                      <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-0.5">
                        {reinscrFound.nome_completo} — {reinscrFound.projeto_nome}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={aplicarReinscrição}
                        className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-black uppercase transition-colors">
                        Usar dados
                      </button>
                      <button onClick={() => setReinscrFound(null)}
                        className="p-1 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-800/40 text-amber-600 transition-colors">
                        <X size={12}/>
                      </button>
                    </div>
                  </div>
                )}

                {/* Dados pessoais */}
                <InputField label="Nome Completo" required>
                  <input required value={formInscricao.nome_completo ?? ''}
                    onChange={e => setFormInscricao(p => ({ ...p, nome_completo: e.target.value }))}
                    onBlur={checkReinscrição}
                    autoFocus className={inputCls}/>
                </InputField>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InputField label="Nascimento">
                    <input type="date" value={formInscricao.data_nascimento ?? ''}
                      onChange={e => {
                        const dob = e.target.value;
                        const equipe_id = sugerirEquipe(dob);
                        setFormInscricao(p => ({ ...p, data_nascimento: dob, equipe_id: equipe_id ?? p.equipe_id }));
                        if (equipe_id) setEquipeAutoSugerida(equipe_id);
                      }}
                      onBlur={checkReinscrição}
                      className={inputCls}/>
                  </InputField>
                  <InputField label="Responsável">
                    <input value={formInscricao.nome_responsavel ?? ''}
                      onChange={e => setFormInscricao(p => ({ ...p, nome_responsavel: e.target.value }))}
                      className={inputCls}/>
                  </InputField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InputField label="Telefone">
                    <input value={formInscricao.telefone_responsavel ?? ''}
                      onChange={e => setFormInscricao(p => ({ ...p, telefone_responsavel: e.target.value }))}
                      placeholder="(11) 99999-9999"
                      className={inputCls}/>
                  </InputField>
                  <InputField label="E-mail do responsável">
                    <input type="email" value={formInscricao.email_responsavel ?? ''}
                      onChange={e => setFormInscricao(p => ({ ...p, email_responsavel: e.target.value }))}
                      placeholder="email@exemplo.com"
                      className={inputCls}/>
                  </InputField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <InputField label="CEP">
                    <input value={formInscricao.cep ?? ''}
                      onChange={e => { setFormInscricao(p => ({ ...p, cep: e.target.value })); buscarCEP(e.target.value); }}
                      placeholder="00000-000" className={inputCls}/>
                    {buscandoCEP && <p className="text-xs text-slate-400 mt-1">Buscando CEP...</p>}
                  </InputField>
                  <div className="sm:col-span-2">
                    <InputField label="Logradouro">
                      <input value={formInscricao.logradouro ?? ''}
                        onChange={e => setFormInscricao(p => ({ ...p, logradouro: e.target.value }))}
                        placeholder="Rua, Av..." className={inputCls}/>
                    </InputField>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InputField label="Número">
                    <input value={formInscricao.numero ?? ''}
                      onChange={e => setFormInscricao(p => ({ ...p, numero: e.target.value }))}
                      className={inputCls}/>
                  </InputField>
                  <InputField label="Complemento">
                    <input value={formInscricao.complemento ?? ''}
                      onChange={e => setFormInscricao(p => ({ ...p, complemento: e.target.value }))}
                      placeholder="Apto, Bloco..." className={inputCls}/>
                  </InputField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <InputField label="Bairro">
                    <input value={formInscricao.bairro ?? ''}
                      onChange={e => setFormInscricao(p => ({ ...p, bairro: e.target.value }))}
                      className={inputCls}/>
                  </InputField>
                  <InputField label="Cidade">
                    <input value={formInscricao.cidade ?? ''}
                      onChange={e => setFormInscricao(p => ({ ...p, cidade: e.target.value }))}
                      className={inputCls}/>
                  </InputField>
                  <InputField label="UF">
                    <input value={formInscricao.estado_uf ?? ''} maxLength={2}
                      onChange={e => setFormInscricao(p => ({ ...p, estado_uf: e.target.value.toUpperCase() }))}
                      placeholder="SP" className={inputCls}/>
                  </InputField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InputField label="CPF">
                    <input value={formInscricao.cpf ?? ''}
                      onChange={e => setFormInscricao(p => ({ ...p, cpf: e.target.value }))}
                      placeholder="000.000.000-00" className={inputCls}/>
                  </InputField>
                  <InputField label="Celular do aluno">
                    <input value={formInscricao.celular ?? ''}
                      onChange={e => setFormInscricao(p => ({ ...p, celular: e.target.value }))}
                      placeholder="(11) 99999-9999" className={inputCls}/>
                  </InputField>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Equipe</label>
                    {equipeAutoSugerida && formInscricao.equipe_id === equipeAutoSugerida && (
                      <span className="text-[9px] font-black text-purple-500 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded-full">✦ sugerida pela idade</span>
                    )}
                  </div>
                  <select value={formInscricao.equipe_id ?? ''}
                    onChange={e => { setFormInscricao(p => ({ ...p, equipe_id: e.target.value || undefined })); setEquipeAutoSugerida(null); }}
                    className={inputCls}>
                    <option value="">Sem equipe</option>
                    {equipes.map(eq => <option key={eq.id} value={eq.id}>{eq.nome}{eq.faixa_min != null || eq.faixa_max != null ? ` (${eq.faixa_min ?? '?'}–${eq.faixa_max ?? '?'} anos)` : ''}</option>)}
                  </select>
                </div>

                <InputField label="Cuidado Especial">
                  <input value={formInscricao.cuidado_especial ?? ''}
                    onChange={e => setFormInscricao(p => ({ ...p, cuidado_especial: e.target.value }))}
                    placeholder="ex: TEA, alérgico a glúten..."
                    className={inputCls}/>
                </InputField>
                {formInscricao.cuidado_especial && (
                  <InputField label="Detalhes">
                    <input value={formInscricao.detalhes_cuidado ?? ''}
                      onChange={e => setFormInscricao(p => ({ ...p, detalhes_cuidado: e.target.value }))}
                      placeholder="Descreva o cuidado necessário..."
                      className={inputCls}/>
                  </InputField>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={resetModal}
                    className="px-4 py-3 rounded-xl text-xs font-black uppercase text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Cancelar</button>
                  <button type="button" onClick={salvarPasso1}
                    disabled={salvando || !formInscricao.nome_completo}
                    className="flex items-center gap-1.5 px-5 py-3 rounded-xl text-xs font-black uppercase bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50">
                    {salvando ? 'Salvando...' : <><span>Avançar</span><ChevronRight size={13}/></>}
                  </button>
                </div>
              </div>
            )}

            {/* ── EXTERNO PASSO 2: Documentos ───────────────────────────────── */}
            {modoExterno && passoExterno === 2 && inscricaoCriada && (
              <div className="p-4 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Fotografe os documentos de <strong className="text-slate-800 dark:text-slate-100">{inscricaoCriada.nome_completo}</strong>
                  </p>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${obrigatoriosConcluidos ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-600'}`}>
                    {OBRIGATORIOS.filter(t => uploadStatus[t as keyof typeof uploadStatus] === 'done').length}/{OBRIGATORIOS.length} obrigatórios
                  </span>
                </div>

                {/* Document grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {TIPOS_DOCS.map(tipo => {
                    const st      = uploadStatus[tipo] ?? 'idle';
                    const obrig   = OBRIGATORIOS.includes(tipo as any);
                    const isDone  = st === 'done';
                    const isBusy  = st === 'uploading';
                    const isError = st === 'error';

                    return (
                      <div key={tipo}
                        className={`relative rounded-2xl border-2 p-3 text-center flex flex-col items-center gap-2 transition-all
                          ${isDone  ? 'border-green-400 bg-green-50 dark:bg-green-900/10'
                          : isError ? 'border-red-300 bg-red-50 dark:bg-red-900/10'
                          : obrig   ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50'
                          :           'border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/30'}`}>
                        {/* Status icon */}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center
                          ${isDone ? 'bg-green-100 dark:bg-green-900/30' : 'bg-slate-100 dark:bg-slate-700'}`}>
                          {isBusy  ? <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"/>
                          : isDone  ? <CheckCircle2 size={20} className="text-green-600"/>
                          : isError ? <AlertCircle size={20} className="text-red-500"/>
                          :           <AlertCircle size={20} className={obrig ? 'text-orange-400' : 'text-slate-300'}/>}
                        </div>

                        <p className="text-[10px] font-black text-slate-700 dark:text-slate-300 leading-tight">{LABELS_DOCS[tipo]}</p>
                        {!obrig && <span className="text-[9px] text-slate-400 font-bold">Opcional</span>}

                        {/* Actions */}
                        {!isBusy && (
                          <div className="flex gap-2 flex-wrap justify-center">
                            <button onClick={() => setCameraDocWizard(tipo)}
                              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-black hover:bg-purple-200 transition-colors">
                              <Camera size={14}/> {isDone ? 'Refazer' : 'Foto'}
                            </button>
                            <button onClick={() => { fileInputWizardTipo.current = tipo; fileInputWizardRef.current?.click(); }}
                              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-black hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                              <Upload size={14}/>
                            </button>
                            <button onClick={() => colarDocWizard(tipo)}
                              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-black hover:bg-amber-200 transition-colors">
                              <Clipboard size={14}/>
                            </button>
                            {tipo === 'declaracao_escolar' && !isDone && (
                              <button onClick={marcarDeclaracaoFisica}
                                className="flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-black hover:bg-blue-200 transition-colors">
                                <FileCheck size={14}/> Físico
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {!obrigatoriosConcluidos && (
                  <p className="text-[10px] text-orange-600 dark:text-orange-400 text-center">
                    Foto, RG do aluno, RG do responsável, comprovante e certidão são obrigatórios.
                  </p>
                )}

                <div className="flex justify-between pt-2">
                  <button type="button" onClick={() => { setPassoExterno(1); }}
                    className="px-4 py-2 rounded-xl text-xs font-black uppercase text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                    ← Voltar
                  </button>
                  <button type="button" onClick={concluirPasso2}
                    disabled={!obrigatoriosConcluidos}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-black uppercase bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 transition-colors">
                    <CheckCircle2 size={13}/> Concluir
                  </button>
                </div>
              </div>
            )}

            {/* ── EXTERNO PASSO 3: Confirmação ──────────────────────────────── */}
            {modoExterno && passoExterno === 3 && inscricaoCriada && (
              <div className="p-4 sm:p-6 space-y-5 text-center">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={32} className="text-green-600"/>
                </div>
                <div>
                  <h4 className="font-black text-lg text-slate-800 dark:text-slate-100">Inscrição Realizada!</h4>
                  <p className="text-sm text-slate-500 mt-1">
                    <strong className="text-slate-700 dark:text-slate-300">{inscricaoCriada.nome_completo}</strong> está inscrito no projeto.
                  </p>
                  {formInscricao.email_responsavel && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      Confirmação enviada para {formInscricao.email_responsavel}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  {formInscricao.telefone_responsavel && (
                    <a href={whatsappLink()} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-black text-sm transition-colors">
                      <MessageSquare size={16}/> Enviar WhatsApp
                    </a>
                  )}
                  {formInscricao.email_responsavel && (
                    <div className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-bold text-sm">
                      <Mail size={15}/> E-mail enviado automaticamente
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <button type="button"
                    onClick={() => {
                      resetModal();
                      setModoExterno(true);
                      setFormInscricao({ tipo: 'externo' });
                      setPassoExterno(1);
                      setModalInscricao(true);
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl text-xs font-black uppercase border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    + Nova inscrição
                  </button>
                  <button type="button" onClick={resetModal}
                    className="flex-1 px-4 py-2.5 rounded-xl text-xs font-black uppercase bg-slate-800 dark:bg-slate-700 text-white hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors">
                    Fechar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal Equipe ──────────────────────────────────────────────────────── */}
      {modalEquipe.open && (
        <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-black text-sm uppercase tracking-tight text-slate-800 dark:text-slate-100">
                {modalEquipe.editando ? 'Editar Equipe' : 'Nova Equipe'}
              </h3>
              <button onClick={() => setModalEquipe({ open: false, editando: null })} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"><X size={16}/></button>
            </div>
            <form onSubmit={salvarEquipe} className="p-6 space-y-4">
              <InputField label="Nome" required>
                <input required value={formEquipe.nome ?? ''} onChange={e => setFormEquipe(p => ({ ...p, nome: e.target.value }))} className={inputCls}/>
              </InputField>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Cor</label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={formEquipe.cor ?? '#7c3aed'} onChange={e => setFormEquipe(p => ({ ...p, cor: e.target.value }))}
                    className="w-10 h-10 rounded-xl border border-slate-200 cursor-pointer"/>
                  <span className="text-sm text-slate-500 font-mono">{formEquipe.cor}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Idade mín.">
                  <input type="number" min={0} max={99} value={formEquipe.faixa_min ?? ''}
                    onChange={e => setFormEquipe(p => ({ ...p, faixa_min: +e.target.value || undefined }))} className={inputCls}/>
                </InputField>
                <InputField label="Idade máx.">
                  <input type="number" min={0} max={99} value={formEquipe.faixa_max ?? ''}
                    onChange={e => setFormEquipe(p => ({ ...p, faixa_max: +e.target.value || undefined }))} className={inputCls}/>
                </InputField>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalEquipe({ open: false, editando: null })}
                  className="px-4 py-2 rounded-xl text-xs font-black uppercase text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Cancelar</button>
                <button type="submit" disabled={salvando}
                  className="px-5 py-2 rounded-xl text-xs font-black uppercase bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50">
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <input ref={fileInputWizardRef} type="file" accept="image/jpeg,image/png,image/heic" className="hidden" onChange={handleFileWizard}/>
    </div>
  );
}
