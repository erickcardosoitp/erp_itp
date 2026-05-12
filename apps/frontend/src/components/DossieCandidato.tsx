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
  } catch { /* URL relativa ou inválida */ }
  if (url.startsWith('/')) return url;
  return '#';
};
import api from '@/services/api';

interface Materia { id: string; nome: string; }

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

/** Dados extras de aluno matriculado (vindos de /academico/alunos/:id/ficha) */
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

  const [showMotivoModal, setShowMotivoModal] = useState<{ show: boolean; status: string | null }>({
    show: false, status: null,
  });
  const [motivoTexto, setMotivoTexto] = useState('');
  const [lgpdLoading, setLgpdLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [docLoading, setDocLoading] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<DocEnviado[]>([]);
  const [obrigatoriosPendentes, setObrigatoriosPendentes] = useState<string[]>([]);
  const [docsCompleto, setDocsCompleto] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [matriculaNumero, setMatriculaNumero] = useState<string | null>(null);

  const erroMaioridade = formData.idade < 18 && formData.maior_18_anos === true;

  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadTipo, setUploadTipo] = useState('identidade');
  const [uploadNomeExtra, setUploadNomeExtra] = useState('');

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

  // Se fichaData fornecido, pré-popula complemento
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

  // ── Handlers ────────────────────────────────────────────────
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
      // Não chama onSuccess para não fechar o dossiê
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
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor('#FFFFFF');
      doc.text('Instituto Tia Pretinha', margin, 12);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('CNPJ nº 11.759.851/0001-39', margin, 19);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
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
        { num: '1', titulo: 'Autorização de Uso de Imagem e Voz', texto: 'Autorizo o INSTITUTO TIA PRETINHA a captar, registrar, utilizar e divulgar imagens, vídeos, gravações de áudio e demais registros audiovisuais do participante obtidos durante atividades institucionais, incluindo: aulas, oficinas e treinamentos; atividades esportivas e culturais; eventos institucionais; apresentações públicas; ações sociais e comunitárias; projetos educacionais ou culturais.' },
        { num: '2', titulo: 'Divulgação em Meios de Comunicação', texto: 'Estou ciente de que os registros poderão ser utilizados em materiais institucionais e canais de comunicação do Instituto, incluindo: redes sociais, website institucional, relatórios institucionais, materiais gráficos ou digitais, apresentações institucionais, prestação de contas de projetos, editais, relatórios e publicações de parceiros ou financiadores.' },
        { num: '3', titulo: 'Armazenamento em Ambiente Digital (Cloud)', texto: 'Declaro estar ciente de que dados pessoais, imagens, vídeos e documentos poderão ser armazenados em sistemas eletrônicos, bancos de dados e plataformas de armazenamento em nuvem utilizados pela instituição para fins administrativos e institucionais.' },
        { num: '4', titulo: 'Tratamento de Dados Pessoais (LGPD)', texto: 'Estou ciente de que os dados pessoais coletados poderão ser utilizados pelo Instituto para: cadastro e identificação do participante; gestão administrativa e operacional; comunicação institucional; registro histórico; elaboração de relatórios; prestação de contas a parceiros, financiadores e órgãos públicos. O tratamento de dados observará os princípios e diretrizes previstos na Lei Geral de Proteção de Dados Pessoais (LGPD).' },
        { num: '5', titulo: 'Gratuidade da Autorização', texto: 'Declaro que a presente autorização é concedida de forma gratuita, não sendo devida qualquer remuneração pela utilização de imagem, voz ou dados relacionados às atividades institucionais.' },
        { num: '6', titulo: 'Prazo da Autorização', texto: 'A autorização concedida por meio deste termo possui prazo indeterminado, podendo ser utilizada pelo Instituto enquanto os registros forem necessários para fins institucionais, históricos ou administrativos.' },
        { num: '7', titulo: 'Direito de Revogação', texto: 'O titular dos dados ou responsável legal poderá solicitar, a qualquer momento, a revogação desta autorização ou a exclusão de dados pessoais, mediante solicitação formal enviada ao Instituto. A revogação não afetará utilizações realizadas anteriormente ou materiais institucionais já publicados.' },
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

      const dataAssinatura = formData.data_assinatura_lgpd
        ? new Date(formData.data_assinatura_lgpd).toLocaleString('pt-BR')
        : '—';
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

      const nomeArquivo = `LGPD_${formData.nome_completo.replace(/\s+/g, '_')}_${new Date().getFullYear()}.pdf`;
      doc.save(nomeArquivo);
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
      // Não chama onSuccess para não fechar o dossiê
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
      const numMatricula = res.data?.numero_matricula ?? null;
      setMatriculaNumero(numMatricula);
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
        const reqs: Promise<any>[] = [
          api.patch(`/alunos/${alunoUuid}/complemento`, complementoFiltrado),
        ];
        if (formData.auto_declaracao) {
          reqs.push(api.patch(`/alunos/${alunoUuid}/auto-declaracao`, { auto_declaracao: formData.auto_declaracao }));
        }
        if (complemento.orientacao_sexual) {
          // orientacao_sexual fica no complemento do aluno também
          reqs.push(api.patch(`/alunos/${alunoUuid}/complemento`, { orientacao_sexual: complemento.orientacao_sexual }));
        }
        const results = await Promise.allSettled(reqs);
        const falhou = results.find(r => r.status === 'rejected') as PromiseRejectedResult | undefined;
        if (falhou) {
          const msg = (falhou.reason as any)?.response?.data?.message || 'Erro ao salvar dados especiais.';
          alert(`Atenção: dados principais salvos, mas dados especiais falharam.\n${msg}`);
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
      const res = await api.post(`/matriculas/inscricao/${aluno.id}/anotacoes`, {
        texto_anotacao: novaAnotacaoTexto,
      });
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

  // ── Complemento ─────────────────────────────────────────────
  const [complemento, setComplemento] = useState<Record<string, string>>({
    rg: '', orgao_expedidor: '', uf_expedicao: '', genero: '', orientacao_sexual: '',
    banco: '', agencia: '', agencia_digito: '', conta_corrente: '', conta_digito: '', tipo_conta: '',
    nome_mae: '',
  });
  const [complementoCarregado, setComplementoCarregado] = useState(false);

  const [buscandoCep, setBuscandoCep] = useState(false);
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
          bairro:     data.bairro     || prev.bairro,
          cidade:     data.localidade || prev.cidade,
          estado_uf:  data.uf         || prev.estado_uf,
        }));
      }
    } catch { /* silencia erros de rede */ }
    finally { setBuscandoCep(false); }
  }, []);

  // ── Helpers ──────────────────────────────────────────────────
  const fmtDate = (v?: string | null) => {
    if (!v) return '---';
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return v;
    const s = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v + 'T12:00:00' : v;
    const d = new Date(s);
    return isNaN(d.getTime()) ? '---' : d.toLocaleDateString('pt-BR');
  };
  const fmtDateTime = (v?: string | null) => {
    if (!v) return '---';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '---' : d.toLocaleString('pt-BR');
  };

  const statusColor: Record<string, string> = {
    'Pendente':                   'bg-slate-100 text-slate-500',
    'Aguardando Assinatura LGPD': 'bg-orange-100 text-orange-700',
    'Em Validação':               'bg-blue-100 text-blue-700',
    'Aguardando Documentos':      'bg-amber-100 text-amber-700',
    'Documentos Enviados':        'bg-cyan-100 text-cyan-700',
    'Matriculado':                'bg-green-100 text-green-700',
    'Incompleto':                 'bg-red-100 text-red-700',
    'Desistente':                 'bg-slate-100 text-slate-600',
    'Cancelada':                  'bg-red-950 text-red-200',
  };

  const tipoMovColor: Record<string, string> = {
    'Status': 'bg-blue-100 text-blue-700',
    'Edição': 'bg-amber-100 text-amber-700',
    'Exclusão': 'bg-red-100 text-red-700',
  };

  // Dados de presença (fichaData ou vazio)
  const totalPresencas = fichaData?.totalPresencas ?? 0;
  const totalFaltas    = fichaData?.totalFaltas ?? 0;
  const frequencia     = fichaData?.frequencia ?? [];
  const historico      = fichaData?.historico ?? [];
  const turmasDoAluno  = fichaData?.turmasDoAluno ?? [];
  const fotoUrl        = fichaData?.foto_url || formData.foto_url;

  // Tabs disponíveis
  type TabDef = { id: TabId; label: string; icon: any; error?: boolean };
  const tabs: TabDef[] = [
    { id: 'cadastro',       label: 'Cadastro',   icon: User,         error: erroMaioridade },
    { id: 'anotacoes',      label: `Anotações${anotacoes.length ? ` (${anotacoes.length})` : ''}`, icon: MessageSquare },
    { id: 'movimentacoes',  label: 'Movimentações', icon: History },
    { id: 'documentos',     label: 'Documentos', icon: Paperclip },
    ...(fichaData ? [{ id: 'presenca' as TabId, label: `Presença (${totalPresencas}P/${totalFaltas}F)`, icon: ClipboardCheck }] : []),
  ];

  return (
    <div
      className="fixed inset-0 bg-purple-950/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300"
      onMouseDown={e => e.stopPropagation()}
    >
      <div
        className="w-full max-w-3xl bg-white rounded-[40px] shadow-2xl flex flex-col overflow-hidden max-h-[95vh] border border-white/20"
        onMouseDown={e => e.stopPropagation()}
      >
        {/* ── HEADER GRADIENT (estética Ficha) ──────────────────── */}
        <div className="relative bg-gradient-to-br from-purple-700 via-purple-600 to-indigo-700 px-6 pt-6 pb-6 shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all"
          >
            <X size={16} />
          </button>

          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-2xl bg-white/20 border-4 border-white/25 flex items-center justify-center overflow-hidden shadow-xl shrink-0">
              {fotoUrl
                ? <img src={fotoUrl} className="w-full h-full object-cover" alt="Foto" />
                : <span className="text-4xl font-black text-white">{(formData.nome_completo?.[0] || '?').toUpperCase()}</span>}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 pt-1">
              <h2 className="text-white font-black text-xl leading-tight tracking-tight uppercase">{formData.nome_completo}</h2>
              {formData.aluno?.numero_matricula && (
                <p className="text-purple-200 font-mono text-xs mt-0.5">{formData.aluno.numero_matricula}</p>
              )}
              <div className="flex gap-1.5 mt-2 flex-wrap items-center">
                {turmasDoAluno.filter((t: any) => t.status === 'ativo' && t.turma_id).map((t: any) => (
                  <span key={t.id}
                    className="text-[9px] font-black text-white px-2.5 py-1 rounded-full shadow-sm border border-white/20"
                    style={{ backgroundColor: (t.turma_cor || '#4f46e5') + 'cc' }}>
                    {t.turma_nome}
                  </span>
                ))}
                <span className={`text-[9px] font-black px-2.5 py-1 rounded-full border border-white/20 ${statusColor[formData.status_matricula] || 'bg-white/10 text-white'}`}>
                  {formData.status_matricula}
                </span>
                {formData.cpf && (
                  <span className="text-[9px] font-bold text-purple-200/70 uppercase">CPF: {formData.cpf}</span>
                )}
              </div>
            </div>
          </div>

          {/* Barra de contato */}
          <div className="flex gap-2 mt-4 flex-wrap">
            {formData.celular && (
              <a
                href={`https://wa.me/55${formData.celular.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 border border-green-400/30 text-green-200 rounded-xl text-[10px] font-bold transition-all"
              >
                <Phone size={11} /> {formData.celular}
              </a>
            )}
            {formData.email && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 border border-white/20 text-purple-200 rounded-xl text-[10px] font-bold">
                {formData.email}
              </span>
            )}
            {formData.data_inscricao && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 border border-white/20 text-purple-200/70 rounded-xl text-[10px] font-bold">
                Inscrito: {fmtDate(formData.data_inscricao)}
              </span>
            )}
          </div>
        </div>

        {/* ── ALERTAS + NAV TABS ─────────────────────────────────── */}
        <div className="shrink-0 bg-white">
          {erroMaioridade && (
            <div className="mx-4 mt-3 flex items-start gap-3 bg-red-50 border-2 border-red-300 rounded-2xl p-4">
              <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />
              <p className="text-[10px] text-red-700 font-bold leading-relaxed">
                <span className="font-black uppercase block mb-0.5">Conflito de Maioridade</span>
                O responsável informou maior de 18 anos, mas a idade cadastrada é {formData.idade} anos.
              </p>
            </div>
          )}

          <div className="flex px-4 border-b border-gray-100 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setAbaAtiva(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-4 text-[10px] font-black uppercase tracking-wide border-b-2 transition-all whitespace-nowrap ${
                  abaAtiva === tab.id ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                <tab.icon size={13} /> {tab.label}
                {tab.error && <AlertTriangle size={11} className="text-red-500 animate-pulse ml-1" />}
              </button>
            ))}
          </div>
        </div>

        {/* ── CONTENT ────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-purple-600" size={32} />
            </div>
          )}

          {/* ABA CADASTRO */}
          {!loading && abaAtiva === 'cadastro' && (
            <div className="space-y-5">

              {/* ── Dados Básicos ── */}
              <div className="bg-gray-50 p-6 rounded-[24px] space-y-4">
                <SectionTitle>Dados Básicos</SectionTitle>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <EditField label="Nome Completo" field="nome_completo" value={formData.nome_completo} isEditing={isEditing} onChange={handleFieldChange} />
                  </div>
                  <EditField label="CPF" field="cpf" value={formData.cpf} isEditing={isEditing} onChange={handleFieldChange} />
                  <EditField label="Email" field="email" value={formData.email} isEditing={isEditing} onChange={handleFieldChange} />
                  <EditField label="Celular" field="celular" value={formData.celular} isEditing={isEditing} onChange={handleFieldChange} />
                  <EditField label="Telefone Alternativo" field="telefone_alternativo" value={formData.telefone_alternativo} isEditing={isEditing} onChange={handleFieldChange} />

                  {/* Data de nascimento: type=date para cálculo automático de idade */}
                  <EditField label="Data de Nascimento" field="data_nascimento" value={formData.data_nascimento} isEditing={isEditing} type="date" onChange={handleFieldChange} />

                  {/* Idade: calculada automaticamente, somente leitura */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Idade (calculada)</label>
                    <p className="text-xs font-black text-black uppercase">
                      {formData.idade != null ? `${formData.idade} anos` : '---'}
                    </p>
                  </div>

                  <EditField label="Sexo" field="sexo" value={formData.sexo} isEditing={isEditing} type="select" options={['Masculino', 'Feminino', 'Outro', 'Não informado']} onChange={handleFieldChange} />
                  <EditField label="Cidade" field="cidade" value={formData.cidade} isEditing={isEditing} onChange={handleFieldChange} />
                  <EditField label="Bairro" field="bairro" value={formData.bairro} isEditing={isEditing} onChange={handleFieldChange} />
                  <EditField label="Logradouro" field="logradouro" value={formData.logradouro} isEditing={isEditing} onChange={handleFieldChange} />
                  <EditField label="Número" field="numero" value={formData.numero} isEditing={isEditing} onChange={handleFieldChange} />
                  <EditField label="Complemento" field="complemento" value={formData.complemento} isEditing={isEditing} onChange={handleFieldChange} />
                  <EditField label="Estado (UF)" field="estado_uf" value={formData.estado_uf} isEditing={isEditing} onChange={handleFieldChange} />
                  <div className="flex flex-col gap-1">
                    <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest">
                      CEP {buscandoCep && <span className="text-purple-400 ml-1 normal-case">buscando...</span>}
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.cep ?? ''}
                        maxLength={9}
                        placeholder="00000-000"
                        onChange={e => {
                          const v = e.target.value;
                          handleFieldChange('cep', v);
                          if (v.replace(/\D/g, '').length === 8) buscarCep(v);
                        }}
                        onBlur={e => buscarCep(e.target.value)}
                        className="p-2 bg-white border border-purple-200 rounded-lg text-xs font-bold text-purple-900 outline-none focus:ring-2 focus:ring-purple-300"
                      />
                    ) : (
                      <p className="text-xs font-black text-black uppercase truncate">{formData.cep || '—'}</p>
                    )}
                  </div>
                  <div className="col-span-2">
                    <EditField label="Cursos Desejados" field="cursos_desejados" value={formData.cursos_desejados} isEditing={isEditing} onChange={handleFieldChange} />
                  </div>
                </div>
              </div>

              {/* ── Escolaridade ── */}
              <div className="bg-gray-50 p-6 rounded-[24px] space-y-4">
                <SectionTitle>Escolaridade</SectionTitle>
                <div className="grid grid-cols-2 gap-4">
                  <EditField label="Escolaridade" field="escolaridade" value={formData.escolaridade} isEditing={isEditing} type="select" options={['Ensino Fundamental Incompleto', 'Ensino Fundamental Completo', 'Ensino Médio Incompleto', 'Ensino Médio Completo', 'Ensino Superior Incompleto', 'Ensino Superior Completo', 'Pós-Graduação', 'Não informado']} onChange={handleFieldChange} />
                  <EditField label="Turno Escolar" field="turno_escolar" value={formData.turno_escolar} isEditing={isEditing} type="select" options={['Manhã', 'Tarde', 'Noite', 'Integral', 'Não estuda no momento']} onChange={handleFieldChange} />
                </div>
              </div>

              {/* ── Saúde e Bem-Estar ── */}
              <div className="bg-gray-50 p-6 rounded-[24px] space-y-4">
                <SectionTitle>Saúde e Bem-Estar</SectionTitle>
                <div className="grid grid-cols-2 gap-4">
                  <EditField label="Possui Alergias" field="possui_alergias" value={formData.possui_alergias} isEditing={isEditing} onChange={handleFieldChange} />
                  <EditField label="Cuidado Especial" field="cuidado_especial" value={formData.cuidado_especial} isEditing={isEditing} onChange={handleFieldChange} />
                  <EditField label="Uso de Medicamento" field="uso_medicamento" value={formData.uso_medicamento} isEditing={isEditing} onChange={handleFieldChange} />
                  <div className="col-span-2">
                    <EditField label="Detalhes do Cuidado" field="detalhes_cuidado" value={formData.detalhes_cuidado} isEditing={isEditing} type="textarea" onChange={handleFieldChange} />
                  </div>
                </div>
              </div>

              {/* ── Identidade — para todos os alunos ── */}
              <div className="bg-indigo-50/60 p-6 rounded-[24px] space-y-4 border border-indigo-100">
                <SectionTitle>Identidade</SectionTitle>
                <div className="grid grid-cols-2 gap-4">
                  {/* Autodeclaração Racial */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Autodeclaração Racial</label>
                    {isEditing ? (
                      <select
                        value={formData.auto_declaracao ?? ''}
                        onChange={e => handleFieldChange('auto_declaracao', e.target.value)}
                        className="p-2 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-300"
                      >
                        <option value="">Prefiro não informar</option>
                        <option value="branco">Branco</option>
                        <option value="preto">Preto</option>
                        <option value="pardo">Pardo</option>
                        <option value="amarelo">Amarelo</option>
                        <option value="indigena">Indígena</option>
                      </select>
                    ) : (
                      <p className="text-xs font-black text-black uppercase">{formData.auto_declaracao || '—'}</p>
                    )}
                  </div>

                  {/* Orientação Sexual */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Orientação Sexual</label>
                    {isEditing ? (
                      <select
                        value={formData.orientacao_sexual ?? ''}
                        onChange={e => handleFieldChange('orientacao_sexual', e.target.value)}
                        className="p-2 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-300"
                      >
                        <option value="">Prefiro não informar</option>
                        <option value="heterossexual">Heterossexual</option>
                        <option value="homossexual">Homossexual (Gay/Lésbica)</option>
                        <option value="bissexual">Bissexual</option>
                        <option value="panssexual">Pansexual</option>
                        <option value="assexual">Assexual</option>
                        <option value="outro">Outro</option>
                      </select>
                    ) : (
                      <p className="text-xs font-black text-black uppercase">{formData.orientacao_sexual || '—'}</p>
                    )}
                  </div>

                  {/* Gênero — visível para todos */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Gênero</label>
                    {isEditing ? (
                      <select
                        value={complemento.genero ?? ''}
                        onChange={e => setComplemento(p => ({ ...p, genero: e.target.value }))}
                        className="p-2 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-300"
                      >
                        <option value="">Prefiro não informar</option>
                        <option value="masculino">Masculino</option>
                        <option value="feminino">Feminino</option>
                        <option value="nao_binario">Não-binário</option>
                        <option value="prefiro_nao_informar">Prefiro não informar</option>
                      </select>
                    ) : (
                      <p className="text-xs font-black text-black uppercase">{complemento.genero || '—'}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Responsável ── (menores + campo nome da mãe para todos) */}
              <div className="bg-gray-50 p-6 rounded-[24px] space-y-4">
                <SectionTitle>Responsável / Filiação</SectionTitle>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <EditField label="Maior de 18 Anos" field="maior_18_anos" value={formData.maior_18_anos} isEditing={isEditing} type="checkbox" onChange={handleFieldChange} />
                  </div>
                  {/* Nome da mãe ou responsável — visível para todos */}
                  <div className="col-span-2">
                    <EditField label="Nome da Mãe ou Responsável" field="nome_responsavel" value={formData.nome_responsavel} isEditing={isEditing} onChange={handleFieldChange} />
                  </div>
                  {!formData.maior_18_anos && (<>
                    <EditField label="Grau de Parentesco" field="grau_parentesco" value={formData.grau_parentesco} isEditing={isEditing} onChange={handleFieldChange} />
                    <EditField label="CPF do Responsável" field="cpf_responsavel" value={formData.cpf_responsavel} isEditing={isEditing} onChange={handleFieldChange} />
                    <EditField label="Email do Responsável" field="email_responsavel" value={formData.email_responsavel} isEditing={isEditing} onChange={handleFieldChange} />
                  </>)}
                </div>
              </div>

              {/* ── Dados Especiais (Pré-ENCCEJA / Pré-Vestibular) ── */}
              {complementoCarregado && (
                <div className="bg-purple-50/60 p-6 rounded-[24px] space-y-4 border border-purple-100">
                  <SectionTitle>Dados Especiais — Pré-ENCCEJA / Pré-Vestibular</SectionTitle>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-purple-400 mb-2">Documentação</p>
                    </div>
                    {[
                      { label: 'RG', key: 'rg' },
                      { label: 'Órgão Expedidor', key: 'orgao_expedidor' },
                      { label: 'UF Expedição', key: 'uf_expedicao' },
                    ].map(({ label, key }) => (
                      <div key={key} className="flex flex-col gap-1">
                        <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{label}</label>
                        {isEditing ? (
                          <input
                            value={complemento[key] ?? ''}
                            maxLength={key === 'uf_expedicao' ? 2 : undefined}
                            onChange={e => setComplemento(p => ({ ...p, [key]: key === 'uf_expedicao' ? e.target.value.toUpperCase().slice(0, 2) : e.target.value }))}
                            className="p-2 bg-white border border-purple-200 rounded-lg text-xs font-bold text-purple-900 outline-none focus:ring-2 focus:ring-purple-300 uppercase"
                          />
                        ) : (
                          <p className="text-xs font-black text-black uppercase truncate">{complemento[key] || '—'}</p>
                        )}
                      </div>
                    ))}

                    {/* Nome da mãe no complemento (cursos especiais, independente da idade) */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Nome da Mãe / Responsável Legal</label>
                      {isEditing ? (
                        <input
                          value={complemento.nome_mae ?? ''}
                          onChange={e => setComplemento(p => ({ ...p, nome_mae: e.target.value }))}
                          className="p-2 bg-white border border-purple-200 rounded-lg text-xs font-bold text-purple-900 outline-none focus:ring-2 focus:ring-purple-300"
                        />
                      ) : (
                        <p className="text-xs font-black text-black uppercase truncate">{complemento.nome_mae || '—'}</p>
                      )}
                    </div>

                    {/* Dados bancários */}
                    <div className="col-span-2 pt-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-purple-400 mb-2">Dados Bancários</p>
                    </div>
                    {[
                      { label: 'Banco', key: 'banco', span: 2 },
                      { label: 'Agência', key: 'agencia' },
                      { label: 'Dígito Agência', key: 'agencia_digito' },
                      { label: 'Conta Corrente', key: 'conta_corrente' },
                      { label: 'Dígito Conta', key: 'conta_digito' },
                    ].map(({ label, key, span }) => (
                      <div key={key} className={`flex flex-col gap-1 ${span === 2 ? 'col-span-2' : ''}`}>
                        <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{label}</label>
                        {isEditing ? (
                          <input
                            value={complemento[key] ?? ''}
                            onChange={e => setComplemento(p => ({ ...p, [key]: e.target.value }))}
                            className="p-2 bg-white border border-purple-200 rounded-lg text-xs font-bold text-purple-900 outline-none focus:ring-2 focus:ring-purple-300"
                          />
                        ) : (
                          <p className="text-xs font-black text-black uppercase truncate">{complemento[key] || '—'}</p>
                        )}
                      </div>
                    ))}
                    <div className="flex flex-col gap-1">
                      <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Tipo de Conta</label>
                      {isEditing ? (
                        <select
                          value={complemento.tipo_conta ?? ''}
                          onChange={e => setComplemento(p => ({ ...p, tipo_conta: e.target.value }))}
                          className="p-2 bg-white border border-purple-200 rounded-lg text-xs font-bold text-purple-900 outline-none focus:ring-2 focus:ring-purple-300"
                        >
                          <option value="">—</option>
                          <option value="corrente">Corrente</option>
                          <option value="poupanca">Poupança</option>
                        </select>
                      ) : (
                        <p className="text-xs font-black text-black uppercase">{complemento.tipo_conta || '—'}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Painel LGPD */}
              {(() => {
                const assinado = !!formData.data_assinatura_lgpd;
                const dataAssinatura = assinado ? new Date(formData.data_assinatura_lgpd) : null;
                const umAnoAtras = new Date(); umAnoAtras.setFullYear(umAnoAtras.getFullYear() - 1);
                const precisaRenovar = dataAssinatura && dataAssinatura < umAnoAtras;
                const vencimento = dataAssinatura ? new Date(dataAssinatura) : null;
                if (vencimento) vencimento.setFullYear(vencimento.getFullYear() + 1);

                return (
                  <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 space-y-3">
                    <div className="flex justify-between items-start gap-4 flex-wrap">
                      <div>
                        <p className="text-[10px] font-black uppercase text-blue-700 mb-1">Status LGPD</p>
                        <span className={`text-[10px] font-black px-3 py-1 rounded-full ${
                          precisaRenovar ? 'bg-orange-100 text-orange-700'
                            : assinado ? 'bg-green-100 text-green-700'
                            : formData.lgpd_aceito ? 'bg-blue-100 text-blue-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {precisaRenovar ? '⚠ RENOVAÇÃO NECESSÁRIA'
                            : assinado ? '✔ ASSINADO'
                            : formData.lgpd_aceito ? '✔ CONFIRMADO'
                            : '⏳ PENDENTE'}
                        </span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {assinado && (
                          <button onClick={gerarPdfLGPD} disabled={pdfLoading}
                            className="flex items-center gap-1.5 px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-60">
                            {pdfLoading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} PDF
                          </button>
                        )}
                        <button onClick={handleEnviarLGPD} disabled={lgpdLoading}
                          className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-60">
                          {lgpdLoading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                          {assinado ? 'Renovar' : formData.lgpd_aceito ? 'Reenviar' : 'Enviar'}
                        </button>
                      </div>
                    </div>

                    {assinado && (
                      <div className="border-t border-blue-100 pt-3 grid grid-cols-1 gap-1.5 text-[10px]">
                        <div className="flex gap-2">
                          <span className="font-black uppercase text-blue-600 w-24 shrink-0">Assinado em</span>
                          <span className="text-slate-700">{dataAssinatura!.toLocaleString('pt-BR')}</span>
                        </div>
                        {vencimento && (
                          <div className="flex gap-2">
                            <span className="font-black uppercase text-blue-600 w-24 shrink-0">Validade</span>
                            <span className={precisaRenovar ? 'text-orange-600 font-bold' : 'text-slate-700'}>
                              {vencimento.toLocaleDateString('pt-BR')} {precisaRenovar ? '(vencido)' : ''}
                            </span>
                          </div>
                        )}
                        {formData.lgpd_ip && (
                          <div className="flex gap-2">
                            <span className="font-black uppercase text-blue-600 w-24 shrink-0">IP</span>
                            <span className="text-slate-700 font-mono">{formData.lgpd_ip}</span>
                          </div>
                        )}
                        {formData.lgpd_user_agent && (
                          <div className="flex gap-2">
                            <span className="font-black uppercase text-blue-600 w-24 shrink-0">Navegador</span>
                            <span className="text-slate-600 break-all leading-tight">
                              {String(formData.lgpd_user_agent).length > 80
                                ? String(formData.lgpd_user_agent).substring(0, 80) + '…'
                                : formData.lgpd_user_agent}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    {precisaRenovar && (
                      <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 text-[10px] text-orange-700 font-semibold">
                        ⚠ O termo LGPD foi assinado há mais de 1 ano. Clique em &quot;Renovar&quot; para solicitar nova assinatura.
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ABA ANOTAÇÕES */}
          {!loading && abaAtiva === 'anotacoes' && (
            <div className="space-y-4">
              {anotacoes.length === 0 && (
                <p className="text-center text-[11px] text-gray-400 font-bold uppercase py-8">Nenhuma anotação registrada.</p>
              )}
              {anotacoes.map(anot => (
                <div key={anot.id} className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center overflow-hidden shrink-0">
                      {anot.usuario_foto
                        ? <img src={(() => {
                            const foto = anot.usuario_foto;
                            if (!foto) return '';
                            if (foto.startsWith('http://') || foto.startsWith('https://') || foto.startsWith('/uploads/') || foto.startsWith(API_ORIGIN)) return foto;
                            if (!foto.startsWith('http')) return `${API_ORIGIN}${foto}`;
                            return '';
                          })()} className="w-full h-full object-cover" alt="" />
                        : <User size={14} className="text-purple-400" />}
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-black uppercase">{anot.usuario_nome || 'Usuário'}</p>
                      <p className="text-[9px] text-gray-400">{fmtDateTime(anot.created_at)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-700 leading-relaxed">{anot.texto_anotacao}</p>
                </div>
              ))}
              <div className="mt-2 pt-4 border-t border-gray-100">
                <textarea
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 text-sm text-black h-24 outline-none focus:border-purple-500 resize-none"
                  placeholder="Escreva uma nova anotação..."
                  value={novaAnotacaoTexto}
                  onChange={e => setNovaAnotacaoTexto(e.target.value)}
                />
                <button onClick={handleAddAnotacao} disabled={loading || !novaAnotacaoTexto.trim()}
                  className="mt-2 w-full py-3 bg-purple-600 text-white rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 disabled:opacity-50">
                  <Save size={13} /> Salvar Anotação
                </button>
              </div>
            </div>
          )}

          {/* ABA MOVIMENTAÇÕES */}
          {!loading && abaAtiva === 'movimentacoes' && (
            <div className="space-y-2">
              {movimentacoes.length === 0 && (
                <p className="text-center text-[11px] text-gray-400 font-bold uppercase py-8">Nenhuma movimentação registrada.</p>
              )}
              {movimentacoes.map(mov => (
                <div key={mov.id} className="bg-gray-50 rounded-2xl border border-gray-100 p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${tipoMovColor[mov.tipo] || 'bg-gray-100 text-gray-600'}`}>{mov.tipo}</span>
                      {mov.categoria && <span className="text-[9px] font-bold text-gray-500 uppercase">{mov.categoria.replace(/_/g, ' ')}</span>}
                    </div>
                    {mov.valor_antes !== mov.valor_depois && (
                      <div className="flex items-center gap-2 text-[10px] font-mono flex-wrap">
                        <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded line-through">{mov.valor_antes || 'vazio'}</span>
                        <ChevronRight size={10} className="text-gray-400" />
                        <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded">{mov.valor_depois || 'vazio'}</span>
                      </div>
                    )}
                    <p className="text-[9px] text-gray-400">{mov.usuario_nome} · {fmtDateTime(mov.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ABA DOCUMENTOS */}
          {!loading && abaAtiva === 'documentos' && (
            <div className="space-y-4">
              <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 space-y-3">
                <p className="text-[9px] font-black uppercase text-purple-600 tracking-widest">Adicionar Documento</p>
                <div className="flex gap-2 flex-wrap">
                  <select value={uploadTipo} onChange={e => setUploadTipo(e.target.value)}
                    className="flex-1 min-w-[160px] border border-purple-200 rounded-xl px-3 py-2 text-xs font-bold text-purple-900 bg-white outline-none focus:ring-2 focus:ring-purple-300">
                    <option value="foto_aluno">Foto do Aluno</option>
                    <option value="identidade">Identidade</option>
                    <option value="comprovante_residencia">Comprovante de Residência</option>
                    <option value="certidao_nascimento">Certidão de Nascimento</option>
                    <option value="identidade_responsavel">Identidade do Responsável</option>
                    <option value="declaracao_escolaridade">Declaração de Escolaridade</option>
                    <option value="extra">Outro (Adicional)</option>
                  </select>
                  {uploadTipo === 'extra' && (
                    <input type="text" placeholder="Nome do documento" value={uploadNomeExtra} onChange={e => setUploadNomeExtra(e.target.value)}
                      className="flex-1 min-w-[140px] border border-purple-200 rounded-xl px-3 py-2 text-xs font-bold text-purple-900 bg-white outline-none focus:ring-2 focus:ring-purple-300" />
                  )}
                </div>
                <label className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed cursor-pointer transition-all text-[10px] font-black uppercase ${uploadingDoc ? 'border-purple-300 bg-purple-100 text-purple-400 cursor-not-allowed' : 'border-purple-300 hover:border-purple-500 hover:bg-purple-100 text-purple-600'}`}>
                  {uploadingDoc ? <><Loader2 size={13} className="animate-spin" /> Enviando...</> : <><Paperclip size={13} /> Selecionar arquivo (JPG, PNG, PDF · máx 8 MB)</>}
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
                  <p className="text-[9px] font-black uppercase text-gray-400 mb-1">Documentos Legado (Google Forms)</p>
                  <DocItem label="Documentos (ZIP)" url={formData.url_documentos_zip} icon={<Paperclip size={14} />} />
                  <DocItem label="Termo LGPD Assinado" url={formData.url_termo_lgpd} icon={<ShieldCheck size={14} />} />
                </div>
              )}

              {loadingDocs ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-purple-400" size={24} /></div>
              ) : (
                <>
                  {(() => {
                    const maior18 = formData.maior_18_anos !== false;
                    const total = maior18 ? 3 : 5;
                    const enviados = total - obrigatoriosPendentes.length;
                    const pct = Math.round((enviados / total) * 100);
                    return (
                      <div className={`p-4 rounded-2xl border ${docsCompleto ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-[10px] font-black uppercase text-gray-700">Obrigatórios: {enviados}/{total}</p>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${docsCompleto ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{docsCompleto ? '✔ COMPLETO' : '⏳ PENDENTE'}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full transition-all ${docsCompleto ? 'bg-green-500' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })()}

                  {obrigatoriosPendentes.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[9px] font-black uppercase text-red-400 mb-1">Pendentes</p>
                      {obrigatoriosPendentes.map(tipo => {
                        const labelMap: Record<string, string> = { foto_aluno: 'Foto do Aluno', identidade: 'Identidade', comprovante_residencia: 'Comprovante de Residência', certidao_nascimento: 'Certidão de Nascimento', identidade_responsavel: 'Identidade do Responsável' };
                        return (
                          <div key={tipo} className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-xl">
                            <FileWarning size={12} className="text-red-400 shrink-0" />
                            <p className="text-[10px] font-bold text-red-600">{labelMap[tipo] ?? tipo}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {uploadedDocs.length === 0 ? (
                    <p className="text-center text-[11px] text-gray-400 font-bold uppercase py-4">Nenhum documento enviado ainda.</p>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-[9px] font-black uppercase text-gray-400 mb-1">Enviados ({uploadedDocs.length})</p>
                      {uploadedDocs.map(doc => {
                        const labelMap: Record<string, string> = { foto_aluno: 'Foto do Aluno', identidade: 'Identidade', comprovante_residencia: 'Comprovante de Residência', certidao_nascimento: 'Certidão de Nascimento', identidade_responsavel: 'Identidade do Responsável', declaracao_escolaridade: 'Declaração de Escolaridade', extra: doc.nome_extra ?? 'Documento Adicional' };
                        const nomeLabel = labelMap[doc.tipo] ?? doc.tipo;
                        const fileUrl = (doc.url_arquivo.startsWith('data:') || doc.url_arquivo.startsWith('http')) ? doc.url_arquivo : `${API_ORIGIN}${doc.url_arquivo}`;
                        const bytes = doc.tamanho_bytes ?? 0;
                        const sizeLabel = bytes > 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : bytes > 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${bytes} B`;
                        return (
                          <div key={doc.id} className="flex items-center justify-between gap-3 p-3 bg-gray-50 hover:bg-purple-50/40 rounded-2xl border border-gray-100 hover:border-purple-200 transition-all group">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-purple-400 group-hover:text-purple-600 shrink-0">{doc.tipo === 'foto_aluno' ? <Camera size={14} /> : <Paperclip size={14} />}</span>
                              <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase text-gray-700 group-hover:text-purple-700 truncate">{nomeLabel}</p>
                                <p className="text-[9px] text-gray-400">{fmtDate(doc.createdAt)} · {sizeLabel}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <a href={safeUrl(fileUrl)} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-[9px] font-black uppercase text-gray-600 hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-all">
                                <ExternalLink size={10} /> Abrir
                              </a>
                              <button onClick={async () => {
                                if (!confirm(`Remover "${nomeLabel}"?`)) return;
                                try { await api.delete(`/matriculas/documentos/${doc.id}`); recarregarDocumentos(); }
                                catch { alert('Erro ao remover documento.'); }
                              }} className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-[9px] font-black uppercase text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all">
                                <Trash2 size={10} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ── Efetivar Matrícula ── */}
                  {['Em Validação', 'Aguardando Documentos', 'Documentos Enviados'].includes(formData.status_matricula) && (
                    <div className="bg-white p-5 rounded-[24px] border-2 border-purple-100 shadow-sm">
                      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <p className="text-[10px] font-black uppercase text-purple-600">Efetivar Matrícula — Selecionar Turmas</p>
                        {formData.cursos_desejados && (
                          <span className="text-[9px] text-gray-400 font-bold">Interesse: <span className="text-purple-600">{formData.cursos_desejados}</span></span>
                        )}
                      </div>
                      {!cursosCarregados ? (
                        <p className="text-[10px] text-amber-600 font-bold uppercase text-center py-3 bg-amber-50 rounded-xl">Carregando turmas…</p>
                      ) : cursosAcademico.length === 0 ? (
                        <p className="text-[10px] text-red-500 font-bold uppercase text-center py-3 bg-red-50 rounded-xl">Nenhuma turma ativa.</p>
                      ) : (
                        <div className="space-y-3 mb-4">
                          {cursosAcademico.map(curso => (
                            <div key={curso.id}>
                              <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1.5">{curso.sigla} — {curso.nome}</p>
                              <div className="grid grid-cols-2 gap-1.5">
                                {curso.turmas.map(t => {
                                  const ativo = cursosSelecionados.includes(t.id);
                                  return (
                                    <label key={t.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 cursor-pointer transition-all select-none ${ativo ? 'border-purple-400 bg-purple-50' : 'border-gray-100 bg-gray-50 hover:border-purple-200'}`}>
                                      <input type="checkbox" checked={ativo} onChange={() => setCursosSelecionados(prev => prev.includes(t.id) ? prev.filter(c => c !== t.id) : [...prev, t.id])} className="accent-purple-600 w-3 h-3 cursor-pointer shrink-0" />
                                      <span className={`text-[9px] font-black uppercase leading-tight ${ativo ? 'text-purple-700' : 'text-gray-500'}`}>{t.nome}{t.codigo ? <span className="font-normal normal-case opacity-60 ml-1">({t.codigo})</span> : ''}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <button onClick={handleEfetivarMatricula} disabled={cursosSelecionados.length === 0 || loading}
                        className="w-full py-3.5 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                        {loading ? <Loader2 className="animate-spin" size={14} /> : <><CheckCircle size={14} /> Efetivar Matrícula ({cursosSelecionados.length} turma{cursosSelecionados.length !== 1 ? 's' : ''})</>}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ABA PRESENÇA */}
          {!loading && abaAtiva === 'presenca' && fichaData && (
            <div className="space-y-4">
              {/* Resumo */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Presenças', val: totalPresencas, cls: 'bg-green-50 border-green-100 text-green-700' },
                  { label: 'Faltas',    val: totalFaltas,    cls: 'bg-red-50 border-red-100 text-red-600' },
                  { label: '% Freq.',
                    val: totalPresencas + totalFaltas > 0 ? `${Math.round((totalPresencas / (totalPresencas + totalFaltas)) * 100)}%` : '0%',
                    cls: 'bg-purple-50 border-purple-100 text-purple-700' },
                ].map(k => (
                  <div key={k.label} className={`border rounded-2xl p-4 text-center ${k.cls}`}>
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-70 block">{k.label}</span>
                    <span className="font-black text-2xl">{k.val}</span>
                  </div>
                ))}
              </div>

              {/* Registro por aula */}
              {frequencia.length > 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <p className="text-[9px] font-black uppercase text-gray-400 mb-3 tracking-widest">Registro por Aula</p>
                  <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
                    {frequencia.map((f: any) => (
                      <div key={f.id} className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold ${f.descricao === 'Presente' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                        <div className={`w-2 h-2 rounded-full shrink-0 ${f.descricao === 'Presente' ? 'bg-green-500' : 'bg-red-400'}`} />
                        <span className="flex-1 truncate">{fmtDate(f.data)}</span>
                        <span className="shrink-0 text-[9px] uppercase font-black opacity-70">{f.descricao}</span>
                        {f.justificada && <span className="shrink-0 text-[8px] font-black text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">Justificada</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-center text-sm text-gray-400 py-8">Nenhum registro de presença encontrado.</p>
              )}

              {/* Outros registros: advertências, incidentes, observações */}
              {historico.filter((h: any) => h.tipo !== 'Presença').length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <p className="text-[9px] font-black uppercase text-gray-400 mb-3 tracking-widest">Ocorrências e Advertências</p>
                  <div className="space-y-2">
                    {historico.filter((h: any) => h.tipo !== 'Presença').map((h: any) => (
                      <div key={h.id} className="flex gap-2 bg-gray-50 rounded-xl p-2.5">
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase self-start whitespace-nowrap ${
                          h.tipo === 'Incidente' ? 'bg-red-100 text-red-700' : h.tipo === 'Advertência' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'
                        }`}>{h.tipo}</span>
                        <div>
                          {h.titulo && <p className="text-xs font-bold text-gray-800">{h.titulo}</p>}
                          {h.descricao && <p className="text-[10px] text-gray-500">{h.descricao}</p>}
                          <p className="text-[9px] text-gray-400 mt-0.5">{fmtDate(h.data)} · {h.usuario_nome}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── FOOTER ─────────────────────────────────────────── */}
        <div className="p-5 border-t border-gray-100 bg-gray-50 flex flex-col gap-3">
          {['Em Validação', 'Aguardando Documentos'].includes(formData.status_matricula) && (
            <div className="bg-blue-50/50 p-3.5 rounded-2xl border border-blue-100 flex justify-between items-center gap-3">
              <div>
                <p className="text-[10px] font-black uppercase text-blue-700 mb-1">Link de Documentos</p>
                <span className={`text-[10px] font-black px-3 py-1 rounded-full ${formData.doc_token ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {formData.doc_token ? '✔ LINK ENVIADO' : '⏳ NÃO ENVIADO'}
                </span>
              </div>
              <button onClick={handleSolicitarDocumentos} disabled={docLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-60 shrink-0">
                {docLoading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                {formData.doc_token ? 'Reenviar Link' : 'Solicitar Docs'}
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => (isEditing ? handleSaveEdit() : setIsEditing(true))}
              className={`px-6 py-4 rounded-2xl font-black text-[10px] uppercase transition-all flex items-center gap-2 ${isEditing ? 'bg-green-600 text-white shadow-lg' : 'bg-white border border-gray-200 text-black hover:bg-gray-100'}`}
            >
              {isEditing ? <><Save size={13} /> Salvar Alterações</> : <><Edit3 size={13} /> Editar Dados</>}
            </button>
            {isEditing && (
              <button onClick={() => { setIsEditing(false); setFormData({ ...aluno }); }}
                className="px-6 py-4 bg-white border border-gray-200 text-gray-500 rounded-2xl font-black text-[10px] uppercase hover:bg-gray-50">
                Cancelar
              </button>
            )}
            <button onClick={() => setShowMotivoModal({ show: true, status: 'Incompleto' })}
              className="px-6 py-4 bg-white border border-amber-200 text-amber-600 rounded-2xl font-black text-[10px] uppercase hover:bg-amber-50 transition-all">
              Incompleto
            </button>
            <button onClick={() => setShowMotivoModal({ show: true, status: 'Desistente' })}
              className="px-6 py-4 bg-white border border-red-200 text-red-600 rounded-2xl font-black text-[10px] uppercase hover:bg-red-50 transition-all">
              Desistência
            </button>
          </div>
        </div>
      </div>

      {/* ── MODAL MATRÍCULA EFETIVADA ───────────────────── */}
      {matriculaNumero && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[350] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Matrícula Efetivada</p>
            <h2 className="text-2xl font-black text-black uppercase tracking-tighter mb-1">{formData.nome_completo.split(' ')[0]}</h2>
            <div className="bg-green-50 border-2 border-green-200 rounded-2xl px-6 py-4 mb-6 mt-4">
              <p className="text-[9px] font-black uppercase text-green-600 tracking-widest mb-1">Número de Matrícula</p>
              <p className="text-3xl font-black text-green-700 tracking-tighter">{matriculaNumero}</p>
            </div>
            <button onClick={() => { setMatriculaNumero(null); onClose(); }}
              className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL JUSTIFICATIVA ─────────────────────────── */}
      {showMotivoModal.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[300] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md rounded-[32px] p-8 shadow-2xl">
            <h3 className="text-xs font-black uppercase text-black mb-1">Alterar status</h3>
            <p className="text-[10px] text-gray-400 uppercase font-bold mb-4">→ {showMotivoModal.status}</p>
            <textarea
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 text-sm font-black h-32 outline-none focus:border-purple-500 resize-none"
              placeholder="Descreva o motivo da alteração..."
              value={motivoTexto}
              onChange={e => setMotivoTexto(e.target.value)}
            />
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowMotivoModal({ show: false, status: null }); setMotivoTexto(''); }}
                className="flex-1 py-3 text-[10px] font-black uppercase text-gray-400 hover:text-gray-600">
                Cancelar
              </button>
              <button onClick={() => handleUpdateStatus(showMotivoModal.status!, motivoTexto)} disabled={!motivoTexto.trim() || loading}
                className="flex-[2] py-4 bg-black text-white rounded-2xl text-[10px] font-black uppercase disabled:opacity-50 hover:bg-gray-900 transition-all">
                {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Confirmar Mudança'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componentes auxiliares ────────────────────────────────────

function EditField({
  label, field, value, isEditing, type = 'text', onChange, options,
}: {
  label: string;
  field: string;
  value: any;
  isEditing: boolean;
  type?: 'text' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox';
  onChange: (f: string, v: any) => void;
  options?: string[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{label}</label>
      {isEditing ? (
        type === 'textarea' ? (
          <textarea value={value ?? ''} onChange={e => onChange(field, e.target.value)} rows={3}
            className="p-2 bg-white border border-purple-200 rounded-lg text-xs font-bold text-purple-900 outline-none focus:ring-2 focus:ring-purple-300 resize-none" />
        ) : type === 'select' && options ? (
          <select value={value ?? ''} onChange={e => onChange(field, e.target.value)}
            className="p-2 bg-white border border-purple-200 rounded-lg text-xs font-bold text-purple-900 outline-none focus:ring-2 focus:ring-purple-300">
            <option value="">— selecionar —</option>
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        ) : type === 'checkbox' ? (
          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input type="checkbox" checked={!!value} onChange={e => onChange(field, e.target.checked)} className="w-4 h-4 accent-purple-600" />
            <span className="text-xs font-bold text-purple-900">{value ? 'Sim' : 'Não'}</span>
          </label>
        ) : type === 'date' ? (
          <input type="date" value={value ? (String(value).slice(0, 10)) : ''} onChange={e => onChange(field, e.target.value)}
            className="p-2 bg-white border border-purple-200 rounded-lg text-xs font-bold text-purple-900 outline-none focus:ring-2 focus:ring-purple-300" />
        ) : (
          <input type={type} value={value ?? ''} onChange={e => onChange(field, type === 'number' ? Number(e.target.value) : e.target.value)}
            className="p-2 bg-white border border-purple-200 rounded-lg text-xs font-bold text-purple-900 outline-none focus:ring-2 focus:ring-purple-300" />
        )
      ) : (
        type === 'checkbox'
          ? <p className="text-xs font-black text-black uppercase">{value ? 'Sim' : 'Não'}</p>
          : <p className="text-xs font-black text-black uppercase truncate">
              {value
                ? (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)
                    ? new Date(value + 'T12:00:00').toLocaleDateString('pt-BR')
                    : value)
                : '---'}
            </p>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full pb-2 mb-1 border-b border-purple-100">
      <span className="text-[10px] font-black text-purple-600 uppercase tracking-wider">{children}</span>
    </div>
  );
}

function DocItem({ label, url, icon }: { label: string; url?: string; icon: React.ReactNode }) {
  if (!url) return null;
  return (
    <a href={safeUrl(url)} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-purple-50 rounded-2xl border border-gray-100 hover:border-purple-200 transition-all group">
      <span className="text-purple-400 group-hover:text-purple-600">{icon}</span>
      <span className="text-[10px] font-black uppercase text-gray-700 group-hover:text-purple-700">{label}</span>
      <span className="ml-auto text-[9px] text-gray-400 group-hover:text-purple-500">Abrir →</span>
    </a>
  );
}
