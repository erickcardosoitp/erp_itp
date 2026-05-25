"use client";
import React, { useState, useEffect, useCallback } from 'react';
import {
  X, User, Camera, Edit3, CheckCircle, Save,
  MessageSquare, AlertTriangle, Send, Loader2,
  History, Paperclip, ShieldCheck, ChevronRight, Phone,
  Download, ExternalLink, Trash2, FileWarning, ClipboardCheck,
  FileText, BookOpen, MapPin,
} from 'lucide-react';

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api')
  .replace(/\/api$/, '')
  .replace(/\/backend-api$/, '');

const safeUrl = (url: string): string => {
  if (url.startsWith('data:image/') || url.startsWith('data:application/pdf')) return url;
  try {
    const u = new URL(url, window.location.origin);
    if (u.protocol === 'http:' || u.protocol === 'https:') return url;
  } catch { /* URL relativa */ }
  if (url.startsWith('/')) return url;
  return '#';
};

import api from '@/services/api';

interface DocEnviado {
  id: string;
  tipo: string;
  nome_extra: string | null;
  url_arquivo: string;
  mimetype: string | null;
  tamanho_bytes: number | null;
  createdAt: string;
}

interface Anotacao {
  id: number;
  texto_anotacao: string;
  usuario_nome: string;
  usuario_foto?: string;
  created_at: string;
}

interface Movimentacao {
  id: number;
  usuario_nome: string;
  tipo: string;
  categoria: string;
  valor_antes: string;
  valor_depois: string;
  created_at: string;
}

interface InscricaoData {
  id: number;
  idade: number;
  maior_18_anos?: boolean;
  status_matricula: string;
  nome_completo: string;
  cpf: string;
  email: string;
  lgpd_aceito: boolean;
  foto_url?: string;
  cidade?: string;
  bairro?: string;
  celular?: string;
  data_inscricao?: string;
  data_nascimento?: string;
  cursos_desejados?: string;
  url_documentos_zip?: string;
  url_termo_lgpd?: string;
  cuidado_especial?: string;
  auto_declaracao?: string;
  orientacao_sexual?: string;
  [key: string]: any;
}

interface FichaData {
  aluno: any;
  inscricao_id?: number | null;
  frequencia?: any[];
  historico?: any[];
  turmasDoAluno?: any[];
  totalPresencas?: number;
  totalFaltas?: number;
  foto_url?: string | null;
  complemento?: Record<string, string> | null;
  auto_declaracao?: string | null;
}

interface DossieProps {
  aluno: InscricaoData;
  onClose: () => void;
  onSuccess?: () => void;
  fichaData?: FichaData;
}

const STATUS_BADGE: Record<string, string> = {
  'Pendente':                   'bg-gray-100 text-gray-600 border-gray-300',
  'Aguardando Assinatura LGPD': 'bg-orange-50 text-orange-700 border-orange-300',
  'Em Validação':               'bg-blue-50 text-blue-700 border-blue-300',
  'Aguardando Documentos':      'bg-amber-50 text-amber-700 border-amber-300',
  'Documentos Enviados':        'bg-cyan-50 text-cyan-700 border-cyan-300',
  'Matriculado':                'bg-green-50 text-green-700 border-green-300',
  'Incompleto':                 'bg-red-50 text-red-700 border-red-300',
  'Desistente':                 'bg-gray-100 text-gray-500 border-gray-300',
  'Cancelada':                  'bg-red-100 text-red-800 border-red-300',
};

export default function DossieCandidato({ aluno, onClose, onSuccess, fichaData }: DossieProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<InscricaoData>({ ...aluno });
  const [loading, setLoading] = useState(false);

  type TabId = 'cadastro' | 'anotacoes' | 'movimentacoes' | 'documentos' | 'presenca';
  const [abaAtiva, setAbaAtiva] = useState<TabId>('cadastro');

  const [cursosAcademico, setCursosAcademico] = useState<Array<{ id: string; nome: string; sigla: string; turmas: Array<{ id: string; nome: string; codigo: string }> }>>([]);
  const [cursosCarregados, setCursosCarregados] = useState(false);
  const [cursosSelecionados, setCursosSelecionados] = useState<string[]>([]);
  const [anotacoes, setAnotacoes] = useState<Anotacao[]>([]);
  const [novaAnotacaoTexto, setNovaAnotacaoTexto] = useState('');
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);

  const [showMotivoModal, setShowMotivoModal] = useState<{ show: boolean; status: string | null }>({ show: false, status: null });
  const [motivoTexto, setMotivoTexto] = useState('');
  const [lgpdLoading, setLgpdLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [docLoading, setDocLoading] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<DocEnviado[]>([]);
  const [obrigatoriosPendentes, setObrigatoriosPendentes] = useState<string[]>([]);
  const [docsCompleto, setDocsCompleto] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [matriculaNumero, setMatriculaNumero] = useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadTipo, setUploadTipo] = useState('identidade');
  const [uploadNomeExtra, setUploadNomeExtra] = useState('');
  const [complemento, setComplemento] = useState<Record<string, string>>({
    rg: '', orgao_expedidor: '', uf_expedicao: '', genero: '', orientacao_sexual: '',
    banco: '', agencia: '', agencia_digito: '', conta_corrente: '', conta_digito: '', tipo_conta: '',
    nome_mae: '',
  });
  const [complementoCarregado, setComplementoCarregado] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  const erroMaioridade = formData.idade < 18 && formData.maior_18_anos === true;

  const recarregarDocumentos = useCallback(() => {
    if (!formData.id) return;
    setLoadingDocs(true);
    api.get(`/matriculas/inscricao/${formData.id}/documentos`)
      .then(res => {
        setUploadedDocs(res.data?.documentos ?? []);
        setObrigatoriosPendentes(res.data?.obrigatorios_pendentes ?? []);
        setDocsCompleto(res.data?.completo ?? false);
      })
      .catch(() => { setUploadedDocs([]); setObrigatoriosPendentes([]); setDocsCompleto(false); })
      .finally(() => setLoadingDocs(false));
  }, [formData.id]);

  useEffect(() => {
    if (abaAtiva !== 'documentos') return;
    recarregarDocumentos();
  }, [abaAtiva, recarregarDocumentos]);

  useEffect(() => {
    if (!aluno?.id) return;
    const load = async () => {
      setLoading(true);
      try {
        const [resInscricao, resCursos, resAnot, resMov, resDocs] = await Promise.allSettled([
          api.get(`/matriculas/inscricao/${aluno.id}`),
          api.get('/matriculas/cursos-ativos-academico'),
          api.get(`/matriculas/inscricao/${aluno.id}/anotacoes`),
          api.get(`/matriculas/inscricao/${aluno.id}/movimentacoes`),
          api.get(`/matriculas/inscricao/${aluno.id}/documentos`),
        ]);
        if (resInscricao.status === 'fulfilled') {
          const inscData = resInscricao.value.data;
          setFormData(inscData);
          const alunoUuid = inscData?.aluno?.id;
          if (alunoUuid) {
            api.get(`/alunos/${alunoUuid}/complemento`).then(r => {
              if (r.data) setComplemento(prev => ({ ...prev, ...r.data }));
            }).catch(() => {});
            if (inscData.aluno?.auto_declaracao) {
              setFormData(prev => ({ ...prev, auto_declaracao: inscData.aluno.auto_declaracao }));
            }
            setComplementoCarregado(true);
          }
        }
        if (resCursos.status === 'fulfilled') {
          setCursosAcademico(Array.isArray(resCursos.value.data) ? resCursos.value.data : []);
        }
        setCursosCarregados(true);
        if (resAnot.status === 'fulfilled') setAnotacoes(resAnot.value.data);
        if (resMov.status === 'fulfilled') setMovimentacoes(resMov.value.data);
        if (resDocs.status === 'fulfilled') {
          setUploadedDocs(resDocs.value.data?.documentos ?? []);
          setObrigatoriosPendentes(resDocs.value.data?.obrigatorios_pendentes ?? []);
          setDocsCompleto(resDocs.value.data?.completo ?? false);
        }
      } catch (e: any) {
        console.error('Erro no load do Dossiê:', e.response?.status);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [aluno.id]);

  useEffect(() => {
    if (!fichaData) return;
    if (fichaData.complemento) {
      setComplemento(prev => ({ ...prev, ...fichaData.complemento }));
      setComplementoCarregado(true);
    }
    if (fichaData.auto_declaracao) {
      setFormData(prev => ({ ...prev, auto_declaracao: fichaData.auto_declaracao! }));
    }
  }, [fichaData]);

  const handleUpdateStatus = async (novoStatus: string, motivo?: string) => {
    setLoading(true);
    try {
      await api.patch(`/matriculas/${aluno.id}/status`, { status: novoStatus, motivo });
      onSuccess?.();
      onClose();
    } catch (e: any) {
      alert('Erro ao atualizar status: ' + (e.response?.data?.message || e.message));
    } finally {
      setLoading(false);
    }
  };

  const handleEnviarLGPD = async () => {
    setLgpdLoading(true);
    try {
      await api.patch(`/matriculas/${aluno.id}/enviar-lgpd`);
      if (formData.status_matricula !== 'Matriculado') {
        setFormData(prev => ({ ...prev, status_matricula: 'Aguardando Assinatura LGPD' }));
      }
    } catch (e: any) {
      alert('Erro ao enviar termo LGPD: ' + (e.response?.data?.message || e.message));
    } finally {
      setLgpdLoading(false);
    }
  };

  const gerarPdfLGPD = async () => {
    setPdfLoading(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const margin = 20;
      const pageW = 210;
      const contentW = pageW - margin * 2;
      let y = 20;

      const addText = (text: string, size: number, bold = false, color = '#000000') => {
        doc.setFontSize(size);
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setTextColor(color);
        const lines = doc.splitTextToSize(text, contentW);
        doc.text(lines, margin, y);
        y += lines.length * (size * 0.4) + 3;
      };
      const addLine = () => {
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, y, pageW - margin, y);
        y += 4;
      };

      doc.setFillColor(30, 58, 95);
      doc.rect(0, 0, pageW, 28, 'F');
      doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor('#FFFFFF');
      doc.text('Instituto Tia Pretinha', margin, 12);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text('CNPJ nº 11.759.851/0001-39', margin, 19);
      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text('Termo de Autorização de Uso de Imagem, Voz e Tratamento de Dados', margin, 25);
      y = 36;

      addText('DADOS DO CANDIDATO / RESPONSÁVEL', 9, true, '#1e3a5f');
      addLine();
      addText(`Candidato(a): ${formData.nome_completo}`, 10);
      if (formData.cpf) addText(`CPF: ${formData.cpf}`, 10);
      if (formData.maior_18_anos === false && formData.nome_responsavel) {
        addText(`Responsável: ${formData.nome_responsavel}`, 10);
        if (formData.cpf_responsavel) addText(`CPF do Responsável: ${formData.cpf_responsavel}`, 10);
      }
      y += 4;

      const secoes = [
        { num: '1', titulo: 'Autorização de Uso de Imagem e Voz', texto: 'Autorizo o INSTITUTO TIA PRETINHA a captar, registrar, utilizar e divulgar imagens, vídeos, gravações de áudio e demais registros audiovisuais do participante obtidos durante atividades institucionais.' },
        { num: '2', titulo: 'Divulgação em Meios de Comunicação', texto: 'Estou ciente de que os registros poderão ser utilizados em materiais institucionais e canais de comunicação do Instituto, incluindo redes sociais, website institucional, relatórios e publicações.' },
        { num: '3', titulo: 'Armazenamento em Ambiente Digital (Cloud)', texto: 'Declaro estar ciente de que dados pessoais, imagens, vídeos e documentos poderão ser armazenados em sistemas eletrônicos e plataformas de armazenamento em nuvem utilizados pela instituição.' },
        { num: '4', titulo: 'Tratamento de Dados Pessoais (LGPD)', texto: 'Estou ciente de que os dados pessoais coletados poderão ser utilizados pelo Instituto para cadastro, gestão administrativa, comunicação e prestação de contas. O tratamento observará a LGPD.' },
        { num: '5', titulo: 'Gratuidade da Autorização', texto: 'A presente autorização é concedida de forma gratuita, não sendo devida qualquer remuneração.' },
        { num: '6', titulo: 'Prazo da Autorização', texto: 'A autorização possui prazo indeterminado, podendo ser utilizada enquanto os registros forem necessários para fins institucionais.' },
        { num: '7', titulo: 'Direito de Revogação', texto: 'O titular poderá solicitar a revogação desta autorização a qualquer momento, mediante solicitação formal ao Instituto.' },
      ];
      for (const s of secoes) {
        if (y > 240) { doc.addPage(); y = 20; }
        addText(`${s.num}. ${s.titulo}`, 10, true, '#1e3a5f');
        addText(s.texto, 9);
        y += 2;
      }

      if (y > 200) { doc.addPage(); y = 20; }
      y += 4;
      addText('REGISTRO DE ASSINATURA ELETRÔNICA', 9, true, '#1e3a5f');
      addLine();
      const dataAssinatura = formData.data_assinatura_lgpd ? new Date(formData.data_assinatura_lgpd).toLocaleString('pt-BR') : '—';
      addText(`Assinado por: ${formData.nome_assinatura_imagem || formData.nome_completo}`, 10);
      addText(`Data e hora: ${dataAssinatura}`, 10);
      if (formData.lgpd_ip) addText(`Endereço IP: ${formData.lgpd_ip}`, 10);
      if (formData.lgpd_user_agent) {
        const ua = String(formData.lgpd_user_agent);
        addText(`Navegador: ${ua.length > 120 ? ua.substring(0, 120) + '…' : ua}`, 9);
      }
      y += 6;
      addText('Este documento tem validade jurídica conforme Lei nº 14.063/2020.', 8, false, '#666666');
      addText('Instituto Tia Pretinha · CNPJ 11.759.851/0001-39', 8, false, '#666666');
      doc.save(`LGPD_${formData.nome_completo.replace(/\s+/g, '_')}_${new Date().getFullYear()}.pdf`);
    } catch (e: any) {
      alert('Erro ao gerar PDF: ' + e.message);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleSolicitarDocumentos = async () => {
    setDocLoading(true);
    try {
      await api.post(`/matriculas/inscricao/${aluno.id}/enviar-link-documentos`);
      setFormData(prev => ({ ...prev, doc_token: 'enviado' }));
    } catch (e: any) {
      alert('Erro ao enviar link de documentos: ' + (e.response?.data?.message || e.message));
    } finally {
      setDocLoading(false);
    }
  };

  const handleEfetivarMatricula = async () => {
    if (cursosSelecionados.length === 0) return;
    setLoading(true);
    try {
      const res = await api.post(`/matriculas/${aluno.id}/finalizar`, { turma_ids: cursosSelecionados });
      setMatriculaNumero(res.data?.numero_matricula ?? null);
      setFormData(prev => ({ ...prev, status_matricula: 'Matriculado' }));
      onSuccess?.();
    } catch (e: any) {
      alert('Falha na efetivação: ' + (e.response?.data?.message || e.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    setLoading(true);
    try {
      await api.patch(`/matriculas/inscricao/${aluno.id}`, formData);
      const alunoUuid = formData?.aluno?.id;
      if (alunoUuid && complementoCarregado) {
        const { auto_declaracao: _ad, orientacao_sexual: _os, ...camposComplemento } = complemento;
        const complementoFiltrado = Object.fromEntries(
          Object.entries(camposComplemento).filter(([, v]) => v !== '' && v !== null && v !== undefined)
        );
        const reqs: Promise<any>[] = [api.patch(`/alunos/${alunoUuid}/complemento`, complementoFiltrado)];
        if (formData.auto_declaracao) reqs.push(api.patch(`/alunos/${alunoUuid}/auto-declaracao`, { auto_declaracao: formData.auto_declaracao }));
        if (complemento.orientacao_sexual) reqs.push(api.patch(`/alunos/${alunoUuid}/complemento`, { orientacao_sexual: complemento.orientacao_sexual }));
        const results = await Promise.allSettled(reqs);
        const falhou = results.find(r => r.status === 'rejected') as PromiseRejectedResult | undefined;
        if (falhou) {
          const msg = (falhou.reason as any)?.response?.data?.message || 'Erro ao salvar dados especiais.';
          alert(`Dados principais salvos, mas dados especiais falharam.\n${msg}`);
        }
      }
      setIsEditing(false);
      const resMov = await api.get(`/matriculas/inscricao/${aluno.id}/movimentacoes`);
      setMovimentacoes(resMov.data);
      onSuccess?.();
    } catch (e: any) {
      alert('Erro ao salvar: ' + (e.response?.data?.message || e.message));
    } finally {
      setLoading(false);
    }
  };

  const handleAddAnotacao = async () => {
    if (!novaAnotacaoTexto.trim()) return;
    setLoading(true);
    try {
      const res = await api.post(`/matriculas/inscricao/${aluno.id}/anotacoes`, { texto_anotacao: novaAnotacaoTexto });
      setAnotacoes(prev => [res.data, ...prev]);
      setNovaAnotacaoTexto('');
    } catch (e: any) {
      alert('Erro ao anotar: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = useCallback((field: string, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'data_nascimento' && value) {
        const d = new Date(value + 'T12:00:00');
        if (!isNaN(d.getTime())) {
          const hoje = new Date();
          let idade = hoje.getFullYear() - d.getFullYear();
          const m = hoje.getMonth() - d.getMonth();
          if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) idade--;
          updated.idade = idade;
          updated.maior_18_anos = idade >= 18;
        }
      }
      return updated;
    });
  }, []);

  const buscarCep = useCallback(async (cep: string) => {
    const limpo = cep.replace(/\D/g, '');
    if (limpo.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          logradouro: data.logradouro || prev.logradouro,
          bairro: data.bairro || prev.bairro,
          cidade: data.localidade || prev.cidade,
          estado_uf: data.uf || prev.estado_uf,
        }));
      }
    } catch { /* silencia */ }
    finally { setBuscandoCep(false); }
  }, []);

  const fmtDate = (v?: string | null) => {
    if (!v) return '—';
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return v;
    const s = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v + 'T12:00:00' : v;
    const d = new Date(s);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
  };
  const fmtDateTime = (v?: string | null) => {
    if (!v) return '—';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR');
  };

  const totalPresencas = fichaData?.totalPresencas ?? 0;
  const totalFaltas = fichaData?.totalFaltas ?? 0;
  const frequencia = fichaData?.frequencia ?? [];
  const historico = fichaData?.historico ?? [];
  const turmasDoAluno = fichaData?.turmasDoAluno ?? [];
  const fotoUrl = fichaData?.foto_url || formData.foto_url;

  type TabDef = { id: TabId; label: string; icon: any; error?: boolean };
  const tabs: TabDef[] = [
    { id: 'cadastro', label: 'Cadastro', icon: User, error: erroMaioridade },
    { id: 'anotacoes', label: `Anotações${anotacoes.length ? ` (${anotacoes.length})` : ''}`, icon: MessageSquare },
    { id: 'movimentacoes', label: 'Histórico', icon: History },
    { id: 'documentos', label: 'Documentos', icon: Paperclip },
    ...(fichaData ? [{ id: 'presenca' as TabId, label: `Presença`, icon: ClipboardCheck }] : []),
  ];

  const DOC_LABELS: Record<string, string> = {
    foto_aluno: 'Foto do Aluno', identidade: 'Identidade',
    comprovante_residencia: 'Comprovante de Residência', certidao_nascimento: 'Certidão de Nascimento',
    identidade_responsavel: 'Identidade do Responsável', declaracao_escolaridade: 'Declaração de Escolaridade',
  };

  return (
    <div className="fixed inset-0 z-[200] flex" onMouseDown={e => e.stopPropagation()}>
      {/* Backdrop */}
      <div className="flex-1 bg-black/30" onMouseDown={onClose} />

      {/* Painel lateral direito */}
      <div
        className="w-full max-w-3xl bg-white flex flex-col h-full shadow-2xl border-l border-gray-200"
        onMouseDown={e => e.stopPropagation()}
      >
        {/* ── CABEÇALHO ── */}
        <div className="px-5 py-4 border-b border-gray-200 bg-white shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                {fotoUrl
                  ? <img src={fotoUrl} className="w-full h-full object-cover" alt="" />
                  : <span className="text-base font-semibold text-gray-500">{(formData.nome_completo?.[0] || '?').toUpperCase()}</span>}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-semibold text-gray-900 truncate">{formData.nome_completo}</h2>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${STATUS_BADGE[formData.status_matricula] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                    {formData.status_matricula}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {formData.aluno?.numero_matricula && (
                    <span className="text-xs text-gray-400 font-mono">{formData.aluno.numero_matricula}</span>
                  )}
                  {formData.cpf && <span className="text-xs text-gray-400">CPF {formData.cpf}</span>}
                  {formData.celular && (
                    <a href={`https://wa.me/55${formData.celular.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-green-600 hover:underline flex items-center gap-1">
                      <Phone size={10} /> {formData.celular}
                    </a>
                  )}
                  {turmasDoAluno.filter((t: any) => t.status === 'ativo' && t.turma_id).map((t: any) => (
                    <span key={t.id} className="text-[10px] font-medium px-1.5 py-0.5 rounded text-white"
                      style={{ backgroundColor: t.turma_cor || '#6366f1' }}>
                      {t.turma_nome}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0">
              <X size={16} />
            </button>
          </div>

          {erroMaioridade && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              <AlertTriangle size={13} className="shrink-0" />
              <span><strong>Conflito de maioridade:</strong> Responsável marcou maior de 18 anos, mas idade cadastrada é {formData.idade} anos.</span>
            </div>
          )}
        </div>

        {/* ── ABAS ── */}
        <div className="border-b border-gray-200 bg-white shrink-0 overflow-x-auto">
          <nav className="flex px-5 -mb-px">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setAbaAtiva(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-3 text-xs border-b-2 transition-colors whitespace-nowrap ${
                  abaAtiva === tab.id
                    ? 'border-purple-600 text-purple-700 font-medium'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}>
                <tab.icon size={13} />
                {tab.label}
                {tab.error && <AlertTriangle size={11} className="text-red-500" />}
              </button>
            ))}
          </nav>
        </div>

        {/* ── CONTEÚDO ── */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-gray-400" size={22} />
            </div>
          )}

          {/* CADASTRO */}
          {!loading && abaAtiva === 'cadastro' && (
            <div className="p-5 space-y-3">

              <FormSection title="Dados Pessoais">
                <div className="grid grid-cols-3 gap-x-5 gap-y-4">
                  <div className="col-span-3">
                    <EF label="Nome Completo" field="nome_completo" value={formData.nome_completo} editing={isEditing} onChange={handleFieldChange} />
                  </div>
                  <EF label="CPF" field="cpf" value={formData.cpf} editing={isEditing} onChange={handleFieldChange} />
                  <EF label="Data de Nascimento" field="data_nascimento" value={formData.data_nascimento} editing={isEditing} type="date" onChange={handleFieldChange} />
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-500">Idade</label>
                    <p className="text-sm text-gray-900">{formData.idade != null ? `${formData.idade} anos` : '—'}</p>
                  </div>
                  <EF label="Sexo" field="sexo" value={formData.sexo} editing={isEditing} type="select"
                    options={['Masculino', 'Feminino', 'Outro', 'Não informado']} onChange={handleFieldChange} />
                  <EF label="Email" field="email" value={formData.email} editing={isEditing} onChange={handleFieldChange} />
                  <EF label="Celular" field="celular" value={formData.celular} editing={isEditing} onChange={handleFieldChange} />
                  <EF label="Telefone Alternativo" field="telefone_alternativo" value={formData.telefone_alternativo} editing={isEditing} onChange={handleFieldChange} />
                  <div className="col-span-3">
                    <EF label="Cursos de Interesse" field="cursos_desejados" value={formData.cursos_desejados} editing={isEditing} onChange={handleFieldChange} />
                  </div>
                </div>
              </FormSection>

              <FormSection title="Endereço">
                <div className="grid grid-cols-3 gap-x-5 gap-y-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-500">CEP {buscandoCep && <span className="text-purple-500">(buscando...)</span>}</label>
                    {isEditing ? (
                      <input type="text" value={formData.cep ?? ''} maxLength={9} placeholder="00000-000"
                        onChange={e => { const v = e.target.value; handleFieldChange('cep', v); if (v.replace(/\D/g, '').length === 8) buscarCep(v); }}
                        onBlur={e => buscarCep(e.target.value)}
                        className="h-8 px-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500" />
                    ) : <p className="text-sm text-gray-900">{formData.cep || '—'}</p>}
                  </div>
                  <EF label="Logradouro" field="logradouro" value={formData.logradouro} editing={isEditing} onChange={handleFieldChange} />
                  <EF label="Número" field="numero" value={formData.numero} editing={isEditing} onChange={handleFieldChange} />
                  <EF label="Complemento" field="complemento" value={formData.complemento} editing={isEditing} onChange={handleFieldChange} />
                  <EF label="Bairro" field="bairro" value={formData.bairro} editing={isEditing} onChange={handleFieldChange} />
                  <EF label="Cidade" field="cidade" value={formData.cidade} editing={isEditing} onChange={handleFieldChange} />
                  <EF label="Estado (UF)" field="estado_uf" value={formData.estado_uf} editing={isEditing} onChange={handleFieldChange} />
                </div>
              </FormSection>

              <FormSection title="Escolaridade">
                <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                  <EF label="Nível de Escolaridade" field="escolaridade" value={formData.escolaridade} editing={isEditing} type="select"
                    options={['Ensino Fundamental Incompleto', 'Ensino Fundamental Completo', 'Ensino Médio Incompleto', 'Ensino Médio Completo', 'Ensino Superior Incompleto', 'Ensino Superior Completo', 'Pós-Graduação', 'Não informado']}
                    onChange={handleFieldChange} />
                  <EF label="Turno Escolar" field="turno_escolar" value={formData.turno_escolar} editing={isEditing} type="select"
                    options={['Manhã', 'Tarde', 'Noite', 'Integral', 'Não estuda no momento']} onChange={handleFieldChange} />
                </div>
              </FormSection>

              <FormSection title="Saúde">
                <div className="grid grid-cols-3 gap-x-5 gap-y-4">
                  <EF label="Alergias" field="possui_alergias" value={formData.possui_alergias} editing={isEditing} onChange={handleFieldChange} />
                  <EF label="Cuidado Especial" field="cuidado_especial" value={formData.cuidado_especial} editing={isEditing} onChange={handleFieldChange} />
                  <EF label="Uso de Medicamento" field="uso_medicamento" value={formData.uso_medicamento} editing={isEditing} onChange={handleFieldChange} />
                  <div className="col-span-3">
                    <EF label="Detalhes" field="detalhes_cuidado" value={formData.detalhes_cuidado} editing={isEditing} type="textarea" onChange={handleFieldChange} />
                  </div>
                </div>
              </FormSection>

              <FormSection title="Identidade Social">
                <div className="grid grid-cols-3 gap-x-5 gap-y-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-500">Autodeclaração Racial</label>
                    {isEditing ? (
                      <select value={formData.auto_declaracao ?? ''} onChange={e => handleFieldChange('auto_declaracao', e.target.value)}
                        className="h-8 px-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500">
                        <option value="">Prefiro não informar</option>
                        {['branco','preto','pardo','amarelo','indigena'].map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                      </select>
                    ) : <p className="text-sm text-gray-900 capitalize">{formData.auto_declaracao || '—'}</p>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-500">Orientação Sexual</label>
                    {isEditing ? (
                      <select value={formData.orientacao_sexual ?? ''} onChange={e => handleFieldChange('orientacao_sexual', e.target.value)}
                        className="h-8 px-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500">
                        <option value="">Prefiro não informar</option>
                        <option value="heterossexual">Heterossexual</option>
                        <option value="homossexual">Homossexual</option>
                        <option value="bissexual">Bissexual</option>
                        <option value="panssexual">Pansexual</option>
                        <option value="assexual">Assexual</option>
                        <option value="outro">Outro</option>
                      </select>
                    ) : <p className="text-sm text-gray-900 capitalize">{formData.orientacao_sexual || '—'}</p>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-500">Gênero</label>
                    {isEditing ? (
                      <select value={complemento.genero ?? ''} onChange={e => setComplemento(p => ({ ...p, genero: e.target.value }))}
                        className="h-8 px-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500">
                        <option value="">Prefiro não informar</option>
                        <option value="masculino">Masculino</option>
                        <option value="feminino">Feminino</option>
                        <option value="nao_binario">Não-binário</option>
                      </select>
                    ) : <p className="text-sm text-gray-900 capitalize">{complemento.genero || '—'}</p>}
                  </div>
                </div>
              </FormSection>

              <FormSection title="Responsável / Filiação">
                <div className="grid grid-cols-3 gap-x-5 gap-y-4">
                  <div className="col-span-3">
                    <EF label="Maior de 18 Anos" field="maior_18_anos" value={formData.maior_18_anos} editing={isEditing} type="checkbox" onChange={handleFieldChange} />
                  </div>
                  <div className="col-span-3">
                    <EF label="Nome da Mãe / Responsável" field="nome_responsavel" value={formData.nome_responsavel} editing={isEditing} onChange={handleFieldChange} />
                  </div>
                  {!formData.maior_18_anos && (<>
                    <EF label="Grau de Parentesco" field="grau_parentesco" value={formData.grau_parentesco} editing={isEditing} onChange={handleFieldChange} />
                    <EF label="CPF do Responsável" field="cpf_responsavel" value={formData.cpf_responsavel} editing={isEditing} onChange={handleFieldChange} />
                    <EF label="Email do Responsável" field="email_responsavel" value={formData.email_responsavel} editing={isEditing} onChange={handleFieldChange} />
                  </>)}
                </div>
              </FormSection>

              {complementoCarregado && (
                <FormSection title="Dados Complementares">
                  <div className="grid grid-cols-3 gap-x-5 gap-y-4">
                    <CF label="RG" field="rg" comp={complemento} editing={isEditing} onChange={v => setComplemento(p => ({ ...p, rg: v }))} />
                    <CF label="Órgão Expedidor" field="orgao_expedidor" comp={complemento} editing={isEditing} onChange={v => setComplemento(p => ({ ...p, orgao_expedidor: v }))} />
                    <CF label="UF Expedição" field="uf_expedicao" comp={complemento} editing={isEditing} onChange={v => setComplemento(p => ({ ...p, uf_expedicao: v.toUpperCase().slice(0, 2) }))} />
                    <div className="col-span-3">
                      <CF label="Nome da Mãe" field="nome_mae" comp={complemento} editing={isEditing} onChange={v => setComplemento(p => ({ ...p, nome_mae: v }))} />
                    </div>
                    <div className="col-span-3 pt-2 border-t border-gray-100">
                      <p className="text-xs text-gray-400 font-medium mb-3">Dados Bancários</p>
                      <div className="grid grid-cols-3 gap-x-5 gap-y-4">
                        <div className="col-span-3">
                          <CF label="Banco" field="banco" comp={complemento} editing={isEditing} onChange={v => setComplemento(p => ({ ...p, banco: v }))} />
                        </div>
                        <CF label="Agência" field="agencia" comp={complemento} editing={isEditing} onChange={v => setComplemento(p => ({ ...p, agencia: v }))} />
                        <CF label="Dígito Agência" field="agencia_digito" comp={complemento} editing={isEditing} onChange={v => setComplemento(p => ({ ...p, agencia_digito: v }))} />
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-gray-500">Tipo de Conta</label>
                          {isEditing ? (
                            <select value={complemento.tipo_conta ?? ''} onChange={e => setComplemento(p => ({ ...p, tipo_conta: e.target.value }))}
                              className="h-8 px-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500">
                              <option value="">—</option>
                              <option value="corrente">Corrente</option>
                              <option value="poupanca">Poupança</option>
                            </select>
                          ) : <p className="text-sm text-gray-900 capitalize">{complemento.tipo_conta || '—'}</p>}
                        </div>
                        <CF label="Conta Corrente" field="conta_corrente" comp={complemento} editing={isEditing} onChange={v => setComplemento(p => ({ ...p, conta_corrente: v }))} />
                        <CF label="Dígito Conta" field="conta_digito" comp={complemento} editing={isEditing} onChange={v => setComplemento(p => ({ ...p, conta_digito: v }))} />
                      </div>
                    </div>
                  </div>
                </FormSection>
              )}

              {/* LGPD */}
              {(() => {
                const assinado = !!formData.data_assinatura_lgpd;
                const dataAssinatura = assinado ? new Date(formData.data_assinatura_lgpd) : null;
                const umAnoAtras = new Date(); umAnoAtras.setFullYear(umAnoAtras.getFullYear() - 1);
                const precisaRenovar = dataAssinatura && dataAssinatura < umAnoAtras;
                const vencimento = dataAssinatura ? new Date(dataAssinatura) : null;
                if (vencimento) vencimento.setFullYear(vencimento.getFullYear() + 1);

                return (
                  <FormSection title="LGPD">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded border ${
                            precisaRenovar ? 'bg-orange-50 text-orange-700 border-orange-200'
                              : assinado ? 'bg-green-50 text-green-700 border-green-200'
                              : formData.lgpd_aceito ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {precisaRenovar ? 'Renovação necessária' : assinado ? 'Assinado' : formData.lgpd_aceito ? 'Confirmado' : 'Pendente'}
                          </span>
                          {assinado && <span className="text-xs text-gray-500">em {dataAssinatura!.toLocaleDateString('pt-BR')}</span>}
                        </div>
                        {assinado && formData.lgpd_ip && (
                          <p className="text-xs text-gray-400">IP: <span className="font-mono">{formData.lgpd_ip}</span></p>
                        )}
                        {precisaRenovar && <p className="text-xs text-orange-600">Vencimento: {vencimento?.toLocaleDateString('pt-BR')}</p>}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {assinado && (
                          <button onClick={gerarPdfLGPD} disabled={pdfLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded text-xs text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60">
                            {pdfLoading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} PDF
                          </button>
                        )}
                        <button onClick={handleEnviarLGPD} disabled={lgpdLoading}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-medium transition-colors disabled:opacity-60">
                          {lgpdLoading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                          {assinado ? 'Renovar' : formData.lgpd_aceito ? 'Reenviar' : 'Enviar Termo'}
                        </button>
                      </div>
                    </div>
                  </FormSection>
                );
              })()}
            </div>
          )}

          {/* ANOTAÇÕES */}
          {!loading && abaAtiva === 'anotacoes' && (
            <div className="p-5 space-y-3">
              <div className="bg-white border border-gray-200 rounded">
                <div className="p-3 border-b border-gray-100">
                  <textarea
                    className="w-full text-sm text-gray-900 h-20 outline-none resize-none placeholder-gray-400"
                    placeholder="Nova anotação..."
                    value={novaAnotacaoTexto}
                    onChange={e => setNovaAnotacaoTexto(e.target.value)}
                  />
                </div>
                <div className="px-3 py-2 flex justify-end bg-gray-50">
                  <button onClick={handleAddAnotacao} disabled={loading || !novaAnotacaoTexto.trim()}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-medium disabled:opacity-50 transition-colors">
                    <Send size={11} /> Registrar anotação
                  </button>
                </div>
              </div>

              {anotacoes.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-10">Nenhuma anotação registrada.</p>
              )}
              {anotacoes.map(anot => (
                <div key={anot.id} className="bg-white border border-gray-200 rounded p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                      {anot.usuario_foto
                        ? <img src={(() => {
                            const f = anot.usuario_foto;
                            if (!f) return '';
                            if (f.startsWith('http') || f.startsWith('/uploads/')) return f;
                            return `${API_ORIGIN}${f}`;
                          })()} className="w-full h-full object-cover" alt="" />
                        : <User size={12} className="text-gray-400" />}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-900">{anot.usuario_nome || 'Usuário'}</p>
                      <p className="text-xs text-gray-400">{fmtDateTime(anot.created_at)}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{anot.texto_anotacao}</p>
                </div>
              ))}
            </div>
          )}

          {/* HISTÓRICO DE MOVIMENTAÇÕES */}
          {!loading && abaAtiva === 'movimentacoes' && (
            <div className="p-5">
              {movimentacoes.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">Nenhuma movimentação registrada.</p>
              ) : (
                <div className="bg-white border border-gray-200 rounded divide-y divide-gray-100">
                  {movimentacoes.map(mov => (
                    <div key={mov.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${
                            mov.tipo === 'Status' ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : mov.tipo === 'Edição' ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}>{mov.tipo}</span>
                          {mov.categoria && <span className="text-xs text-gray-500">{mov.categoria.replace(/_/g, ' ')}</span>}
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">{fmtDateTime(mov.created_at)}</span>
                      </div>
                      {mov.valor_antes !== mov.valor_depois && (
                        <div className="flex items-center gap-2 mt-1.5 text-xs font-mono">
                          <span className="text-gray-400 line-through">{mov.valor_antes || '(vazio)'}</span>
                          <ChevronRight size={10} className="text-gray-400 shrink-0" />
                          <span className="text-gray-800">{mov.valor_depois || '(vazio)'}</span>
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mt-1">{mov.usuario_nome}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* DOCUMENTOS */}
          {!loading && abaAtiva === 'documentos' && (
            <div className="p-5 space-y-3">

              {!loadingDocs && (
                <div className={`border rounded p-3 flex items-center justify-between gap-3 ${docsCompleto ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Documentação {docsCompleto ? 'completa' : 'incompleta'}
                    </p>
                    {obrigatoriosPendentes.length > 0 && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Pendentes: {obrigatoriosPendentes.map(t => DOC_LABELS[t] ?? t).join(', ')}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded border shrink-0 ${docsCompleto ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                    {docsCompleto ? '✓ Completo' : 'Pendente'}
                  </span>
                </div>
              )}

              {/* Upload */}
              <div className="bg-white border border-gray-200 rounded p-4 space-y-3">
                <p className="text-xs font-medium text-gray-700">Adicionar documento</p>
                <div className="flex gap-2 flex-wrap">
                  <select value={uploadTipo} onChange={e => setUploadTipo(e.target.value)}
                    className="h-8 px-2.5 border border-gray-300 rounded text-sm text-gray-900 flex-1 min-w-[180px] focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500">
                    {Object.entries(DOC_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    <option value="extra">Outro</option>
                  </select>
                  {uploadTipo === 'extra' && (
                    <input type="text" placeholder="Nome do documento" value={uploadNomeExtra} onChange={e => setUploadNomeExtra(e.target.value)}
                      className="h-8 px-2.5 border border-gray-300 rounded text-sm text-gray-900 flex-1 min-w-[140px] focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500" />
                  )}
                </div>
                <label className={`flex items-center justify-center gap-2 w-full py-2.5 border rounded cursor-pointer transition-colors text-xs ${
                  uploadingDoc ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                    : 'border-dashed border-gray-300 hover:border-purple-400 hover:bg-purple-50 text-gray-500 hover:text-purple-600'
                }`}>
                  {uploadingDoc
                    ? <><Loader2 size={13} className="animate-spin" /> Enviando...</>
                    : <><Paperclip size={13} /> Selecionar arquivo (JPG, PNG, PDF · máx 8 MB)</>}
                  <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={uploadingDoc} className="hidden"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploadingDoc(true);
                      try {
                        const fd = new FormData();
                        fd.append('arquivo', file);
                        fd.append('tipo', uploadTipo);
                        if (uploadTipo === 'extra' && uploadNomeExtra.trim()) fd.append('nome_extra', uploadNomeExtra.trim());
                        await api.post(`/matriculas/inscricao/${formData.id}/documentos/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                        e.target.value = '';
                        setUploadNomeExtra('');
                        recarregarDocumentos();
                      } catch (err: any) {
                        alert(err?.response?.data?.message || 'Erro ao enviar documento.');
                      } finally { setUploadingDoc(false); }
                    }}
                  />
                </label>
              </div>

              {(formData.url_documentos_zip || formData.url_termo_lgpd) && (
                <div className="space-y-1">
                  <p className="text-xs text-gray-400 font-medium px-1">Via Google Forms</p>
                  <DocLinkItem label="Pacote de documentos (ZIP)" url={formData.url_documentos_zip} icon={<Paperclip size={13} />} />
                  <DocLinkItem label="Termo LGPD assinado" url={formData.url_termo_lgpd} icon={<ShieldCheck size={13} />} />
                </div>
              )}

              {loadingDocs ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-400" size={20} /></div>
              ) : uploadedDocs.length > 0 ? (
                <div className="bg-white border border-gray-200 rounded divide-y divide-gray-100">
                  {uploadedDocs.map(doc => {
                    const nomeLabel = DOC_LABELS[doc.tipo] ?? doc.nome_extra ?? doc.tipo;
                    const fileUrl = (doc.url_arquivo.startsWith('data:') || doc.url_arquivo.startsWith('http')) ? doc.url_arquivo : `${API_ORIGIN}${doc.url_arquivo}`;
                    const bytes = doc.tamanho_bytes ?? 0;
                    const sizeLabel = bytes > 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : bytes > 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${bytes} B`;
                    return (
                      <div key={doc.id} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText size={14} className="text-gray-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm text-gray-800 truncate">{nomeLabel}</p>
                            <p className="text-xs text-gray-400">{fmtDate(doc.createdAt)} · {sizeLabel}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <a href={safeUrl(fileUrl)} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1 border border-gray-200 rounded text-xs text-gray-600 hover:bg-gray-100 transition-colors">
                            <ExternalLink size={11} /> Abrir
                          </a>
                          <button onClick={async () => {
                            if (!confirm(`Remover "${nomeLabel}"?`)) return;
                            try { await api.delete(`/matriculas/documentos/${doc.id}`); recarregarDocumentos(); }
                            catch { alert('Erro ao remover documento.'); }
                          }} className="flex items-center gap-1 px-2.5 py-1 border border-gray-200 rounded text-xs text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-6">Nenhum documento enviado.</p>
              )}

              {['Em Validação', 'Aguardando Documentos', 'Documentos Enviados'].includes(formData.status_matricula) && (
                <div className="bg-white border border-gray-200 rounded p-4 space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900">Efetivar Matrícula</p>
                    {formData.cursos_desejados && (
                      <span className="text-xs text-gray-400">Interesse: <span className="text-gray-700">{formData.cursos_desejados}</span></span>
                    )}
                  </div>
                  {!cursosCarregados ? (
                    <p className="text-xs text-gray-500">Carregando turmas...</p>
                  ) : cursosAcademico.length === 0 ? (
                    <p className="text-xs text-red-500">Nenhuma turma ativa disponível.</p>
                  ) : (
                    <div className="space-y-3">
                      {cursosAcademico.map(curso => (
                        <div key={curso.id}>
                          <p className="text-xs text-gray-500 font-medium mb-1.5">{curso.sigla} — {curso.nome}</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {curso.turmas.map(t => {
                              const ativo = cursosSelecionados.includes(t.id);
                              return (
                                <label key={t.id} className={`flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition-colors select-none text-xs ${
                                  ativo ? 'border-purple-400 bg-purple-50 text-purple-700' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                }`}>
                                  <input type="checkbox" checked={ativo}
                                    onChange={() => setCursosSelecionados(prev => prev.includes(t.id) ? prev.filter(c => c !== t.id) : [...prev, t.id])}
                                    className="w-3 h-3 cursor-pointer shrink-0 accent-purple-600" />
                                  <span className="font-medium leading-tight">{t.nome}{t.codigo ? <span className="font-normal text-gray-400 ml-1">({t.codigo})</span> : ''}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={handleEfetivarMatricula} disabled={cursosSelecionados.length === 0 || loading}
                    className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                    {loading ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle size={14} />}
                    Efetivar Matrícula{cursosSelecionados.length > 0 ? ` (${cursosSelecionados.length} turma${cursosSelecionados.length > 1 ? 's' : ''})` : ''}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* PRESENÇA */}
          {!loading && abaAtiva === 'presenca' && fichaData && (
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Presenças', val: totalPresencas, cls: 'border-green-200 bg-green-50 text-green-700' },
                  { label: 'Faltas', val: totalFaltas, cls: 'border-red-200 bg-red-50 text-red-600' },
                  { label: 'Frequência', val: totalPresencas + totalFaltas > 0 ? `${Math.round((totalPresencas / (totalPresencas + totalFaltas)) * 100)}%` : '—', cls: 'border-blue-200 bg-blue-50 text-blue-700' },
                ].map(k => (
                  <div key={k.label} className={`border rounded p-3 text-center ${k.cls}`}>
                    <p className="text-xs text-gray-500 mb-1">{k.label}</p>
                    <p className="text-xl font-semibold">{k.val}</p>
                  </div>
                ))}
              </div>

              {frequencia.length > 0 ? (
                <div className="bg-white border border-gray-200 rounded">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-xs font-medium text-gray-700">Registro por aula</p>
                  </div>
                  <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                    {frequencia.map((f: any) => (
                      <div key={f.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${f.descricao === 'Presente' ? 'bg-green-500' : 'bg-red-400'}`} />
                        <span className="text-sm text-gray-800 flex-1">{fmtDate(f.data)}</span>
                        <span className={`text-xs font-medium ${f.descricao === 'Presente' ? 'text-green-600' : 'text-red-500'}`}>{f.descricao}</span>
                        {f.justificada && <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">Justificada</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-8">Nenhum registro de presença.</p>
              )}

              {historico.filter((h: any) => h.tipo !== 'Presença').length > 0 && (
                <div className="bg-white border border-gray-200 rounded">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-xs font-medium text-gray-700">Ocorrências</p>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {historico.filter((h: any) => h.tipo !== 'Presença').map((h: any) => (
                      <div key={h.id} className="px-4 py-3 flex gap-3">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded border self-start shrink-0 ${
                          h.tipo === 'Incidente' ? 'bg-red-50 text-red-700 border-red-200'
                            : h.tipo === 'Advertência' ? 'bg-orange-50 text-orange-700 border-orange-200'
                            : 'bg-purple-50 text-purple-700 border-purple-200'
                        }`}>{h.tipo}</span>
                        <div>
                          {h.titulo && <p className="text-sm font-medium text-gray-900">{h.titulo}</p>}
                          {h.descricao && <p className="text-xs text-gray-500">{h.descricao}</p>}
                          <p className="text-xs text-gray-400 mt-0.5">{fmtDate(h.data)} · {h.usuario_nome}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── RODAPÉ ── */}
        <div className="px-5 py-3 border-t border-gray-200 bg-white flex items-center gap-2 flex-wrap shrink-0">
          {['Em Validação', 'Aguardando Documentos'].includes(formData.status_matricula) && (
            <button onClick={handleSolicitarDocumentos} disabled={docLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded text-xs text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60">
              {docLoading ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
              {formData.doc_token ? 'Reenviar link de docs' : 'Solicitar documentos'}
              {formData.doc_token && <span className="text-green-600 ml-1">✓</span>}
            </button>
          )}

          <div className="flex-1" />

          <button onClick={() => setShowMotivoModal({ show: true, status: 'Incompleto' })}
            className="px-3 py-1.5 border border-amber-300 text-amber-700 rounded text-xs hover:bg-amber-50 transition-colors">
            Marcar Incompleto
          </button>
          <button onClick={() => setShowMotivoModal({ show: true, status: 'Desistente' })}
            className="px-3 py-1.5 border border-red-300 text-red-700 rounded text-xs hover:bg-red-50 transition-colors">
            Registrar Desistência
          </button>

          {isEditing ? (
            <>
              <button onClick={() => { setIsEditing(false); setFormData({ ...aluno }); }}
                className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded text-xs hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSaveEdit} disabled={loading}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-medium transition-colors disabled:opacity-60">
                {loading ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Salvar
              </button>
            </>
          ) : (
            <button onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 border border-gray-300 text-gray-700 rounded text-xs hover:bg-gray-50 transition-colors">
              <Edit3 size={11} /> Editar
            </button>
          )}
        </div>
      </div>

      {/* MODAL: Matrícula efetivada */}
      {matriculaNumero && (
        <div className="fixed inset-0 bg-black/50 z-[350] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-lg p-6 shadow-2xl text-center border border-gray-200">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={24} className="text-green-600" />
            </div>
            <p className="text-xs text-gray-500 mb-1">Matrícula efetivada</p>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{formData.nome_completo.split(' ')[0]}</h2>
            <div className="bg-gray-50 border border-gray-200 rounded px-4 py-3 mb-5">
              <p className="text-xs text-gray-500 mb-1">Número de Matrícula</p>
              <p className="text-xl font-semibold text-gray-900 font-mono">{matriculaNumero}</p>
            </div>
            <button onClick={() => { setMatriculaNumero(null); onClose(); }}
              className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-medium transition-colors">
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Justificativa de status */}
      {showMotivoModal.show && (
        <div className="fixed inset-0 bg-black/40 z-[300] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md rounded-lg p-5 shadow-2xl border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Alterar status</h3>
            <p className="text-xs text-gray-500 mb-4">Novo status: <span className="font-medium text-gray-700">{showMotivoModal.status}</span></p>
            <textarea
              className="w-full border border-gray-300 rounded p-3 text-sm text-gray-900 h-28 outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 resize-none"
              placeholder="Descreva o motivo da alteração..."
              value={motivoTexto}
              onChange={e => setMotivoTexto(e.target.value)}
            />
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => { setShowMotivoModal({ show: false, status: null }); setMotivoTexto(''); }}
                className="px-4 py-1.5 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={() => handleUpdateStatus(showMotivoModal.status!, motivoTexto)} disabled={!motivoTexto.trim() || loading}
                className="px-5 py-1.5 bg-gray-900 hover:bg-gray-800 text-white rounded text-sm font-medium disabled:opacity-50 transition-colors">
                {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componentes auxiliares ─────────────────────────────────────

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded">
      <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
        <h3 className="text-xs font-semibold text-gray-600">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function EF({
  label, field, value, editing, type = 'text', onChange, options,
}: {
  label: string; field: string; value: any; editing: boolean;
  type?: 'text' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox';
  onChange: (f: string, v: any) => void; options?: string[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500">{label}</label>
      {editing ? (
        type === 'textarea' ? (
          <textarea value={value ?? ''} onChange={e => onChange(field, e.target.value)} rows={3}
            className="px-2.5 py-1.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 resize-none" />
        ) : type === 'select' && options ? (
          <select value={value ?? ''} onChange={e => onChange(field, e.target.value)}
            className="h-8 px-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500">
            <option value="">—</option>
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        ) : type === 'checkbox' ? (
          <label className="flex items-center gap-2 cursor-pointer mt-0.5">
            <input type="checkbox" checked={!!value} onChange={e => onChange(field, e.target.checked)} className="w-4 h-4 accent-purple-600" />
            <span className="text-sm text-gray-900">{value ? 'Sim' : 'Não'}</span>
          </label>
        ) : type === 'date' ? (
          <input type="date" value={value ? String(value).slice(0, 10) : ''} onChange={e => onChange(field, e.target.value)}
            className="h-8 px-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500" />
        ) : (
          <input type={type} value={value ?? ''} onChange={e => onChange(field, type === 'number' ? Number(e.target.value) : e.target.value)}
            className="h-8 px-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500" />
        )
      ) : (
        type === 'checkbox'
          ? <p className="text-sm text-gray-900">{value ? 'Sim' : 'Não'}</p>
          : <p className="text-sm text-gray-900">
              {value
                ? (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)
                    ? new Date(value + 'T12:00:00').toLocaleDateString('pt-BR')
                    : value)
                : '—'}
            </p>
      )}
    </div>
  );
}

function CF({ label, field, comp, editing, onChange }: {
  label: string; field: string; comp: Record<string, string>; editing: boolean; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500">{label}</label>
      {editing ? (
        <input value={comp[field] ?? ''} onChange={e => onChange(e.target.value)}
          className="h-8 px-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500" />
      ) : (
        <p className="text-sm text-gray-900">{comp[field] || '—'}</p>
      )}
    </div>
  );
}

function DocLinkItem({ label, url, icon }: { label: string; url?: string; icon: React.ReactNode }) {
  if (!url) return null;
  return (
    <a href={safeUrl(url)} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-3 px-4 py-2.5 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors">
      <span className="text-gray-400 shrink-0">{icon}</span>
      <span className="text-sm text-gray-700 flex-1">{label}</span>
      <ExternalLink size={12} className="text-gray-400" />
    </a>
  );
}
