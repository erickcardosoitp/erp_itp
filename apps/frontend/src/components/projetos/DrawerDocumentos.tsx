'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Trash2, Camera, CheckCircle2, AlertCircle, FileCheck, FileText, UserPlus, PlusCircle, Loader2, Clipboard, ScanLine, ChevronDown, Pencil, Check } from 'lucide-react';
import dynamic from 'next/dynamic';
import api from '@/services/api';
import { toast } from 'sonner';
import DocumentCamera from './DocumentCamera';

const CadastroDiretoModal = dynamic(
  () => import('@/app/matriculas/components/CadastroDiretoModal'),
  { ssr: false },
);

function DocThumb({ signedUrl, fisico, hasDoc, obrig, mimetype }: {
  signedUrl?: string | null; fisico: boolean; hasDoc: boolean; obrig: boolean; mimetype?: string | null;
}) {
  const [err, setErr] = useState(false);
  useEffect(() => { setErr(false); }, [signedUrl]);

  const isPdf = mimetype === 'application/pdf' || signedUrl?.toLowerCase().includes('.pdf');

  if (signedUrl && isPdf) {
    return (
      <a href={signedUrl} target="_blank" rel="noopener noreferrer"
        className="flex flex-col items-center justify-center w-full h-full gap-0.5 text-blue-600 hover:text-blue-700"
        onClick={e => e.stopPropagation()}>
        <FileText size={18} />
        <span className="text-[8px] font-black uppercase">PDF</span>
      </a>
    );
  }
  if (signedUrl && !err) return <img src={signedUrl} alt="" className="w-full h-full object-cover" onError={() => setErr(true)} />;
  if (fisico) return <FileCheck size={20} className="text-green-600" />;
  if (hasDoc || err) return <CheckCircle2 size={20} className="text-green-500" />;
  return <AlertCircle size={20} className={obrig ? 'text-orange-400' : 'text-slate-300'} />;
}

export const TIPOS_DOCS = [
  'foto_aluno', 'identidade_aluno', 'identidade_responsavel',
  'comprovante_residencia', 'certidao_nascimento', 'declaracao_escolar',
] as const;

export const LABELS_DOCS: Record<string, string> = {
  foto_aluno:              'Foto do Aluno',
  identidade_aluno:        'RG / Doc. do Aluno',
  identidade_responsavel:  'RG / Doc. do Responsável',
  comprovante_residencia:  'Comprovante de Residência',
  certidao_nascimento:     'Certidão de Nascimento',
  declaracao_escolar:      'Declaração Escolar',
};

const OBRIGATORIOS: string[] = ['identidade_aluno', 'declaracao_escolar'];

interface DocRecord {
  id: string;
  tipo: string;
  fisico?: boolean;
  signed_url?: string | null;
  mimetype?: string | null;
  tamanho_bytes?: number | null;
  nome_arquivo?: string | null;
  source?: 'matriculas' | 'projetos';
}

function fmtBytes(b: number | null | undefined): string {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

interface Inscricao {
  id: string;
  nome_completo: string;
  tipo: string;
  doc_status?: 'ok' | 'pendente';
  docs_pendentes?: string[];
  // Dados para "Tornar Aluno"
  cpf?: string;
  data_nascimento?: string;
  sexo?: string;
  email?: string;
  celular?: string;
  telefone_alternativo?: string;
  telefone_responsavel?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado_uf?: string;
  cep?: string;
  nome_responsavel?: string;
  email_responsavel?: string;
  grau_parentesco?: string;
  cpf_responsavel?: string;
  possui_alergias?: string;
  cuidado_especial?: string;
  detalhes_cuidado?: string;
  uso_medicamento?: string;
  escolaridade?: string;
  turno_escolar?: string;
  ultima_freq_escolar?: string;
  auto_declaracao?: string;
}

interface Props {
  projetoId: string;
  inscricao: Inscricao | null;
  onClose: () => void;
  onRefresh: () => void;
}

// Comprime imagens no cliente antes do upload — evita 413 "File too large"
// PDFs e outros tipos são retornados sem alteração
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
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (b) => resolve(b ?? blob),
        'image/jpeg',
        0.85,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(blob); };
    img.src = url;
  });
}

export default function DrawerDocumentos({ projetoId, inscricao, onClose, onRefresh }: Props) {
  const [docs, setDocs]                   = useState<DocRecord[]>([]);
  const [loading, setLoading]             = useState(false);
  const [uploading, setUploading]         = useState<Record<string, boolean>>({});
  const [showDados, setShowDados]         = useState(false);
  const [cameraDoc, setCameraDoc]         = useState<string | null>(null);
  const [editandoNome, setEditandoNome]   = useState<string | null>(null);
  const [nomeTemp, setNomeTemp]           = useState('');
  const fileInputRef                      = useRef<HTMLInputElement>(null);
  const fileInputTipo                     = useRef('');
  const extraFileInputRef                 = useRef<HTMLInputElement>(null);

  // Tornar Aluno
  const [showTornarAluno, setShowTornarAluno]       = useState(false);
  const [cursos, setCursos]                         = useState<any[]>([]);
  const [carregandoCursos, setCarregandoCursos]     = useState(false);

  const carregarDocs = async () => {
    if (!inscricao) return;
    setLoading(true);
    try {
      const r = await api.get(`/projetos/${projetoId}/inscricoes/${inscricao.id}/documentos`);
      setDocs(r.data);
    } catch { toast.error('Erro ao carregar documentos'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (inscricao) carregarDocs();
  }, [inscricao?.id]);

  const uploadBlob = async (tipo: string, blob: Blob, filename?: string) => {
    if (!inscricao) return;
    setUploading(p => ({ ...p, [tipo]: true }));
    try {
      const ext = blob.type.includes('pdf') ? 'pdf' : 'jpg';
      const fd = new FormData();
      fd.append('arquivo', blob, filename ?? `${tipo}.${ext}`);
      fd.append('tipo', tipo);
      await api.post(`/projetos/${projetoId}/inscricoes/${inscricao.id}/documentos`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Toast de sucesso imediato — não depende do reload
      toast.success(`${LABELS_DOCS[tipo] ?? 'Documento'} salvo`);
      onRefresh();
      // Reload em background — erro de rede/413 não vira falso toast de falha
      carregarDocs().catch(() => {});
    } catch (err: any) {
      toast.error(err?.response?.data?.message || `Erro ao enviar documento`);
    } finally {
      setUploading(p => ({ ...p, [tipo]: false }));
      setCameraDoc(null);
    }
  };

  const remover = async (docId: string) => {
    if (!inscricao || !confirm('Remover este documento?')) return;
    setUploading(p => ({ ...p, [`del_${docId}`]: true }));
    try {
      await api.delete(`/projetos/${projetoId}/inscricoes/${inscricao.id}/documentos/${docId}`);
      await carregarDocs();
      onRefresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao remover documento');
    } finally {
      setUploading(p => ({ ...p, [`del_${docId}`]: false }));
    }
  };

  const salvarNome = async (docId: string) => {
    if (!inscricao) return;
    try {
      await api.patch(`/projetos/${projetoId}/inscricoes/${inscricao.id}/documentos/${docId}/nome`, { nome_arquivo: nomeTemp });
      setDocs(ds => ds.map(d => d.id === docId ? { ...d, nome_arquivo: nomeTemp.trim() || null } : d));
      setEditandoNome(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao renomear');
    }
  };

  const marcarFisico = async () => {
    if (!inscricao) return;
    setUploading(p => ({ ...p, fisico: true }));
    try {
      await api.post(`/projetos/${projetoId}/inscricoes/${inscricao.id}/documentos/declaracao-fisica`);
      await carregarDocs();
      onRefresh();
      toast.success('Declaração marcada como recebida');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao marcar declaração');
    } finally {
      setUploading(p => ({ ...p, fisico: false }));
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fileInputTipo.current) return;
    const raw = new Blob([file], { type: file.type });
    const blob = await compressImageBlob(raw);
    await uploadBlob(fileInputTipo.current, blob);
    e.target.value = '';
  };

  const colarDaArea = async (tipo: string) => {
    try {
      if (!navigator.clipboard?.read) {
        toast.error('Navegador não suporta leitura da área de transferência');
        return;
      }
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find(t => t.startsWith('image/'));
        if (imageType) {
          const raw = await item.getType(imageType);
          const blob = await compressImageBlob(raw);
          await uploadBlob(tipo, blob);
          return;
        }
      }
      toast.error('Nenhuma imagem na área de transferência. Para PDFs, use o botão de arquivo (↑)');
    } catch {
      toast.error('Permissão negada — verifique as permissões do navegador');
    }
  };

  const digitalizarDoc = async (tipo: string) => {
    const AGENT = 'http://localhost:7734';

    const agentUp = async () => {
      try {
        const r = await fetch(`${AGENT}/status`, { signal: AbortSignal.timeout(1500) });
        return r.ok;
      } catch { return false; }
    };

    const launchAgent = () => {
      const a = document.createElement('a');
      a.href = 'itpscan://start';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    const waitForAgent = async (maxMs = 12000): Promise<boolean> => {
      const t0 = Date.now();
      while (Date.now() - t0 < maxMs) {
        if (await agentUp()) return true;
        await new Promise(r => setTimeout(r, 1500));
      }
      return false;
    };

    try {
      let up = await agentUp();
      if (!up) {
        launchAgent();
        toast.loading('Iniciando scanner...', { id: 'scan-init' });
        up = await waitForAgent(12000);
        toast.dismiss('scan-init');
        if (!up) {
          toast.error('Scanner agent não instalado. Baixe em "Instalar Scanner" na página de Projetos.');
          return;
        }
      }

      const res = await fetch(`${AGENT}/scan`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err.error === 'cancelled') return;
        throw new Error(err.error || 'Erro ao digitalizar');
      }
      const { data } = await res.json();
      const imgRes = await fetch(data);
      const blob = await imgRes.blob();
      const compressed = await compressImageBlob(blob);
      await uploadBlob(tipo, compressed, 'digitalizado.jpg');
    } catch (e: any) {
      toast.error(e.message?.includes('fetch') || e.message?.includes('Failed')
        ? 'Scanner agent não instalado. Baixe em "Instalar Scanner" na página de Projetos.'
        : (e.message || 'Erro ao digitalizar'));
    }
  };

  const handleExtraFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const tipo = `extra_${Date.now()}`;
    const raw = new Blob([file], { type: file.type });
    const blob = await compressImageBlob(raw);
    await uploadBlob(tipo, blob, file.name);
    e.target.value = '';
  };

  const abrirTornarAluno = async () => {
    if (cursos.length === 0) {
      setCarregandoCursos(true);
      try {
        const r = await api.get('/matriculas/cursos-ativos-academico');
        setCursos(r.data);
      } catch {
        toast.error('Erro ao carregar cursos disponíveis');
        setCarregandoCursos(false);
        return;
      }
      setCarregandoCursos(false);
    }
    setShowTornarAluno(true);
  };

  const handleTornarAlunoSuccess = async (alunoId: string) => {
    if (!inscricao) return;
    try {
      await api.patch(`/projetos/${projetoId}/inscricoes/${inscricao.id}`, {
        aluno_id: alunoId,
        tipo: 'regular',
      });
      toast.success('Inscrito convertido para aluno ITP!');
      onRefresh();
      setShowTornarAluno(false);
      onClose();
    } catch {
      toast.error('Aluno criado. Vincule manualmente em Matrículas se necessário.');
    }
  };

  if (!inscricao) return null;
  const isExterno = inscricao.tipo === 'externo';
  const docMap = Object.fromEntries(docs.map(d => [d.tipo, d]));
  const extraDocs = docs.filter(d => d.tipo.startsWith('extra'));

  const initialDataParaAluno: Record<string, any> = {
    nome_completo:       inscricao.nome_completo || '',
    cpf:                 inscricao.cpf || '',
    data_nascimento:     inscricao.data_nascimento || '',
    sexo:                inscricao.sexo || '',
    email:               inscricao.email || '',
    celular:             inscricao.celular || inscricao.telefone_responsavel || '',
    telefone_alternativo: inscricao.telefone_alternativo || '',
    logradouro:          inscricao.logradouro || '',
    numero:              inscricao.numero || '',
    complemento:         inscricao.complemento || '',
    bairro:              inscricao.bairro || '',
    cidade:              inscricao.cidade || '',
    estado_uf:           inscricao.estado_uf || '',
    cep:                 inscricao.cep || '',
    nome_responsavel:    inscricao.nome_responsavel || '',
    email_responsavel:   inscricao.email_responsavel || '',
    grau_parentesco:     inscricao.grau_parentesco || '',
    cpf_responsavel:     inscricao.cpf_responsavel || '',
    possui_alergias:     inscricao.possui_alergias || 'Não',
    cuidado_especial:    inscricao.cuidado_especial || 'Não',
    detalhes_cuidado:    inscricao.detalhes_cuidado || '',
    uso_medicamento:     inscricao.uso_medicamento || 'Não',
    escolaridade:        inscricao.escolaridade || '',
    turno_escolar:       inscricao.turno_escolar || '',
    ultima_freq_escolar: inscricao.ultima_freq_escolar || '',
    auto_declaracao:     inscricao.auto_declaracao || '',
  };

  return (
    <>
      {cameraDoc && (
        <DocumentCamera
          tipo={cameraDoc}
          onCapture={blob => uploadBlob(cameraDoc, blob)}
          onClose={() => setCameraDoc(null)}
        />
      )}

      {showTornarAluno && (
        <CadastroDiretoModal
          cursosAcademico={cursos}
          initialData={initialDataParaAluno}
          onClose={() => setShowTornarAluno(false)}
          onSuccess={() => {}}
          onSuccessWithId={handleTornarAlunoSuccess}
        />
      )}

      {/* Backdrop */}
      <div className="fixed inset-0 z-[350] bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-[360] w-full max-w-sm bg-white dark:bg-slate-900 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="min-w-0 mr-2">
            <h3 className="font-black text-sm text-slate-800 dark:text-slate-100 truncate">{inscricao.nome_completo}</h3>
            <p className="text-[10px] mt-0.5">
              <span className="text-slate-400">{isExterno ? 'Externo' : 'Aluno ITP'} · </span>
              {inscricao.doc_status === 'ok'
                ? <span className="text-green-600 font-bold">Documentação OK</span>
                : <span className="text-orange-500 font-bold">Docs pendentes</span>
              }
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isExterno && (
              <button
                onClick={abrirTornarAluno}
                disabled={carregandoCursos}
                title="Converter para aluno ITP"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-[10px] font-black hover:bg-green-200 transition-colors disabled:opacity-60">
                {carregandoCursos
                  ? <Loader2 size={12} className="animate-spin" />
                  : <UserPlus size={12} />
                }
                Tornar Aluno
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <p className="py-12 text-center text-slate-400 text-xs">Carregando...</p>
          ) : (
            <>
              {!isExterno && inscricao.docs_pendentes?.length ? (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-xl p-3 mb-2 text-xs text-blue-700 dark:text-blue-300">
                  Documentos pendentes: <strong>{inscricao.docs_pendentes.map(t => LABELS_DOCS[t]).join(', ')}</strong>. Envie diretamente aqui ou pela ficha em Matrículas.
                </div>
              ) : null}

              {/* Dados pessoais do externo — colapsável */}
              {isExterno && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden mb-1">
                  <button
                    onClick={() => setShowDados(p => !p)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Dados Pessoais</span>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${showDados ? 'rotate-180' : ''}`} />
                  </button>
                  {showDados && (
                    <div className="px-4 py-3 space-y-1.5 bg-white dark:bg-slate-900/40">
                      {[
                        ['Nome', inscricao.nome_completo],
                        ['CPF', inscricao.cpf],
                        ['Nascimento', inscricao.data_nascimento],
                        ['Sexo', inscricao.sexo],
                        ['Celular', inscricao.celular || inscricao.telefone_responsavel],
                        ['Email', inscricao.email],
                        ['Endereço', [inscricao.logradouro, inscricao.numero].filter(Boolean).join(', ')],
                        ['Bairro', inscricao.bairro],
                        ['Cidade/UF', [inscricao.cidade, inscricao.estado_uf].filter(Boolean).join(' / ')],
                        ['CEP', inscricao.cep],
                        ['Responsável', inscricao.nome_responsavel],
                        ['Tel. Resp.', inscricao.telefone_responsavel],
                        ['Email Resp.', inscricao.email_responsavel],
                        ['Parentesco', inscricao.grau_parentesco],
                        ['CPF Resp.', inscricao.cpf_responsavel],
                        ['Cuidado especial', inscricao.cuidado_especial],
                        ['Detalhes', inscricao.detalhes_cuidado],
                        ['Alergias', inscricao.possui_alergias],
                        ['Medicamento', inscricao.uso_medicamento],
                        ['Escolaridade', inscricao.escolaridade],
                        ['Turno', inscricao.turno_escolar],
                      ].filter(([, v]) => v).map(([label, value]) => (
                        <div key={label as string} className="flex gap-2">
                          <span className="text-[10px] text-slate-400 w-24 shrink-0">{label}</span>
                          <span className="text-[10px] text-slate-700 dark:text-slate-300 font-medium break-all">{value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Documentos obrigatórios/padrão */}
              {TIPOS_DOCS.map(tipo => {
                const doc    = docMap[tipo];
                const fisico = !!doc?.fisico;
                const busy   = uploading[tipo];
                const obrig  = OBRIGATORIOS.includes(tipo as any);

                return (
                  <div key={tipo}
                    className={`rounded-xl border p-3 flex items-center gap-3 transition-colors
                      ${doc
                        ? 'border-green-200 dark:border-green-800/50 bg-green-50/50 dark:bg-green-900/10'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40'
                      }`}>

                    {doc?.signed_url && !fisico
                      ? (
                        <a href={doc.signed_url} target="_blank" rel="noopener noreferrer"
                          className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:ring-2 hover:ring-blue-400 transition-all"
                          title="Clique para abrir">
                          <DocThumb signedUrl={doc.signed_url} fisico={fisico} hasDoc={!!doc} obrig={obrig} mimetype={doc?.mimetype} />
                        </a>
                      ) : (
                        <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                          <DocThumb signedUrl={doc?.signed_url} fisico={fisico} hasDoc={!!doc} obrig={obrig} mimetype={doc?.mimetype} />
                        </div>
                      )
                    }

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{LABELS_DOCS[tipo]}</p>
                      <p className={`text-[10px] font-bold mt-0.5
                        ${fisico     ? 'text-blue-600'
                        : doc        ? 'text-green-600'
                        : obrig      ? 'text-orange-500'
                        :              'text-slate-400'}`}>
                        {fisico ? 'Recebida fisicamente'
                          : doc?.source === 'matriculas' ? 'Via Matrículas'
                          : doc
                            ? <>Enviado{doc.tamanho_bytes ? <span className="text-slate-400 font-normal"> · {fmtBytes(doc.tamanho_bytes)}</span> : null}</>
                            : obrig ? 'Pendente' : 'Opcional'}
                      </p>
                    </div>

                    {/* Mostrar ações quando: doc ainda não existe OU foi enviado direto no projeto (não via matrículas) */}
                    {(!doc || doc.source !== 'matriculas') && (
                      <div className="flex items-center gap-1 shrink-0">
                        {busy && <span className="text-[10px] text-slate-400 animate-pulse px-2">Enviando...</span>}
                        {!busy && (
                          <>
                            <button onClick={() => setCameraDoc(tipo)} title={doc ? 'Substituir via câmera' : 'Fotografar'}
                              className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 hover:bg-purple-200 transition-colors">
                              <Camera size={13} />
                            </button>
                            <button onClick={() => { fileInputTipo.current = tipo; fileInputRef.current?.click(); }} title={doc ? 'Substituir via arquivo' : 'Upload arquivo'}
                              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                              <Upload size={13} />
                            </button>
                            <button onClick={() => colarDaArea(tipo)} title={doc ? 'Substituir da área de transferência' : 'Colar da área de transferência'}
                              className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 hover:bg-amber-200 transition-colors">
                              <Clipboard size={13} />
                            </button>
                            <button onClick={() => digitalizarDoc(tipo)} title="Digitalizar com scanner"
                              className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/30 text-teal-600 hover:bg-teal-200 transition-colors">
                              <ScanLine size={13} />
                            </button>
                            {!doc && tipo === 'declaracao_escolar' && (
                              <button
                                onClick={marcarFisico}
                                disabled={!!uploading['fisico']}
                                className="px-2 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 hover:bg-blue-200 text-[9px] font-black uppercase disabled:opacity-40">
                                {uploading['fisico'] ? '...' : 'Físico'}
                              </button>
                            )}
                            {doc && doc.source !== 'matriculas' && (
                              <button
                                onClick={() => remover(doc.id)}
                                disabled={!!uploading[`del_${doc.id}`]}
                                className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-40">
                                {uploading[`del_${doc.id}`]
                                  ? <Loader2 size={13} className="animate-spin" />
                                  : <Trash2 size={13} />
                                }
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Documentos extras */}
              {(
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Documentos Extras</p>
                    <div className="flex gap-1">
                      <button
                        onClick={() => colarDaArea(`extra_${Date.now()}`)}
                        title="Colar da área de transferência"
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 hover:bg-amber-200 transition-colors text-[10px] font-black">
                        <Clipboard size={11} /> Colar
                      </button>
                      <button
                        onClick={() => extraFileInputRef.current?.click()}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-[10px] font-black">
                        <PlusCircle size={11} /> Arquivo
                      </button>
                      <button
                        onClick={() => digitalizarDoc(`extra_${Date.now()}`)}
                        title="Digitalizar com scanner"
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-100 dark:bg-teal-900/30 text-teal-600 hover:bg-teal-200 transition-colors text-[10px] font-black">
                        <ScanLine size={11} /> Scan
                      </button>
                    </div>
                  </div>

                  {extraDocs.length === 0 && (
                    <p className="text-[10px] text-slate-400 text-center py-2">Nenhum documento extra</p>
                  )}

                  {extraDocs.map((doc, i) => {
                    const busy = uploading[doc.tipo];
                    const isPdf = doc.mimetype === 'application/pdf' || doc.signed_url?.toLowerCase().includes('.pdf');
                    return (
                      <div key={doc.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 p-3 flex items-center gap-3 mb-1.5">
                        {doc.signed_url
                          ? (
                            <a href={doc.signed_url} target="_blank" rel="noopener noreferrer"
                              className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:ring-2 hover:ring-blue-400 transition-all"
                              title="Clique para abrir">
                              {isPdf
                                ? <FileText size={16} className="text-blue-600" />
                                : <img src={doc.signed_url} alt="" className="w-full h-full object-cover" />
                              }
                            </a>
                          ) : (
                            <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                              <CheckCircle2 size={16} className="text-green-500" />
                            </div>
                          )
                        }
                        <div className="flex-1 min-w-0">
                          {editandoNome === doc.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                autoFocus
                                value={nomeTemp}
                                onChange={e => setNomeTemp(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') salvarNome(doc.id); if (e.key === 'Escape') setEditandoNome(null); }}
                                className="flex-1 text-xs border border-blue-400 rounded px-1.5 py-0.5 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 outline-none min-w-0"
                              />
                              <button onClick={() => salvarNome(doc.id)} className="p-1 text-green-600 hover:text-green-700"><Check size={13} /></button>
                              <button onClick={() => setEditandoNome(null)} className="p-1 text-slate-400 hover:text-slate-600"><X size={13} /></button>
                            </div>
                          ) : (
                            <div className="flex items-start gap-1 group">
                              <p className="text-xs font-bold text-slate-700 dark:text-slate-200 break-words min-w-0">
                                {doc.nome_arquivo || `Extra ${i + 1}`}
                              </p>
                              <button
                                onClick={() => { setEditandoNome(doc.id); setNomeTemp(doc.nome_arquivo || ''); }}
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-blue-500 transition-opacity">
                                <Pencil size={11} />
                              </button>
                            </div>
                          )}
                          <p className="text-[10px] text-green-600 font-bold">
                            Enviado{doc.tamanho_bytes ? <span className="text-slate-400 font-normal"> · {fmtBytes(doc.tamanho_bytes)}</span> : null}
                          </p>
                        </div>
                        {!busy && editandoNome !== doc.id && (
                          <button
                            onClick={() => remover(doc.id)}
                            disabled={!!uploading[`del_${doc.id}`]}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-40">
                            {uploading[`del_${doc.id}`]
                              ? <Loader2 size={13} className="animate-spin" />
                              : <Trash2 size={13} />
                            }
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <input ref={fileInputRef} type="file" accept="image/*,.pdf,application/pdf" className="hidden" onChange={handleFile} />
        <input ref={extraFileInputRef} type="file" accept="image/*,.pdf,application/pdf" className="hidden" onChange={handleExtraFile} />
      </div>
    </>
  );
}
