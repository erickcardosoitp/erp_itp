"use client";
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, User, Edit3, CheckCircle, Save,
  MessageSquare, AlertTriangle, Send, Loader2,
  History, Paperclip, ShieldCheck, ChevronRight, ChevronDown,
  Download, ExternalLink, Trash2, ClipboardCheck,
  FileText, Phone, Mail, MapPin, Calendar, Hash,
  BookOpen, CreditCard, Building2, Heart, Users, Sparkles,
  GraduationCap, Home, UserCheck, Camera,
} from 'lucide-react';
import api from '@/services/api';
import DocumentCamera from '@/components/projetos/DocumentCamera';

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api')
  .replace(/\/api$/, '').replace(/\/backend-api$/, '');

const safeUrl = (url: string) => {
  if (url.startsWith('data:')) return url;
  try { const u = new URL(url, window.location.origin); if (u.protocol === 'http:' || u.protocol === 'https:') return url; } catch {}
  return url.startsWith('/') ? url : '#';
};

interface DocEnviado {
  id: string; tipo: string; nome_extra: string | null;
  url_arquivo: string; mimetype: string | null;
  tamanho_bytes: number | null; createdAt: string;
}
interface Anotacao { id: number; texto_anotacao: string; usuario_nome: string; usuario_foto?: string; created_at: string; }
interface Movimentacao { id: number; usuario_nome: string; tipo: string; categoria: string; valor_antes: string; valor_depois: string; created_at: string; }
interface InscricaoData {
  id: number; idade: number; maior_18_anos?: boolean; status_matricula: string;
  nome_completo: string; cpf: string; email: string; lgpd_aceito: boolean;
  foto_url?: string; cidade?: string; bairro?: string; celular?: string;
  data_inscricao?: string; data_nascimento?: string; cursos_desejados?: string;
  url_documentos_zip?: string; url_termo_lgpd?: string; cuidado_especial?: string;
  auto_declaracao?: string; orientacao_sexual?: string; [key: string]: any;
}
interface FichaData {
  aluno: any; inscricao_id?: number | null; frequencia?: any[]; historico?: any[];
  turmasDoAluno?: any[]; totalPresencas?: number; totalFaltas?: number;
  foto_url?: string | null; complemento?: Record<string, string> | null; auto_declaracao?: string | null;
}
interface DossieProps {
  aluno: InscricaoData;
  onClose: () => void;
  onSuccess?: () => void;
  fichaData?: FichaData;
  onVerNoAcademico?: () => void;
  onVerInscricao?: () => void;
}

const STATUS_MAP: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  'Pendente':                   { label: 'Pendente',          bg: 'bg-gray-100',   text: 'text-gray-600',    border: 'border-gray-300',  dot: 'bg-gray-400' },
  'Aguardando Assinatura LGPD': { label: 'Aguard. LGPD',     bg: 'bg-orange-100', text: 'text-orange-700',  border: 'border-orange-300',dot: 'bg-orange-500' },
  'Em Validação':               { label: 'Em Validação',      bg: 'bg-blue-100',   text: 'text-blue-700',    border: 'border-blue-300',  dot: 'bg-blue-500' },
  'Aguardando Documentos':      { label: 'Aguard. Docs',      bg: 'bg-amber-100',  text: 'text-amber-700',   border: 'border-amber-300', dot: 'bg-amber-500' },
  'Documentos Enviados':        { label: 'Docs Enviados',     bg: 'bg-cyan-100',   text: 'text-cyan-700',    border: 'border-cyan-300',  dot: 'bg-cyan-500' },
  'Matriculado':                { label: 'Matriculado',       bg: 'bg-green-100',  text: 'text-green-700',   border: 'border-green-300', dot: 'bg-green-500' },
  'Incompleto':                 { label: 'Incompleto',        bg: 'bg-red-100',    text: 'text-red-700',     border: 'border-red-300',   dot: 'bg-red-500' },
  'Desistente':                 { label: 'Desistente',        bg: 'bg-gray-100',   text: 'text-gray-500',    border: 'border-gray-300',  dot: 'bg-gray-400' },
  'Cancelada':                  { label: 'Cancelada',         bg: 'bg-red-100',    text: 'text-red-800',     border: 'border-red-300',   dot: 'bg-red-600' },
};

// Gradiente de fundo do header por status
const STATUS_HEADER_GRADIENT: Record<string, string> = {
  'Matriculado':                'from-green-50 to-emerald-50/40',
  'Em Validação':               'from-blue-50 to-sky-50/40',
  'Aguardando Assinatura LGPD': 'from-orange-50 to-amber-50/40',
  'Aguardando Documentos':      'from-amber-50 to-yellow-50/40',
  'Documentos Enviados':        'from-cyan-50 to-sky-50/40',
  'Incompleto':                 'from-red-50 to-rose-50/40',
  'Desistente':                 'from-gray-50 to-slate-50/40',
};

const DOC_LABELS: Record<string, string> = {
  foto_aluno: 'Foto do Aluno', identidade: 'RG / CNH',
  comprovante_residencia: 'Comprovante de Residência', certidao_nascimento: 'Certidão de Nascimento',
  identidade_responsavel: 'Identidade do Responsável', declaracao_escolaridade: 'Declaração de Escolaridade',
};

const CURSOS_ESPECIAIS_KEYS = ['encceja', 'vestibular'];

function isCursoEspecial(turmas: any[], cursosDesejados?: string) {
  const emTurma = turmas.some((t: any) =>
    CURSOS_ESPECIAIS_KEYS.some(k => (t.turma_nome || '').toLowerCase().includes(k))
  );
  const noCurso = CURSOS_ESPECIAIS_KEYS.some(k => (cursosDesejados || '').toLowerCase().includes(k));
  return emTurma || noCurso;
}

export default function DossieCandidato({ aluno, onClose, onSuccess, fichaData, onVerNoAcademico, onVerInscricao }: DossieProps) {
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<InscricaoData>({ ...aluno });
  // ref guarda o snapshot carregado da API — Cancel restaura ele (não o prop parcial)
  const loadedDataRef = useRef<InscricaoData | null>(null);

  const [loading, setLoading] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setDrawerVisible(true)); }, []);
  const handleClose = () => { setDrawerVisible(false); setTimeout(onClose, 280); };
  type TabId = 'cadastro' | 'anotacoes' | 'movimentacoes' | 'documentos' | 'presenca' | 'turmas_aluno' | 'complemento_aluno';
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
  const [tiposEnviados, setTiposEnviados] = useState<string[]>([]);
  const [docsCompleto, setDocsCompleto] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [matriculaNumero, setMatriculaNumero] = useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadTipo, setUploadTipo] = useState('identidade');
  const [uploadNomeExtra, setUploadNomeExtra] = useState('');
  const [cameraDocTipo, setCameraDocTipo] = useState<string | null>(null);
  const [complemento, setComplemento] = useState<Record<string, string>>({
    rg: '', orgao_expedidor: '', uf_expedicao: '', genero: '', orientacao_sexual: '',
    banco: '', agencia: '', agencia_digito: '', conta_corrente: '', conta_digito: '', tipo_conta: '', nome_mae: '',
  });
  const [complementoCarregado, setComplementoCarregado] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  const erroMaioridade = formData.idade < 18 && formData.maior_18_anos === true;
  const totalPresencas = fichaData?.totalPresencas ?? 0;
  const totalFaltas = fichaData?.totalFaltas ?? 0;
  const frequencia = fichaData?.frequencia ?? [];
  const historico = fichaData?.historico ?? [];
  const turmasDoAluno = fichaData?.turmasDoAluno ?? [];
  const fotoUrl = fichaData?.foto_url || formData.foto_url;
  const turmasAtivas = turmasDoAluno.filter((t: any) => t.status === 'ativo' && t.turma_id);
  const mostrarComplemento = complementoCarregado && isCursoEspecial(turmasDoAluno, formData.cursos_desejados);

  const recarregarDocumentos = useCallback(() => {
    if (!formData.id) return;
    setLoadingDocs(true);
    api.get(`/matriculas/inscricao/${formData.id}/documentos`)
      .then(res => { setUploadedDocs(res.data?.documentos ?? []); setObrigatoriosPendentes(res.data?.obrigatorios_pendentes ?? []); setTiposEnviados(res.data?.tipos_enviados ?? []); setDocsCompleto(res.data?.completo ?? false); })
      .catch(() => { setUploadedDocs([]); setObrigatoriosPendentes([]); setTiposEnviados([]); setDocsCompleto(false); })
      .finally(() => setLoadingDocs(false));
  }, [formData.id]);

  useEffect(() => { if (abaAtiva === 'documentos') recarregarDocumentos(); }, [abaAtiva, recarregarDocumentos]);

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
          const d = resInscricao.value.data;
          // Mescla com aluno prop para garantir que nenhum campo seja perdido
          const merged = { ...aluno, ...d };
          setFormData(merged);
          loadedDataRef.current = merged; // snapshot para o botão Cancelar
          if (d?.aluno?.id) {
            api.get(`/alunos/${d.aluno.id}/complemento`).then(r => { if (r.data) setComplemento(p => ({ ...p, ...r.data })); }).catch(() => {});
            if (d.aluno?.auto_declaracao) setFormData(p => ({ ...p, auto_declaracao: d.aluno.auto_declaracao }));
            setComplementoCarregado(true);
          }
        } else {
          // Se a requisição falhou, pelo menos salva o prop como snapshot
          loadedDataRef.current = { ...aluno };
        }
        if (resCursos.status === 'fulfilled') setCursosAcademico(Array.isArray(resCursos.value.data) ? resCursos.value.data : []);
        setCursosCarregados(true);
        if (resAnot.status === 'fulfilled') setAnotacoes(resAnot.value.data);
        if (resMov.status === 'fulfilled') setMovimentacoes(resMov.value.data);
        if (resDocs.status === 'fulfilled') { setUploadedDocs(resDocs.value.data?.documentos ?? []); setObrigatoriosPendentes(resDocs.value.data?.obrigatorios_pendentes ?? []); setTiposEnviados(resDocs.value.data?.tipos_enviados ?? []); setDocsCompleto(resDocs.value.data?.completo ?? false); }
      } catch (e: any) { console.error('DossieCandidato load:', e.response?.status); }
      finally { setLoading(false); }
    };
    load();
  }, [aluno.id]);

  useEffect(() => {
    if (!fichaData) return;
    if (fichaData.complemento) { setComplemento(p => ({ ...p, ...fichaData.complemento })); setComplementoCarregado(true); }
    if (fichaData.auto_declaracao) setFormData(p => ({ ...p, auto_declaracao: fichaData.auto_declaracao! }));
  }, [fichaData]);

  const handleCancelEdit = useCallback(() => {
    // Restaura snapshot da API (completo), não o prop parcial da lista
    setFormData(loadedDataRef.current ?? { ...aluno });
    setIsEditing(false);
  }, [aluno]);

  const handleUpdateStatus = async (novoStatus: string, motivo?: string) => {
    setLoading(true);
    try { await api.patch(`/matriculas/${aluno.id}/status`, { status: novoStatus, motivo }); onSuccess?.(); onClose(); }
    catch (e: any) { alert('Erro ao atualizar status: ' + (e.response?.data?.message || e.message)); }
    finally { setLoading(false); }
  };

  const handleEnviarLGPD = async () => {
    setLgpdLoading(true);
    try {
      await api.patch(`/matriculas/${aluno.id}/enviar-lgpd`);
      if (formData.status_matricula !== 'Matriculado') setFormData(p => ({ ...p, status_matricula: 'Aguardando Assinatura LGPD' }));
    } catch (e: any) { alert('Erro ao enviar LGPD: ' + (e.response?.data?.message || e.message)); }
    finally { setLgpdLoading(false); }
  };

  const gerarPdfLGPD = async () => {
    setPdfLoading(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const margin = 20; const pageW = 210; const contentW = pageW - margin * 2; let y = 20;
      const addText = (text: string, size: number, bold = false, color = '#000000') => {
        doc.setFontSize(size); doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setTextColor(color);
        const lines = doc.splitTextToSize(text, contentW); doc.text(lines, margin, y); y += lines.length * (size * 0.4) + 3;
      };
      const addLine = () => { doc.setDrawColor(200, 200, 200); doc.line(margin, y, pageW - margin, y); y += 4; };
      doc.setFillColor(30, 58, 95); doc.rect(0, 0, pageW, 28, 'F');
      doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor('#FFFFFF'); doc.text('Instituto Tia Pretinha', margin, 12);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.text('CNPJ nº 11.759.851/0001-39', margin, 19);
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text('Termo de Autorização de Uso de Imagem, Voz e Tratamento de Dados', margin, 25);
      y = 36;
      addText('DADOS DO CANDIDATO / RESPONSÁVEL', 9, true, '#1e3a5f'); addLine();
      addText(`Candidato(a): ${formData.nome_completo}`, 10);
      if (formData.cpf) addText(`CPF: ${formData.cpf}`, 10);
      if (formData.maior_18_anos === false && formData.nome_responsavel) { addText(`Responsável: ${formData.nome_responsavel}`, 10); if (formData.cpf_responsavel) addText(`CPF do Responsável: ${formData.cpf_responsavel}`, 10); }
      y += 4;
      for (const s of [
        { num: '1', titulo: 'Autorização de Uso de Imagem e Voz', texto: 'Autorizo o INSTITUTO TIA PRETINHA a captar, registrar, utilizar e divulgar imagens, vídeos e registros audiovisuais do participante obtidos durante atividades institucionais.' },
        { num: '2', titulo: 'Divulgação em Meios de Comunicação', texto: 'Estou ciente de que os registros poderão ser utilizados em materiais institucionais, redes sociais, relatórios e publicações de parceiros ou financiadores.' },
        { num: '3', titulo: 'Armazenamento em Ambiente Digital (Cloud)', texto: 'Declaro estar ciente de que dados pessoais e documentos poderão ser armazenados em sistemas eletrônicos e plataformas de nuvem utilizados pela instituição.' },
        { num: '4', titulo: 'Tratamento de Dados Pessoais (LGPD)', texto: 'Estou ciente de que os dados coletados serão utilizados para gestão administrativa e prestação de contas. O tratamento observará a Lei Geral de Proteção de Dados (LGPD).' },
        { num: '5', titulo: 'Gratuidade', texto: 'A autorização é concedida de forma gratuita, sem qualquer remuneração devida.' },
        { num: '6', titulo: 'Prazo', texto: 'A autorização possui prazo indeterminado, válida enquanto os registros forem necessários para fins institucionais.' },
        { num: '7', titulo: 'Direito de Revogação', texto: 'O titular poderá solicitar a revogação desta autorização a qualquer momento mediante solicitação formal ao Instituto.' },
      ]) {
        if (y > 240) { doc.addPage(); y = 20; }
        addText(`${s.num}. ${s.titulo}`, 10, true, '#1e3a5f'); addText(s.texto, 9); y += 2;
      }
      if (y > 200) { doc.addPage(); y = 20; } y += 4;
      addText('REGISTRO DE ASSINATURA ELETRÔNICA', 9, true, '#1e3a5f'); addLine();
      addText(`Assinado por: ${formData.nome_assinatura_imagem || formData.nome_completo}`, 10);
      addText(`Data e hora: ${formData.data_assinatura_lgpd ? new Date(formData.data_assinatura_lgpd).toLocaleString('pt-BR') : '—'}`, 10);
      if (formData.lgpd_ip) addText(`Endereço IP: ${formData.lgpd_ip}`, 10);
      if (formData.lgpd_user_agent) { const ua = String(formData.lgpd_user_agent); addText(`Navegador: ${ua.length > 120 ? ua.slice(0, 120) + '…' : ua}`, 9); }
      y += 6; addText('Este documento tem validade jurídica conforme Lei nº 14.063/2020.', 8, false, '#666666');
      addText('Instituto Tia Pretinha · CNPJ 11.759.851/0001-39', 8, false, '#666666');
      doc.save(`LGPD_${formData.nome_completo.replace(/\s+/g, '_')}_${new Date().getFullYear()}.pdf`);
    } catch (e: any) { alert('Erro ao gerar PDF: ' + e.message); }
    finally { setPdfLoading(false); }
  };

  const handleSolicitarDocumentos = async () => {
    setDocLoading(true);
    try { await api.post(`/matriculas/inscricao/${aluno.id}/enviar-link-documentos`); setFormData(p => ({ ...p, doc_token: 'enviado' })); }
    catch (e: any) { alert('Erro: ' + (e.response?.data?.message || e.message)); }
    finally { setDocLoading(false); }
  };

  const handleEfetivarMatricula = async () => {
    if (!cursosSelecionados.length) return;
    setLoading(true);
    try { const res = await api.post(`/matriculas/${aluno.id}/finalizar`, { turma_ids: cursosSelecionados }); setMatriculaNumero(res.data?.numero_matricula ?? null); setFormData(p => ({ ...p, status_matricula: 'Matriculado' })); onSuccess?.(); }
    catch (e: any) { alert('Falha na efetivação: ' + (e.response?.data?.message || e.message)); }
    finally { setLoading(false); }
  };

  const handleSaveEdit = async () => {
    setLoading(true);
    try {
      await api.patch(`/matriculas/inscricao/${aluno.id}`, formData);
      const alunoUuid = formData?.aluno?.id;
      if (alunoUuid && complementoCarregado) {
        const { auto_declaracao: _ad, orientacao_sexual: _os, ...campos } = complemento;
        const filtrado = Object.fromEntries(Object.entries(campos).filter(([, v]) => v !== '' && v !== null && v !== undefined));
        const reqs: Promise<any>[] = [api.patch(`/alunos/${alunoUuid}/complemento`, filtrado)];
        if (formData.auto_declaracao) reqs.push(api.patch(`/alunos/${alunoUuid}/auto-declaracao`, { auto_declaracao: formData.auto_declaracao }));
        if (complemento.orientacao_sexual) reqs.push(api.patch(`/alunos/${alunoUuid}/complemento`, { orientacao_sexual: complemento.orientacao_sexual }));
        const results = await Promise.allSettled(reqs);
        const falhou = results.find(r => r.status === 'rejected') as PromiseRejectedResult | undefined;
        if (falhou) alert('Dados principais salvos, mas dados complementares falharam.\n' + ((falhou.reason as any)?.response?.data?.message || ''));
      }
      // Atualiza o snapshot salvo com os dados editados
      loadedDataRef.current = { ...formData };
      setIsEditing(false);
      const resMov = await api.get(`/matriculas/inscricao/${aluno.id}/movimentacoes`);
      setMovimentacoes(resMov.data);
      onSuccess?.();
    } catch (e: any) { alert('Erro ao salvar: ' + (e.response?.data?.message || e.message)); }
    finally { setLoading(false); }
  };

  const handleAddAnotacao = async () => {
    if (!novaAnotacaoTexto.trim()) return;
    setLoading(true);
    try { const res = await api.post(`/matriculas/inscricao/${aluno.id}/anotacoes`, { texto_anotacao: novaAnotacaoTexto }); setAnotacoes(p => [res.data, ...p]); setNovaAnotacaoTexto(''); }
    catch (e: any) { alert('Erro ao anotar: ' + e.message); }
    finally { setLoading(false); }
  };

  const handleFieldChange = useCallback((field: string, value: any) => {
    setFormData(prev => {
      const u = { ...prev, [field]: value };
      if (field === 'data_nascimento' && value) {
        const d = new Date(value + 'T12:00:00');
        if (!isNaN(d.getTime())) {
          const hoje = new Date(); let idade = hoje.getFullYear() - d.getFullYear();
          const m = hoje.getMonth() - d.getMonth();
          if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) idade--;
          u.idade = idade; u.maior_18_anos = idade >= 18;
        }
      }
      return u;
    });
  }, []);

  const buscarCep = useCallback(async (cep: string) => {
    const limpo = cep.replace(/\D/g, '');
    if (limpo.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      const data = await res.json();
      if (!data.erro) setFormData(p => ({ ...p, logradouro: data.logradouro || p.logradouro, bairro: data.bairro || p.bairro, cidade: data.localidade || p.cidade, estado_uf: data.uf || p.estado_uf }));
    } catch {}
    finally { setBuscandoCep(false); }
  }, []);

  const fmtDate = (v?: string | null) => { if (!v) return '—'; if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return v; const s = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v + 'T12:00:00' : v; const d = new Date(s); return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR'); };
  const fmtDateTime = (v?: string | null) => { if (!v) return '—'; const d = new Date(v); return isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR'); };

  const alunoId = formData.aluno?.id ?? null;
  type TabDef = { id: TabId; label: string; icon: any; badge?: number; error?: boolean };
  const tabs: TabDef[] = [
    { id: 'cadastro',      label: 'Cadastro',     icon: User,          error: erroMaioridade },
    { id: 'anotacoes',     label: 'Anotações',    icon: MessageSquare, badge: anotacoes.length || undefined },
    { id: 'movimentacoes', label: 'Histórico',    icon: History },
    { id: 'documentos',    label: 'Documentos',   icon: Paperclip },
    ...(fichaData ? [{ id: 'presenca' as TabId,  label: 'Presença', icon: ClipboardCheck }] : []),
    ...(alunoId ? [
      { id: 'turmas_aluno' as TabId, label: 'Turmas', icon: GraduationCap },
      ...(mostrarComplemento ? [{ id: 'complemento_aluno' as TabId, label: 'Complemento', icon: UserCheck }] : []),
    ] : []),
  ];

  const statusInfo = STATUS_MAP[formData.status_matricula] ?? { label: formData.status_matricula, bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300', dot: 'bg-gray-400' };
  const headerGradient = STATUS_HEADER_GRADIENT[formData.status_matricula] ?? 'from-purple-50 to-violet-50/40';

  // Iniciais do avatar
  const initials = (formData.nome_completo || '?').split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase();

  return (
    <div className="fixed inset-0 z-[200] flex" onMouseDown={e => e.stopPropagation()}>
      <div
        className={`flex-1 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${drawerVisible ? 'opacity-100' : 'opacity-0'}`}
        onMouseDown={handleClose}
      />
      <div
        className={`w-full max-w-3xl bg-white flex flex-col h-full shadow-2xl transition-transform duration-300 ease-out ${drawerVisible ? 'translate-x-0' : 'translate-x-full'}`}
        onMouseDown={e => e.stopPropagation()}
      >

        {/* ── CABEÇALHO ─────────────────────────────────────────── */}
        <div className="shrink-0">
          {/* Banner de status com gradiente */}
          <div className={`bg-gradient-to-r ${headerGradient} border-b border-gray-200`}>
            <div className="px-5 pt-4 pb-3 flex items-start gap-4">
              {/* Avatar */}
              <div className="relative shrink-0">
                <div className={`w-16 h-16 rounded-2xl overflow-hidden border-2 border-white shadow-md ${!fotoUrl ? 'bg-gradient-to-br from-purple-500 to-violet-600' : ''}`}>
                  {fotoUrl
                    ? <img src={fotoUrl} className="w-full h-full object-cover" alt="" />
                    : <div className="w-full h-full flex items-center justify-center">
                        <span className="text-2xl font-bold text-white">{initials}</span>
                      </div>}
                </div>
                {/* Dot de status */}
                <span className={`absolute -bottom-1 -right-1 w-4 h-4 ${statusInfo.dot} border-2 border-white rounded-full shadow-sm`} />
              </div>

              {/* Identidade */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-gray-900 leading-tight truncate">{formData.nome_completo}</h2>
                    {formData.aluno?.numero_matricula && (
                      <p className="text-xs text-purple-600 font-mono font-semibold mt-0.5">{formData.aluno.numero_matricula}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                      {statusInfo.label}
                    </span>
                    {onVerNoAcademico && (
                      <button onClick={onVerNoAcademico}
                        title="Abrir ficha no Acadêmico"
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-black uppercase tracking-wide transition-colors shadow-sm">
                        <GraduationCap size={11} /> Acadêmico
                      </button>
                    )}
                    {onVerInscricao && (
                      <button onClick={onVerInscricao}
                        title="Abrir inscrição original em Matrículas"
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-wide transition-colors shadow-sm">
                        <ClipboardCheck size={11} /> Inscrição
                      </button>
                    )}
                    <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-white/70 text-gray-400 hover:text-gray-700 transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Metadados compactos */}
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {formData.cpf && (
                    <span className="flex items-center gap-1 text-xs text-gray-500 bg-white/70 rounded px-1.5 py-0.5">
                      <Hash size={10} className="shrink-0 text-gray-400" /> {formData.cpf}
                    </span>
                  )}
                  {formData.celular && formData.maior_18_anos && (
                    <a href={`https://wa.me/55${formData.celular.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 bg-white/70 rounded px-1.5 py-0.5 transition-colors">
                      <Phone size={10} className="shrink-0" /> {formData.celular}
                    </a>
                  )}
                  {formData.email && (
                    <span className="flex items-center gap-1 text-xs text-gray-500 bg-white/70 rounded px-1.5 py-0.5">
                      <Mail size={10} className="shrink-0 text-gray-400" /> {formData.email}
                    </span>
                  )}
                  {formData.data_inscricao && (
                    <span className="flex items-center gap-1 text-xs text-gray-400 bg-white/70 rounded px-1.5 py-0.5">
                      <Calendar size={10} className="shrink-0" /> {fmtDate(formData.data_inscricao)}
                    </span>
                  )}
                </div>

                {/* Turmas ativas */}
                {turmasAtivas.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {turmasAtivas.map((t: any) => (
                      <span key={t.id} className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full text-white shadow-sm ring-1 ring-black/10"
                        style={{ backgroundColor: t.turma_cor || '#7c3aed' }}>
                        {t.turma_nome}
                      </span>
                    ))}
                  </div>
                )}

                {/* Quick chips */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {formData.idade != null && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 border border-gray-200 text-gray-600">
                      {formData.idade} anos
                    </span>
                  )}
                  {formData.origem_inscricao && formData.origem_inscricao !== 'Manual' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 border border-gray-200 text-gray-600">
                      {formData.origem_inscricao === 'Direto' ? 'Matrícula Direta'
                        : formData.origem_inscricao.toLowerCase().includes('form') || formData.origem_inscricao.toLowerCase().includes('auto')
                          ? 'Inscrição Online'
                          : formData.origem_inscricao}
                    </span>
                  )}
                  {formData.lgpd_aceito && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 border border-green-200 text-green-700">
                      LGPD ✓
                    </span>
                  )}
                  {formData.escolaridade && (
                    <span title={formData.escolaridade} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 border border-gray-200 text-gray-600 max-w-[220px] truncate">
                      {formData.escolaridade}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Alerta de maioridade */}
            {erroMaioridade && (
              <div className="mx-5 mb-3 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                <AlertTriangle size={13} className="shrink-0 text-red-500" />
                <span><strong>Conflito:</strong> Marcado como maior de 18 anos, mas idade cadastrada é {formData.idade} anos.</span>
              </div>
            )}
          </div>

          {/* Abas */}
          <div className="flex px-2 overflow-x-auto bg-white border-b border-gray-200">
            {tabs.map(tab => {
              const active = abaAtiva === tab.id;
              return (
                <button key={tab.id} onClick={() => setAbaAtiva(tab.id)}
                  className={`relative flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap -mb-px ${
                    active
                      ? 'border-purple-600 text-purple-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}>
                  <tab.icon size={13} className={active ? 'text-purple-600' : ''} />
                  {tab.label}
                  {tab.badge != null && tab.badge > 0 && (
                    <span className={`ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{tab.badge}</span>
                  )}
                  {tab.error && <AlertTriangle size={11} className="text-red-500 ml-0.5" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── CONTEÚDO ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          {loading && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="animate-spin text-purple-500" size={28} />
              <p className="text-sm text-gray-400">Carregando dados...</p>
            </div>
          )}

          {/* ─── CADASTRO ─────────────────────────────────────── */}
          {!loading && abaAtiva === 'cadastro' && (
            <div className="p-4 space-y-3">

              <ColorSection title="Dados Pessoais" icon={<User size={14} />} color="purple">
                <Grid cols={3}>
                  <div className="col-span-3">
                    <EF label="Nome Completo" field="nome_completo" value={formData.nome_completo} editing={isEditing} onChange={handleFieldChange} />
                  </div>
                  <EF label="CPF" field="cpf" value={formData.cpf} editing={isEditing} onChange={handleFieldChange} />
                  <EF label="Data de Nascimento" field="data_nascimento" value={formData.data_nascimento} editing={isEditing} type="date" onChange={handleFieldChange} />
                  <div className="flex flex-col gap-0.5">
                    <FieldLabel>Idade</FieldLabel>
                    <FieldValue>{formData.idade != null ? `${formData.idade} anos` : '—'}</FieldValue>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <FieldLabel>Maior de 18 anos</FieldLabel>
                    {isEditing
                      ? <label className="flex items-center gap-2 cursor-pointer mt-1">
                          <input type="checkbox" checked={!!formData.maior_18_anos} onChange={e => handleFieldChange('maior_18_anos', e.target.checked)} className="w-4 h-4 accent-purple-600 rounded" />
                          <span className="text-sm text-gray-900 font-medium">{formData.maior_18_anos ? 'Sim' : 'Não'}</span>
                        </label>
                      : <FieldValue>{formData.maior_18_anos ? 'Sim' : 'Não'}</FieldValue>
                    }
                  </div>
                  <EF label="Sexo" field="sexo" value={formData.sexo} editing={isEditing} type="select"
                    options={['Masculino', 'Feminino', 'Outro', 'Não informado']} onChange={handleFieldChange} />
                  <EF label="Email" field="email" value={formData.email} editing={isEditing} onChange={handleFieldChange} />
                  {formData.maior_18_anos && <>
                    <EF label="Celular" field="celular" value={formData.celular} editing={isEditing} onChange={handleFieldChange} />
                    <EF label="Telefone Alternativo" field="telefone_alternativo" value={formData.telefone_alternativo} editing={isEditing} onChange={handleFieldChange} />
                  </>}
                  {formData.origem_inscricao !== 'Direto' && (
                    <div className="col-span-3">
                      <EF label="Cursos de Interesse" field="cursos_desejados" value={formData.cursos_desejados} editing={isEditing} onChange={handleFieldChange} />
                    </div>
                  )}
                </Grid>
              </ColorSection>

              <ColorSection title="Endereço" icon={<Home size={14} />} color="sky">
                <Grid cols={3}>
                  <div className="flex flex-col gap-0.5">
                    <FieldLabel>CEP {buscandoCep && <span className="text-sky-500 font-normal">(buscando...)</span>}</FieldLabel>
                    {isEditing
                      ? <input type="text" value={formData.cep ?? ''} maxLength={9} placeholder="00000-000"
                          onChange={e => { const v = e.target.value; handleFieldChange('cep', v); if (v.replace(/\D/g, '').length === 8) buscarCep(v); }}
                          onBlur={e => buscarCep(e.target.value)}
                          className={INPUT_CLS} />
                      : <FieldValue>{formData.cep || '—'}</FieldValue>}
                  </div>
                  <EF label="Logradouro" field="logradouro" value={formData.logradouro} editing={isEditing} onChange={handleFieldChange} />
                  <EF label="Número" field="numero" value={formData.numero} editing={isEditing} onChange={handleFieldChange} />
                  <EF label="Complemento" field="complemento" value={formData.complemento} editing={isEditing} onChange={handleFieldChange} />
                  <EF label="Bairro" field="bairro" value={formData.bairro} editing={isEditing} onChange={handleFieldChange} />
                  <EF label="Cidade" field="cidade" value={formData.cidade} editing={isEditing} onChange={handleFieldChange} />
                  <EF label="Estado (UF)" field="estado_uf" value={formData.estado_uf} editing={isEditing} onChange={handleFieldChange} />
                </Grid>
              </ColorSection>

              <ColorSection title="Escolaridade" icon={<GraduationCap size={14} />} color="indigo">
                <Grid cols={2}>
                  <EF label="Nível de Escolaridade" field="escolaridade" value={formData.escolaridade} editing={isEditing} type="select"
                    options={['Ensino Fundamental Incompleto', 'Ensino Fundamental Completo', 'Ensino Médio Incompleto', 'Ensino Médio Completo', 'Ensino Superior Incompleto', 'Ensino Superior Completo', 'Pós-Graduação', 'Não informado']}
                    onChange={handleFieldChange} fullWidth />
                  <EF label="Turno Escolar" field="turno_escolar" value={formData.turno_escolar} editing={isEditing} type="select"
                    options={['Manhã', 'Tarde', 'Noite', 'Integral', 'Não estuda no momento']} onChange={handleFieldChange} />
                </Grid>
              </ColorSection>

              <ColorSection title="Saúde" icon={<Heart size={14} />} color="rose">
                <Grid cols={3}>
                  <EF label="Alergias" field="possui_alergias" value={formData.possui_alergias} editing={isEditing} onChange={handleFieldChange} />
                  <EF label="Cuidado Especial" field="cuidado_especial" value={formData.cuidado_especial} editing={isEditing} onChange={handleFieldChange} />
                  <EF label="Uso de Medicamento" field="uso_medicamento" value={formData.uso_medicamento} editing={isEditing} onChange={handleFieldChange} />
                  <div className="col-span-3">
                    <EF label="Detalhes" field="detalhes_cuidado" value={formData.detalhes_cuidado} editing={isEditing} type="textarea" onChange={handleFieldChange} />
                  </div>
                </Grid>
              </ColorSection>

              {mostrarComplemento && (
                <ColorSection title="Identidade Social" icon={<Sparkles size={14} />} color="fuchsia">
                  <Grid cols={3}>
                    <SelectField label="Autodeclaração Racial" value={formData.auto_declaracao ?? ''} editing={isEditing}
                      onChange={v => handleFieldChange('auto_declaracao', v)}
                      options={[['', 'Prefiro não informar'], ['branco', 'Branco'], ['preto', 'Preto'], ['pardo', 'Pardo'], ['amarelo', 'Amarelo'], ['indigena', 'Indígena']]} />
                    <SelectField label="Orientação Sexual" value={formData.orientacao_sexual ?? ''} editing={isEditing}
                      onChange={v => handleFieldChange('orientacao_sexual', v)}
                      options={[['', 'Prefiro não informar'], ['heterossexual', 'Heterossexual'], ['homossexual', 'Homossexual'], ['bissexual', 'Bissexual'], ['panssexual', 'Pansexual'], ['assexual', 'Assexual'], ['outro', 'Outro']]} />
                    <SelectField label="Gênero" value={complemento.genero ?? ''} editing={isEditing}
                      onChange={v => setComplemento(p => ({ ...p, genero: v }))}
                      options={[['', 'Prefiro não informar'], ['masculino', 'Masculino'], ['feminino', 'Feminino'], ['nao_binario', 'Não-binário']]} />
                  </Grid>
                </ColorSection>
              )}

              {!formData.maior_18_anos && <ColorSection title="Responsável / Filiação" icon={<Users size={14} />} color="amber">
                <Grid cols={3}>
                  {(<>
                    <div className="col-span-3">
                      <EF label="Nome da Mãe / Responsável" field="nome_responsavel" value={formData.nome_responsavel} editing={isEditing} onChange={handleFieldChange} />
                    </div>
                    <EF label="Grau de Parentesco" field="grau_parentesco" value={formData.grau_parentesco} editing={isEditing} type="select"
                      options={['Mãe', 'Pai', 'Avó', 'Avô', 'Tia', 'Tio', 'Irmã', 'Irmão', 'Responsável Legal', 'Outro']} onChange={handleFieldChange} />
                    <EF label="CPF do Responsável" field="cpf_responsavel" value={formData.cpf_responsavel} editing={isEditing} onChange={handleFieldChange} />
                    <EF label="Email do Responsável" field="email_responsavel" value={formData.email_responsavel} editing={isEditing} onChange={handleFieldChange} />
                    <EF label="Telefone do Responsável" field="celular" value={formData.celular} editing={isEditing} onChange={handleFieldChange} />
                  </>)}
                </Grid>
              </ColorSection>}

              {/* Dados Complementares — apenas cursos especiais */}
              {mostrarComplemento && (
                <ColorSection title="Dados Complementares — Pré-ENCCEJA / Pré-Vestibular" icon={<CreditCard size={14} />} color="emerald">
                  <Grid cols={3}>
                    <div className="col-span-3">
                      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-3">Documentação Civil</p>
                    </div>
                    <CF label="RG" field="rg" comp={complemento} editing={isEditing} onChange={v => setComplemento(p => ({ ...p, rg: v }))} />
                    <CF label="Órgão Expedidor" field="orgao_expedidor" comp={complemento} editing={isEditing} onChange={v => setComplemento(p => ({ ...p, orgao_expedidor: v }))} />
                    <CF label="UF Expedição" field="uf_expedicao" comp={complemento} editing={isEditing} onChange={v => setComplemento(p => ({ ...p, uf_expedicao: v.toUpperCase().slice(0, 2) }))} />
                    <div className="col-span-3">
                      <CF label="Nome da Mãe" field="nome_mae" comp={complemento} editing={isEditing} onChange={v => setComplemento(p => ({ ...p, nome_mae: v }))} />
                    </div>
                    <Divider label="Dados Bancários" />
                    <div className="col-span-3">
                      <CF label="Banco" field="banco" comp={complemento} editing={isEditing} onChange={v => setComplemento(p => ({ ...p, banco: v }))} />
                    </div>
                    <CF label="Agência" field="agencia" comp={complemento} editing={isEditing} onChange={v => setComplemento(p => ({ ...p, agencia: v }))} />
                    <CF label="Dígito Agência" field="agencia_digito" comp={complemento} editing={isEditing} onChange={v => setComplemento(p => ({ ...p, agencia_digito: v }))} />
                    <SelectField label="Tipo de Conta" value={complemento.tipo_conta ?? ''} editing={isEditing}
                      onChange={v => setComplemento(p => ({ ...p, tipo_conta: v }))}
                      options={[['', '—'], ['corrente', 'Corrente'], ['poupanca', 'Poupança']]} />
                    <CF label="Conta" field="conta_corrente" comp={complemento} editing={isEditing} onChange={v => setComplemento(p => ({ ...p, conta_corrente: v }))} />
                    <CF label="Dígito Conta" field="conta_digito" comp={complemento} editing={isEditing} onChange={v => setComplemento(p => ({ ...p, conta_digito: v }))} />
                  </Grid>
                </ColorSection>
              )}

              {/* LGPD */}
              {(() => {
                const assinado = !!formData.data_assinatura_lgpd;
                const dataAss = assinado ? new Date(formData.data_assinatura_lgpd) : null;
                const umAnoAtras = new Date(); umAnoAtras.setFullYear(umAnoAtras.getFullYear() - 1);
                const precisaRenovar = dataAss && dataAss < umAnoAtras;
                const venc = dataAss ? new Date(dataAss.getTime()) : null;
                if (venc) venc.setFullYear(venc.getFullYear() + 1);
                return (
                  <ColorSection title="LGPD" icon={<ShieldCheck size={14} />} color="teal">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                            precisaRenovar ? 'bg-orange-100 text-orange-700 border-orange-300'
                              : assinado ? 'bg-green-100 text-green-700 border-green-300'
                              : formData.lgpd_aceito ? 'bg-blue-100 text-blue-700 border-blue-300'
                              : 'bg-amber-100 text-amber-700 border-amber-300'
                          }`}>
                            {precisaRenovar ? '⚠ Renovação necessária' : assinado ? '✓ Assinado' : formData.lgpd_aceito ? '✓ Confirmado' : '○ Pendente'}
                          </span>
                          {assinado && <span className="text-xs text-gray-400">em {dataAss!.toLocaleDateString('pt-BR')}</span>}
                          {precisaRenovar && <span className="text-xs text-orange-600">Vencimento: {venc?.toLocaleDateString('pt-BR')}</span>}
                        </div>
                        {assinado && formData.lgpd_ip && <p className="text-xs text-gray-400 mt-1">IP: <span className="font-mono">{formData.lgpd_ip}</span></p>}
                      </div>
                      <div className="flex gap-2">
                        {assinado && (
                          <button onClick={gerarPdfLGPD} disabled={pdfLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60">
                            {pdfLoading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} PDF
                          </button>
                        )}
                        <button onClick={handleEnviarLGPD} disabled={lgpdLoading}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-60">
                          {lgpdLoading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                          {assinado ? 'Renovar' : formData.lgpd_aceito ? 'Reenviar' : 'Enviar Termo'}
                        </button>
                      </div>
                    </div>
                  </ColorSection>
                );
              })()}
            </div>
          )}

          {/* ─── ANOTAÇÕES ────────────────────────────────────── */}
          {!loading && abaAtiva === 'anotacoes' && (
            <div className="p-4 space-y-3">
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4">
                  <textarea value={novaAnotacaoTexto} onChange={e => setNovaAnotacaoTexto(e.target.value)}
                    placeholder="Registrar anotação interna..."
                    className="w-full text-sm text-gray-900 h-20 outline-none resize-none placeholder-gray-400" />
                </div>
                <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex justify-end">
                  <button onClick={handleAddAnotacao} disabled={loading || !novaAnotacaoTexto.trim()}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors">
                    <Send size={11} /> Registrar
                  </button>
                </div>
              </div>

              {anotacoes.length === 0
                ? <EmptyState icon={<MessageSquare size={22} />} text="Nenhuma anotação registrada." />
                : anotacoes.map((anot) => (
                    <div key={anot.id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-violet-500 border-2 border-white shadow flex items-center justify-center overflow-hidden shrink-0 mt-0.5">
                        {anot.usuario_foto
                          ? <img src={(() => { const f = anot.usuario_foto; if (!f) return ''; return f.startsWith('http') || f.startsWith('/uploads/') ? f : `${API_ORIGIN}${f}`; })()} className="w-full h-full object-cover" alt="" />
                          : <span className="text-xs font-bold text-white">{(anot.usuario_nome || '?')[0].toUpperCase()}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="bg-white border border-gray-200 rounded-xl rounded-tl-sm px-4 py-3 shadow-sm">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <p className="text-xs font-semibold text-gray-800">{anot.usuario_nome || 'Usuário'}</p>
                            <p className="text-[11px] text-gray-400">{fmtDateTime(anot.created_at)}</p>
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{anot.texto_anotacao}</p>
                        </div>
                      </div>
                    </div>
                  ))}
            </div>
          )}

          {/* ─── HISTÓRICO ────────────────────────────────────── */}
          {!loading && abaAtiva === 'movimentacoes' && (
            <div className="p-4">
              {movimentacoes.length === 0
                ? <EmptyState icon={<History size={22} />} text="Nenhuma movimentação registrada." />
                : <div className="relative pl-6">
                    {/* Linha vertical da timeline */}
                    <div className="absolute left-2.5 top-4 bottom-4 w-0.5 bg-gray-200 rounded-full" />
                    <div className="space-y-3">
                      {movimentacoes.map(mov => {
                        const dotColor = mov.tipo === 'Status' ? 'bg-blue-500' : mov.tipo === 'Edição' ? 'bg-amber-400' : 'bg-red-500';
                        const badgeCls = mov.tipo === 'Status' ? 'bg-blue-50 text-blue-700 border-blue-200' : mov.tipo === 'Edição' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200';
                        return (
                          <div key={mov.id} className="relative">
                            <div className={`absolute -left-[17px] top-3.5 w-3 h-3 rounded-full ${dotColor} border-2 border-white shadow-sm z-10`} />
                            <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${badgeCls}`}>{mov.tipo}</span>
                                  {mov.categoria && <span className="text-xs text-gray-500">{mov.categoria.replace(/_/g, ' ')}</span>}
                                </div>
                                <span className="text-[11px] text-gray-400 whitespace-nowrap shrink-0">{fmtDateTime(mov.created_at)}</span>
                              </div>
                              {mov.valor_antes !== mov.valor_depois && (
                                <div className="flex items-center gap-2 mt-2 text-xs font-mono bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5">
                                  <span className="text-gray-400 line-through truncate max-w-[120px]">{mov.valor_antes || '(vazio)'}</span>
                                  <ChevronRight size={10} className="text-gray-400 shrink-0" />
                                  <span className="text-gray-800 font-semibold truncate max-w-[120px]">{mov.valor_depois || '(vazio)'}</span>
                                </div>
                              )}
                              <p className="text-[11px] text-gray-400 mt-1.5">{mov.usuario_nome}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>}
            </div>
          )}

          {/* ─── DOCUMENTOS ───────────────────────────────────── */}
          {!loading && abaAtiva === 'documentos' && (
            <div className="p-4 space-y-3">
              {!loadingDocs && (
                <div className={`px-4 py-3 rounded-xl border shadow-sm ${docsCompleto ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Documentação {docsCompleto ? 'completa' : 'incompleta'}</p>
                      {obrigatoriosPendentes.length > 0 && (
                        <p className="text-xs text-gray-500 mt-0.5">Pendentes: {obrigatoriosPendentes.map(t => DOC_LABELS[t] ?? t).join(', ')}</p>
                      )}
                      {tiposEnviados.length > 0 && (
                        <p className="text-xs text-green-700 mt-0.5">Enviados: <strong>{tiposEnviados.map(t => DOC_LABELS[t] ?? t).join(', ')}</strong></p>
                      )}
                    </div>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full border shrink-0 ${docsCompleto ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                      {docsCompleto ? '✓ Completo' : 'Pendente'}
                    </span>
                  </div>
                  {(() => {
                    const done = tiposEnviados.length;
                    const total = done + obrigatoriosPendentes.length;
                    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                    return (
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] text-gray-500">{done} de {total} obrigatórios</span>
                          <span className="text-[11px] font-bold text-gray-700">{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-white/70 rounded-full overflow-hidden border border-gray-200/60">
                          <div className={`h-full rounded-full transition-all duration-500 ${docsCompleto ? 'bg-green-500' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Upload */}
              {cameraDocTipo && (
                <DocumentCamera
                  tipo={cameraDocTipo}
                  onCapture={async (blob) => {
                    setCameraDocTipo(null);
                    setUploadingDoc(true);
                    try {
                      const fd = new FormData();
                      fd.append('arquivo', blob, `${cameraDocTipo}.jpg`);
                      fd.append('tipo', cameraDocTipo);
                      if (cameraDocTipo === 'extra' && uploadNomeExtra.trim()) fd.append('nome_extra', uploadNomeExtra.trim());
                      await api.post(`/matriculas/inscricao/${formData.id}/documentos/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                      setUploadNomeExtra(''); recarregarDocumentos();
                    } catch (err: any) { alert(err?.response?.data?.message || 'Erro ao enviar documento.'); }
                    finally { setUploadingDoc(false); }
                  }}
                  onClose={() => setCameraDocTipo(null)}
                />
              )}
              <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 shadow-sm">
                <p className="text-xs font-semibold text-gray-700">Adicionar documento</p>
                <div className="flex gap-2 flex-wrap">
                  <div className="relative w-full">
                    <select value={uploadTipo} onChange={e => setUploadTipo(e.target.value)} className="w-full h-9 pl-2.5 pr-8 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white appearance-none">
                      {Object.entries(DOC_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      <option value="extra">Outro</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                  </div>
                  {uploadTipo === 'extra' && (
                    <input type="text" placeholder="Nome do documento" value={uploadNomeExtra} onChange={e => setUploadNomeExtra(e.target.value)} className={`${INPUT_CLS} flex-1 min-w-[140px]`} />
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={uploadingDoc}
                    onClick={() => setCameraDocTipo(uploadTipo)}
                    className={`flex items-center justify-center gap-2 flex-1 py-3 border rounded-xl text-xs font-medium transition-colors ${
                      uploadingDoc ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                        : 'border-purple-300 hover:border-purple-500 bg-purple-50/40 hover:bg-purple-50 text-purple-700'
                    }`}>
                    <Camera size={13} /> Tirar foto
                  </button>
                  <label className={`flex items-center justify-center gap-2 flex-1 py-3 border rounded-xl cursor-pointer transition-colors text-xs font-medium text-center ${
                    uploadingDoc ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                      : 'border-dashed border-gray-300 hover:border-purple-400 hover:bg-purple-50/20 text-gray-500 hover:text-purple-700'
                  }`}>
                    {uploadingDoc
                      ? <><Loader2 size={13} className="animate-spin" /> Enviando...</>
                      : <><Paperclip size={13} /><span>Selecionar arquivo</span></>}
                    <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={uploadingDoc} className="hidden"
                      onChange={async e => {
                        const file = e.target.files?.[0]; if (!file) return; setUploadingDoc(true);
                        try {
                          const fd = new FormData(); fd.append('arquivo', file); fd.append('tipo', uploadTipo);
                          if (uploadTipo === 'extra' && uploadNomeExtra.trim()) fd.append('nome_extra', uploadNomeExtra.trim());
                          await api.post(`/matriculas/inscricao/${formData.id}/documentos/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                          e.target.value = ''; setUploadNomeExtra(''); recarregarDocumentos();
                        } catch (err: any) { alert(err?.response?.data?.message || 'Erro ao enviar documento.'); }
                        finally { setUploadingDoc(false); }
                      }} />
                  </label>
                </div>
                <p className="text-[10px] text-gray-400 text-center">JPG, PNG, PDF · máx 8 MB</p>
              </div>

              {(formData.url_documentos_zip || formData.url_termo_lgpd) && (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-gray-400 font-medium px-1">Enviados via Google Forms</p>
                  <DocLink label="Pacote de documentos (ZIP)" url={formData.url_documentos_zip} icon={<Paperclip size={13} />} />
                  <DocLink label="Termo LGPD assinado" url={formData.url_termo_lgpd} icon={<ShieldCheck size={13} />} />
                </div>
              )}

              {loadingDocs
                ? <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-400" size={20} /></div>
                : uploadedDocs.length > 0
                  ? <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 shadow-sm overflow-hidden">
                      {uploadedDocs.map(doc => {
                        const nome = DOC_LABELS[doc.tipo] ?? doc.nome_extra ?? doc.tipo;
                        const fileUrl = (doc.url_arquivo.startsWith('data:') || doc.url_arquivo.startsWith('http')) ? doc.url_arquivo : `${API_ORIGIN}${doc.url_arquivo}`;
                        const bytes = doc.tamanho_bytes ?? 0;
                        const size = bytes > 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : bytes > 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${bytes} B`;
                        return (
                          <div key={doc.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center shrink-0">
                                <FileText size={14} className="text-purple-500" />
                              </div>
                              <div className="min-w-0">
                                <a href={safeUrl(fileUrl)} target="_blank" rel="noopener noreferrer"
                                  className="text-sm text-purple-700 font-medium truncate hover:underline flex items-center gap-1 max-w-full">
                                  <span className="truncate">{nome}</span>
                                  <ExternalLink size={10} className="shrink-0 text-purple-400" />
                                </a>
                                <p className="text-[11px] text-gray-400">{fmtDate(doc.createdAt)} · {size}</p>
                              </div>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button onClick={async () => { if (!confirm(`Remover "${nome}"?`)) return; try { await api.delete(`/matriculas/documentos/${doc.id}`); recarregarDocumentos(); } catch { alert('Erro ao remover.'); } }}
                                className="flex items-center px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors">
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  : <EmptyState icon={<Paperclip size={22} />} text="Nenhum documento enviado." />}

              {/* Efetivar Matrícula */}
              {['Em Validação', 'Aguardando Documentos', 'Documentos Enviados'].includes(formData.status_matricula) && (
                <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="text-sm font-bold text-gray-900">Efetivar Matrícula</p>
                    {formData.cursos_desejados && <span className="text-xs text-gray-400">Interesse: <span className="text-gray-700">{formData.cursos_desejados}</span></span>}
                  </div>
                  {!cursosCarregados ? <p className="text-xs text-gray-500">Carregando turmas...</p>
                    : cursosAcademico.length === 0 ? <p className="text-xs text-red-500">Nenhuma turma ativa disponível.</p>
                    : <div className="space-y-3">
                        {cursosAcademico.map(curso => (
                          <div key={curso.id}>
                            <p className="text-xs font-semibold text-gray-500 mb-2">{curso.sigla} — {curso.nome}</p>
                            <div className="grid grid-cols-2 gap-1.5">
                              {curso.turmas.map(t => {
                                const ativo = cursosSelecionados.includes(t.id);
                                return (
                                  <label key={t.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all select-none ${ativo ? 'border-purple-400 bg-purple-50 text-purple-700 shadow-sm' : 'border-gray-200 bg-white text-gray-700 hover:border-purple-200 hover:bg-purple-50/20'}`}>
                                    <input type="checkbox" checked={ativo} onChange={() => setCursosSelecionados(p => p.includes(t.id) ? p.filter(c => c !== t.id) : [...p, t.id])}
                                      className="w-3.5 h-3.5 shrink-0 accent-purple-600" />
                                    <span className="text-xs font-medium">{t.nome}{t.codigo ? <span className="font-normal text-gray-400 ml-1">({t.codigo})</span> : ''}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>}
                  <button onClick={handleEfetivarMatricula} disabled={!cursosSelecionados.length || loading}
                    className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-sm">
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                    Efetivar Matrícula{cursosSelecionados.length > 0 ? ` (${cursosSelecionados.length} turma${cursosSelecionados.length > 1 ? 's' : ''})` : ''}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ─── PRESENÇA ─────────────────────────────────────── */}
          {/* ─── TURMAS DO ALUNO ──────────────────────────────── */}
          {!loading && abaAtiva === 'turmas_aluno' && alunoId && (
            <div className="p-4 space-y-3">
              {turmasDoAluno.length === 0
                ? <EmptyState icon={<GraduationCap size={22} />} text="Nenhuma turma vinculada." />
                : (
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="divide-y divide-gray-100">
                      {turmasDoAluno.map((t: any) => (
                        <div key={t.id ?? t.turma_id} className="flex items-center gap-3 px-4 py-3">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.turma_cor || '#7c3aed' }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{t.turma_nome}</p>
                            {t.curso_nome && <p className="text-xs text-gray-400">{t.curso_nome}</p>}
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            t.status === 'ativo'
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-gray-100 text-gray-500 border-gray-200'
                          }`}>{t.status === 'ativo' ? 'Ativo' : 'Inativo'}</span>
                          {t.data_entrada && (
                            <span className="text-[10px] text-gray-400">{fmtDate(t.data_entrada)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* ─── COMPLEMENTO DO ALUNO ─────────────────────────── */}
          {!loading && abaAtiva === 'complemento_aluno' && alunoId && mostrarComplemento && (
            <div className="p-4 space-y-3">
              <ColorSection title="Dados Complementares" icon={<UserCheck size={14} />} color="indigo">
                <Grid cols={3}>
                  <CF label="RG" field="rg" comp={complemento} editing={false} onChange={() => {}} />
                  <CF label="Órgão Expedidor" field="orgao_expedidor" comp={complemento} editing={false} onChange={() => {}} />
                  <CF label="UF Expedição" field="uf_expedicao" comp={complemento} editing={false} onChange={() => {}} />
                  <CF label="Gênero" field="genero" comp={complemento} editing={false} onChange={() => {}} />
                  <CF label="Orientação Sexual" field="orientacao_sexual" comp={complemento} editing={false} onChange={() => {}} />
                  <CF label="Nome da Mãe" field="nome_mae" comp={complemento} editing={false} onChange={() => {}} />
                </Grid>
              </ColorSection>
              <ColorSection title="Dados Bancários" icon={<CreditCard size={14} />} color="emerald">
                <Grid cols={3}>
                  <CF label="Banco" field="banco" comp={complemento} editing={false} onChange={() => {}} />
                  <CF label="Agência" field="agencia" comp={complemento} editing={false} onChange={() => {}} />
                  <CF label="Dígito Agência" field="agencia_digito" comp={complemento} editing={false} onChange={() => {}} />
                  <CF label="Conta Corrente" field="conta_corrente" comp={complemento} editing={false} onChange={() => {}} />
                  <CF label="Dígito Conta" field="conta_digito" comp={complemento} editing={false} onChange={() => {}} />
                  <CF label="Tipo de Conta" field="tipo_conta" comp={complemento} editing={false} onChange={() => {}} />
                </Grid>
              </ColorSection>
            </div>
          )}

          {!loading && abaAtiva === 'presenca' && fichaData && (
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Presenças', val: totalPresencas, bg: 'bg-green-500', light: 'bg-green-50', border: 'border-green-200', num: 'text-green-700', lbl: 'text-green-600' },
                  { label: 'Faltas', val: totalFaltas, bg: 'bg-red-500', light: 'bg-red-50', border: 'border-red-200', num: 'text-red-700', lbl: 'text-red-500' },
                  { label: 'Frequência', val: totalPresencas + totalFaltas > 0 ? `${Math.round((totalPresencas / (totalPresencas + totalFaltas)) * 100)}%` : '—', bg: 'bg-purple-500', light: 'bg-purple-50', border: 'border-purple-200', num: 'text-purple-700', lbl: 'text-purple-600' },
                ].map(k => (
                  <div key={k.label} className={`${k.light} border ${k.border} rounded-xl p-4 text-center shadow-sm`}>
                    <p className={`text-[11px] font-semibold mb-1 ${k.lbl}`}>{k.label}</p>
                    <p className={`text-3xl font-black ${k.num}`}>{k.val}</p>
                  </div>
                ))}
              </div>

              {frequencia.length > 0
                ? <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                      <p className="text-xs font-semibold text-gray-600">Registro por aula</p>
                    </div>
                    <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                      {frequencia.map((f: any) => (
                        <div key={f.id} className="flex items-center gap-3 px-4 py-2.5">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${f.descricao === 'Presente' ? 'bg-green-500' : 'bg-red-400'}`} />
                          <span className="text-sm text-gray-700 flex-1">{fmtDate(f.data)}</span>
                          <span className={`text-xs font-semibold ${f.descricao === 'Presente' ? 'text-green-600' : 'text-red-500'}`}>{f.descricao}</span>
                          {f.justificada && <span className="text-[11px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-100">Justificada</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                : <EmptyState icon={<ClipboardCheck size={22} />} text="Nenhum registro de presença." />}

              {historico.filter((h: any) => h.tipo !== 'Presença').length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-600">Ocorrências</p>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {historico.filter((h: any) => h.tipo !== 'Presença').map((h: any) => (
                      <div key={h.id} className="px-4 py-3 flex gap-3">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border self-start shrink-0 ${
                          h.tipo === 'Incidente' ? 'bg-red-50 text-red-700 border-red-200'
                            : h.tipo === 'Advertência' ? 'bg-orange-50 text-orange-700 border-orange-200'
                            : 'bg-purple-50 text-purple-700 border-purple-200'
                        }`}>{h.tipo}</span>
                        <div>
                          {h.titulo && <p className="text-sm font-semibold text-gray-900">{h.titulo}</p>}
                          {h.descricao && <p className="text-xs text-gray-500 mt-0.5">{h.descricao}</p>}
                          <p className="text-[11px] text-gray-400 mt-1">{fmtDate(h.data)} · {h.usuario_nome}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── RODAPÉ ────────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-3 flex items-center gap-2 flex-wrap">
          {['Em Validação', 'Aguardando Documentos'].includes(formData.status_matricula) && (
            <button onClick={handleSolicitarDocumentos} disabled={docLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60">
              {docLoading ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
              {formData.doc_token ? 'Reenviar link de docs' : 'Solicitar documentos'}
              {formData.doc_token && <span className="text-green-600 ml-0.5">✓</span>}
            </button>
          )}

          <div className="flex-1" />

          <button onClick={() => setShowMotivoModal({ show: true, status: 'Incompleto' })}
            className="px-3 py-1.5 border border-amber-300 text-amber-700 rounded-lg text-xs font-semibold hover:bg-amber-50 transition-colors">
            Incompleto
          </button>
          <button onClick={() => setShowMotivoModal({ show: true, status: 'Desistente' })}
            className="px-3 py-1.5 border border-red-300 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-50 transition-colors">
            Desistência
          </button>

          {isEditing ? (<>
            <button onClick={handleCancelEdit}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button onClick={handleSaveEdit} disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-60 shadow-sm">
              {loading ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Salvar
            </button>
          </>) : (
            <button onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm">
              <Edit3 size={11} /> Editar
            </button>
          )}
        </div>
      </div>

      {/* MODAL: Matrícula efetivada */}
      {matriculaNumero && (
        <div className="fixed inset-0 bg-black/60 z-[350] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={28} className="text-green-600" />
            </div>
            <p className="text-xs text-gray-400 mb-1">Matrícula efetivada com sucesso</p>
            <h2 className="text-lg font-bold text-gray-900 mb-4">{formData.nome_completo.split(' ')[0]}</h2>
            <div className="bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-200 rounded-xl px-4 py-3 mb-5">
              <p className="text-xs text-purple-500 mb-1 font-medium">Número de Matrícula</p>
              <p className="text-2xl font-black text-purple-700 font-mono tracking-wider">{matriculaNumero}</p>
            </div>
            <button onClick={() => { setMatriculaNumero(null); onClose(); }}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold transition-colors">
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Justificativa */}
      {showMotivoModal.show && (
        <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md rounded-2xl p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-gray-900 mb-0.5">Alterar status</h3>
            <p className="text-xs text-gray-500 mb-4">Novo status: <span className="font-semibold text-gray-800">{showMotivoModal.status}</span></p>
            <textarea value={motivoTexto} onChange={e => setMotivoTexto(e.target.value)}
              placeholder="Descreva o motivo da alteração..."
              className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-900 h-28 outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none" />
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => { setShowMotivoModal({ show: false, status: null }); setMotivoTexto(''); }}
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={() => handleUpdateStatus(showMotivoModal.status!, motivoTexto)} disabled={!motivoTexto.trim() || loading}
                className="px-5 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors">
                {loading ? <Loader2 size={13} className="animate-spin mx-auto" /> : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Constantes de estilo ───────────────────────────────────────

const INPUT_CLS = 'h-8 px-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 w-full bg-white';

// ── Mapa de cores por seção ────────────────────────────────────

const COLOR_MAP = {
  purple:  { header: 'bg-purple-50',  border: 'border-purple-200',  icon: 'text-purple-600',  bar: 'bg-purple-500',  title: 'text-purple-800' },
  sky:     { header: 'bg-sky-50',     border: 'border-sky-200',     icon: 'text-sky-600',     bar: 'bg-sky-500',     title: 'text-sky-800' },
  indigo:  { header: 'bg-indigo-50',  border: 'border-indigo-200',  icon: 'text-indigo-600',  bar: 'bg-indigo-500',  title: 'text-indigo-800' },
  rose:    { header: 'bg-rose-50',    border: 'border-rose-200',    icon: 'text-rose-600',    bar: 'bg-rose-500',    title: 'text-rose-800' },
  fuchsia: { header: 'bg-fuchsia-50', border: 'border-fuchsia-200', icon: 'text-fuchsia-600', bar: 'bg-fuchsia-500', title: 'text-fuchsia-800' },
  amber:   { header: 'bg-amber-50',   border: 'border-amber-200',   icon: 'text-amber-600',   bar: 'bg-amber-500',   title: 'text-amber-800' },
  emerald: { header: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-600', bar: 'bg-emerald-500', title: 'text-emerald-800' },
  teal:    { header: 'bg-teal-50',    border: 'border-teal-200',    icon: 'text-teal-600',    bar: 'bg-teal-500',    title: 'text-teal-800' },
} as const;

type ColorKey = keyof typeof COLOR_MAP;

// ── Componentes de layout ──────────────────────────────────────

function ColorSection({ title, icon, color, children }: { title: string; icon: React.ReactNode; color: ColorKey; children: React.ReactNode }) {
  const c = COLOR_MAP[color];
  return (
    <div className={`bg-white rounded-xl border ${c.border} overflow-hidden shadow-sm`}>
      <div className={`${c.header} border-b ${c.border} px-4 py-2.5 flex items-center gap-2`}>
        <span className={`w-1 h-4 ${c.bar} rounded-full shrink-0`} />
        <span className={`${c.icon} shrink-0`}>{icon}</span>
        <h3 className={`text-xs font-bold ${c.title} uppercase tracking-wide`}>{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Grid({ cols, children }: { cols: 2 | 3; children: React.ReactNode }) {
  return <div className={`grid gap-x-4 gap-y-4 ${cols === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>{children}</div>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide leading-tight block mb-0.5">{children}</label>;
}

function FieldValue({ children }: { children: React.ReactNode }) {
  const empty = !children;
  return (
    <div className={`mt-0.5 px-2.5 py-1.5 rounded-lg border min-h-[32px] flex items-center ${empty ? 'bg-transparent border-transparent' : 'bg-gray-50 border-gray-100'}`}>
      <span className={`text-sm font-medium leading-snug ${empty ? 'text-gray-300' : 'text-gray-900'}`}>{children || '—'}</span>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="col-span-3 pt-1 border-t border-gray-100 flex items-center gap-2">
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-300">
      <span className="mb-3 text-gray-200">{icon}</span>
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  );
}

// ── Componentes de campo ───────────────────────────────────────

function EF({ label, field, value, editing, type = 'text', onChange, options, fullWidth }: {
  label: string; field: string; value: any; editing: boolean;
  type?: 'text' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox';
  onChange: (f: string, v: any) => void; options?: string[]; fullWidth?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-0.5 ${fullWidth ? 'sm:col-span-2' : ''}`}>
      <FieldLabel>{label}</FieldLabel>
      {editing ? (
        type === 'textarea'
          ? <textarea value={value ?? ''} onChange={e => onChange(field, e.target.value)} rows={3}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none bg-white" />
          : type === 'select' && options
            ? <div className="relative">
                <select value={value ?? ''} onChange={e => onChange(field, e.target.value)} className={`${INPUT_CLS} appearance-none pr-7`}>
                  <option value="">—</option>
                  {value && !options.includes(value) && <option value={value}>{value}</option>}
                  {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
              </div>
            : type === 'checkbox'
              ? <label className="flex items-center gap-2 cursor-pointer mt-1">
                  <input type="checkbox" checked={!!value} onChange={e => onChange(field, e.target.checked)} className="w-4 h-4 accent-purple-600 rounded" />
                  <span className="text-sm text-gray-900 font-medium">{value ? 'Sim' : 'Não'}</span>
                </label>
              : type === 'date'
                ? <input type="date" value={value ? String(value).slice(0, 10) : ''} onChange={e => onChange(field, e.target.value)} className={INPUT_CLS} />
                : <input type={type} value={value ?? ''} onChange={e => onChange(field, type === 'number' ? Number(e.target.value) : e.target.value)} className={INPUT_CLS} />
      ) : (
        type === 'checkbox'
          ? <FieldValue>{value ? 'Sim' : 'Não'}</FieldValue>
          : <FieldValue>
              {value
                ? (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)
                    ? new Date(value + 'T12:00:00').toLocaleDateString('pt-BR')
                    : String(value))
                : undefined}
            </FieldValue>
      )}
    </div>
  );
}

function CF({ label, field, comp, editing, onChange }: {
  label: string; field: string; comp: Record<string, string>; editing: boolean; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <FieldLabel>{label}</FieldLabel>
      {editing
        ? <input value={comp[field] ?? ''} onChange={e => onChange(e.target.value)} className={INPUT_CLS} />
        : <FieldValue>{comp[field] || undefined}</FieldValue>}
    </div>
  );
}

function SelectField({ label, value, editing, onChange, options }: {
  label: string; value: string; editing: boolean;
  onChange: (v: string) => void; options: [string, string][];
}) {
  const display = options.find(([v]) => v === value)?.[1] || '—';
  return (
    <div className="flex flex-col gap-0.5">
      <FieldLabel>{label}</FieldLabel>
      {editing
        ? <select value={value} onChange={e => onChange(e.target.value)} className={INPUT_CLS}>
            {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        : <FieldValue>{value ? display : undefined}</FieldValue>}
    </div>
  );
}

function DocLink({ label, url, icon }: { label: string; url?: string; icon: React.ReactNode }) {
  if (!url) return null;
  return (
    <a href={safeUrl(url)} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-3 px-4 py-2.5 bg-white border border-gray-200 rounded-xl hover:bg-purple-50/40 hover:border-purple-200 transition-colors group shadow-sm">
      <span className="text-gray-400 group-hover:text-purple-500 transition-colors shrink-0">{icon}</span>
      <span className="text-sm text-gray-700 flex-1 font-medium">{label}</span>
      <ExternalLink size={12} className="text-gray-400 group-hover:text-purple-400" />
    </a>
  );
}
