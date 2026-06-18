'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Trash2, Camera, CheckCircle2, AlertCircle, FileCheck, FileText, UserPlus, PlusCircle, Loader2, Clipboard } from 'lucide-react';
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
  source?: 'matriculas' | 'projetos';
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

export default function DrawerDocumentos({ projetoId, inscricao, onClose, onRefresh }: Props) {
  const [docs, setDocs]                   = useState<DocRecord[]>([]);
  const [loading, setLoading]             = useState(false);
  const [uploading, setUploading]         = useState<Record<string, boolean>>({});
  const [cameraDoc, setCameraDoc]         = useState<string | null>(null);
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
    try {
      await api.delete(`/projetos/${projetoId}/inscricoes/${inscricao.id}/documentos/${docId}`);
      await carregarDocs();
      onRefresh();
    } catch { toast.error('Erro ao remover documento'); }
  };

  const marcarFisico = async () => {
    if (!inscricao) return;
    try {
      await api.post(`/projetos/${projetoId}/inscricoes/${inscricao.id}/documentos/declaracao-fisica`);
      await carregarDocs();
      onRefresh();
      toast.success('Declaração marcada como recebida');
    } catch { toast.error('Erro ao marcar declaração'); }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fileInputTipo.current) return;
    await uploadBlob(fileInputTipo.current, new Blob([file], { type: file.type }));
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
          const blob = await item.getType(imageType);
          await uploadBlob(tipo, blob);
          return;
        }
      }
      toast.error('Nenhuma imagem na área de transferência');
    } catch {
      toast.error('Permissão negada — verifique as permissões do navegador');
    }
  };

  const handleExtraFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const tipo = `extra_${Date.now()}`;
    await uploadBlob(tipo, new Blob([file], { type: file.type }), file.name);
    e.target.value = '';
  };

  const abrirTornarAluno = async () => {
    if (cursos.length === 0) {
      setCarregandoCursos(true);
      try {
        const r = await api.get('/matriculas/cursos-ativos-academico');
        setCursos(r.data);
      } catch {
        toast.error('Erro ao carregar cursos');
      } finally {
        setCarregandoCursos(false);
      }
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
              {!isExterno && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-xl p-3 mb-2 text-xs text-blue-700 dark:text-blue-300">
                  {inscricao.docs_pendentes?.length
                    ? <>Documentos pendentes: <strong>{inscricao.docs_pendentes.map(t => LABELS_DOCS[t]).join(', ')}</strong>. Acesse a ficha do aluno em Matrículas para enviar.</>
                    : 'Todos os documentos do aluno estão OK.'
                  }
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

                    <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                      <DocThumb signedUrl={doc?.signed_url} fisico={fisico} hasDoc={!!doc} obrig={obrig} mimetype={doc?.mimetype} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{LABELS_DOCS[tipo]}</p>
                      <p className={`text-[10px] font-bold mt-0.5
                        ${fisico     ? 'text-blue-600'
                        : doc        ? 'text-green-600'
                        : obrig      ? 'text-orange-500'
                        :              'text-slate-400'}`}>
                        {fisico ? 'Recebida fisicamente' : doc?.source === 'matriculas' ? 'Via Matrículas' : doc ? 'Enviado' : obrig ? 'Pendente' : 'Opcional'}
                      </p>
                    </div>

                    {isExterno && (
                      <div className="flex items-center gap-1 shrink-0">
                        {busy && <span className="text-[10px] text-slate-400 animate-pulse px-2">Enviando...</span>}
                        {!busy && !doc && (
                          <>
                            <button onClick={() => setCameraDoc(tipo)} title="Fotografar"
                              className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 hover:bg-purple-200 transition-colors">
                              <Camera size={13} />
                            </button>
                            <button onClick={() => { fileInputTipo.current = tipo; fileInputRef.current?.click(); }} title="Upload arquivo"
                              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                              <Upload size={13} />
                            </button>
                            <button onClick={() => colarDaArea(tipo)} title="Colar da área de transferência"
                              className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 hover:bg-amber-200 transition-colors">
                              <Clipboard size={13} />
                            </button>
                            {tipo === 'declaracao_escolar' && (
                              <button onClick={marcarFisico}
                                className="px-2 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 hover:bg-blue-200 text-[9px] font-black uppercase">
                                Físico
                              </button>
                            )}
                          </>
                        )}
                        {!busy && doc && (
                          <>
                            <button onClick={() => setCameraDoc(tipo)} title="Substituir"
                              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                              <Camera size={13} />
                            </button>
                            <button onClick={() => remover(doc.id)}
                              className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors">
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Documentos extras */}
              {isExterno && (
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
                    </div>
                  </div>

                  {extraDocs.length === 0 && (
                    <p className="text-[10px] text-slate-400 text-center py-2">Nenhum documento extra</p>
                  )}

                  {extraDocs.map((doc, i) => {
                    const busy = uploading[doc.tipo];
                    const isPdf = doc.mimetype === 'application/pdf' || doc.url_arquivo?.toLowerCase().includes('.pdf');
                    return (
                      <div key={doc.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 p-3 flex items-center gap-3 mb-1.5">
                        <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                          {isPdf
                            ? <a href={doc.signed_url ?? '#'} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                                <FileText size={16} className="text-blue-600" />
                              </a>
                            : doc.signed_url
                              ? <img src={doc.signed_url} alt="" className="w-full h-full object-cover" />
                              : <CheckCircle2 size={16} className="text-green-500" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">Extra {i + 1}</p>
                          <p className="text-[10px] text-green-600 font-bold">Enviado</p>
                        </div>
                        {!busy && (
                          <button onClick={() => remover(doc.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors">
                            <Trash2 size={13} />
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
