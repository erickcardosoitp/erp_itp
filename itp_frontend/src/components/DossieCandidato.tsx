"use client";
import React, { useState, useEffect, useCallback } from 'react';
import {
  X, User, FileText, Camera, HeartPulse, Edit3,
  CheckCircle, Save, MessageSquare, GraduationCap, Users, 
  AlertTriangle, Send, Link, Check
} from 'lucide-react';
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
});

// Interfaces
interface Materia {
  id: string; 
  nome: string;
}

interface Anotacao {
  id: string;
  inscricao_id: number;
  usuario_id?: string;
  texto_anotacao: string;
  created_at: string;
}

interface HistoricoInscricao {
  id: number;
  inscricao_id: number;
  status_definido: string;
  justificativa?: string;
  criado_em: string;
  origem_movimentacao?: string;
}

interface InscricaoData {
  id: number;
  idade: number;
  maior_18_anos?: boolean;
  autoriza_imagem: boolean;
  status_matricula: string;
  url_documentos_zip?: string;
  url_termo_lgpd?: string;
  created_at: string;
  updated_at: string;
  nome_completo: string;
  cpf: string;
  email: string;
  celular: string;
  telefone_alternativo?: string;
  data_nascimento?: string;
  sexo?: string;
  escolaridade?: string;
  lgpd_aceito: boolean;
  data_assinatura_lgpd?: string;
  motivo_status?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  cidade?: string;
  bairro?: string;
  estado_uf?: string;
  cep?: string;
  nome_responsavel?: string;
  grau_parentesco?: string;
  cpf_responsavel?: string;
  possui_alergias?: string;
  cuidado_especial?: string;
  detalhes_cuidado?: string;
  uso_medicamento?: string;
  turno_escolar?: string;
  nome_assinatura_imagem?: string;
  foto_url?: string;
  origem_inscricao?: string;
  aluno_id?: string;
}

interface DossieProps {
  aluno: InscricaoData;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function DossieCandidato({ aluno, onClose, onSuccess }: DossieProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<InscricaoData>({ ...aluno });
  const [loading, setLoading] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<'cadastro' | 'escolaridade' | 'saude' | 'responsavel' | 'documentos' | 'anotacoes' | 'movimentacoes'>('cadastro');

  const [availableCourses, setAvailableCourses] = useState<Materia[]>([]);
  const [cursosSelecionados, setCursosSelecionados] = useState<string[]>([]);
  const [anotacoes, setAnotacoes] = useState<Anotacao[]>([]);
  const [novaAnotacaoTexto, setNovaAnotacaoTexto] = useState('');
  const [historicoInscricao, setHistoricoInscricao] = useState<HistoricoInscricao[]>([]);

  const [showMotivoModal, setShowMotivoModal] = useState<{show: boolean, status: string | null}>({
    show: false, status: null
  });
  const [motivoTexto, setMotivoTexto] = useState('');

  // Regras de Negócio
  const erroMaioridade = formData.idade < 18 && formData.maior_18_anos === true;
  const precisaResponsavel = formData.idade < 18 || formData.cuidado_especial?.toLowerCase() === 'sim';

  // Handlers
  const handleUpdateStatus = async (novoStatus: string, motivo?: string) => {
    setLoading(true);
    try {
      await api.patch(`/matriculas/${aluno.id}/status`, { status: novoStatus, motivo });
      onSuccess?.();
      onClose();
    } catch (error: any) {
      alert("Erro ao atualizar status: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    setLoading(true);
    try {
      await api.patch(`/matriculas/inscricao/${aluno.id}`, formData);
      alert("Dados atualizados!");
      setIsEditing(false);
      onSuccess?.();
    } catch (error: any) {
      alert("Erro ao salvar: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleAddAnotacao = async () => {
    if (!novaAnotacaoTexto.trim()) return;
    setLoading(true);
    try {
      const response = await api.post(`/matriculas/inscricao/${aluno.id}/anotacoes`, {
        texto_anotacao: novaAnotacaoTexto,
      });
      setAnotacoes(prev => [...prev, response.data]);
      setNovaAnotacaoTexto('');
    } catch (error: any) {
      alert("Erro ao anotar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = useCallback((field: keyof InscricaoData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Fetch Inicial
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [resCursos, resInscritos, resAnot, resHist] = await Promise.all([
          api.get('/materias'),
          api.get(`/matriculas/inscricao/${aluno.id}/cursos-desejados`),
          api.get(`/matriculas/inscricao/${aluno.id}/anotacoes`),
          api.get(`/matriculas/inscricao/${aluno.id}/historico`)
        ]);

        setAvailableCourses(resCursos.data);
        setCursosSelecionados(resInscritos.data.map((c: any) => c.id || c.materia_id));
        setAnotacoes(resAnot.data);
        setHistoricoInscricao(resHist.data);
      } catch (error) {
        console.error("Erro no load:", error);
      } finally {
        setLoading(false);
      }
    };

    if (aluno?.id) fetchData();
  }, [aluno.id]);

  return (
    <div className="fixed inset-0 bg-purple-950/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-white rounded-[40px] shadow-2xl flex flex-col overflow-hidden max-h-[95vh] border border-white/20">
        
        {/* HEADER */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center border-2 border-white shadow-sm overflow-hidden relative">
              {formData.foto_url ? <img src={formData.foto_url} className="w-full h-full object-cover" alt="Foto" /> : <Camera className="text-purple-400" size={24} />}
            </div>
            <div>
              <h2 className="text-xl font-black text-black uppercase tracking-tighter">{formData.nome_completo}</h2>
              <div className="flex gap-2 items-center mt-1">
                <span className="text-[9px] font-black px-2 py-0.5 rounded bg-purple-200 text-purple-700 uppercase">{formData.status_matricula}</span>
                <span className="text-[9px] font-bold text-gray-400 uppercase">ID: {formData.id}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-red-50 text-red-500 rounded-xl transition-colors"><X size={24} /></button>
        </div>

        {/* NAV */}
        <div className="flex px-6 bg-white border-b border-gray-100 overflow-x-auto scrollbar-hide">
          {[
            { id: 'cadastro', label: 'Cadastro', icon: User, error: erroMaioridade },
            { id: 'escolaridade', label: 'Escolaridade', icon: GraduationCap },
            { id: 'saude', label: 'Saúde', icon: HeartPulse },
            ...(precisaResponsavel ? [{ id: 'responsavel', label: 'Responsável', icon: Users }] : []),
            { id: 'anotacoes', label: 'Anotações', icon: MessageSquare },
            { id: 'movimentacoes', label: 'Movimentações', icon: FileText },
            { id: 'documentos', label: 'Documentos', icon: FileText },
          ].map((tab) => (
            <button key={tab.id} onClick={() => setAbaAtiva(tab.id as any)} className={`flex items-center gap-2 px-6 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${abaAtiva === tab.id ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-400'}`}>
              <tab.icon size={14} /> {tab.label}
              {tab.error && <AlertTriangle size={12} className="text-red-500 animate-pulse ml-1" />}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-8 scrollbar-thin">
           {abaAtiva === 'cadastro' && (
             <div className="space-y-6">
               <div className="grid grid-cols-2 gap-4 bg-gray-50 p-6 rounded-[24px]">
                 <EditableField label="Nome Completo" value={formData.nome_completo} isEditing={isEditing} fieldName="nome_completo" onChange={handleFieldChange} />
                 <EditableField label="CPF" value={formData.cpf} isEditing={isEditing} fieldName="cpf" onChange={handleFieldChange} />
                 <EditableField label="Idade" value={formData.idade} isEditing={isEditing} type="number" fieldName="idade" onChange={handleFieldChange} />
                 <EditableField label="Cidade" value={formData.cidade} isEditing={isEditing} fieldName="cidade" onChange={handleFieldChange} />
               </div>
               <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 flex justify-between items-center">
                 <span className="text-[10px] font-black uppercase text-blue-700">Status LGPD:</span>
                 <span className={`text-[10px] font-black px-3 py-1 rounded-full ${formData.lgpd_aceito ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                   {formData.lgpd_aceito ? 'ASSINADO' : 'PENDENTE'}
                 </span>
               </div>
             </div>
           )}

           {abaAtiva === 'anotacoes' && (
             <div className="space-y-4">
               {anotacoes.map((anot, idx) => (
                 <div key={anot.id || idx} className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                   <p className="text-xs text-black">{anot.texto_anotacao}</p>
                   <p className="text-[9px] text-gray-400 mt-2">{new Date(anot.created_at).toLocaleString()}</p>
                 </div>
               ))}
               <textarea
                 className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 text-sm font-black text-black h-24 outline-none focus:border-purple-500"
                 placeholder="Nova anotação..."
                 value={novaAnotacaoTexto}
                 onChange={(e) => setNovaAnotacaoTexto(e.target.value)}
               />
               <button onClick={handleAddAnotacao} disabled={loading || !novaAnotacaoTexto.trim()} className="w-full py-3 bg-purple-600 text-white rounded-2xl text-[10px] font-black uppercase disabled:opacity-50 flex items-center justify-center gap-2">
                 <Save size={14} /> Salvar Anotação
               </button>
             </div>
           )}

           {abaAtiva === 'movimentacoes' && (
             <div className="space-y-3">
               {historicoInscricao.map((mov, idx) => (
                 <div key={mov.id || idx} className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                   <p className="text-xs text-black">Status: <span className="font-bold">{mov.status_definido}</span></p>
                   {mov.justificativa && <p className="text-xs text-gray-600 mt-1 italic">"{mov.justificativa}"</p>}
                   <p className="text-[9px] text-gray-400 mt-2">{new Date(mov.criado_em).toLocaleString()}</p>
                 </div>
               ))}
             </div>
           )}
           
           {abaAtiva === 'documentos' && (
             <div className="space-y-3">
                <DocItem label="RG/CPF (ZIP)" url={formData.url_documentos_zip || ''} />
                <DocItem label="Termo assinado" url={formData.url_termo_lgpd || ''} />
             </div>
           )}
        </div>

        {/* FOOTER */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 flex flex-col gap-4">
          {formData.status_matricula === 'Em Análise' && (
            <div className="bg-white p-5 rounded-[32px] border-2 border-purple-100 shadow-sm">
              <div className="flex flex-col gap-4 mb-4">
                <p className="text-[10px] font-black uppercase text-purple-600">Selecione os Cursos para Efetivar:</p>
                <div className="flex flex-wrap gap-2">
                  {availableCourses.map(curso => (
                    <button 
                      key={curso.id} 
                      onClick={() => setCursosSelecionados(prev => prev.includes(curso.id) ? prev.filter(id => id !== curso.id) : [...prev, curso.id])} 
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all ${cursosSelecionados.includes(curso.id) ? 'border-purple-600 bg-purple-50' : 'border-gray-100 bg-gray-50'}`}
                    >
                      <span className="text-[9px] font-black uppercase">{curso.nome}</span>
                      {cursosSelecionados.includes(curso.id) && <Check size={10} className="text-purple-600" />}
                    </button>
                  ))}
                </div>
              </div>
              <button disabled={cursosSelecionados.length === 0} className="w-full py-4 bg-green-500 text-white rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2">
                <CheckCircle size={16} /> Efetivar Matrícula
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button onClick={() => isEditing ? handleSaveEdit() : setIsEditing(true)} className={`px-6 py-4 rounded-2xl font-black text-[10px] uppercase transition-all ${isEditing ? 'bg-green-600 text-white shadow-lg' : 'bg-white border border-gray-200 text-black'}`}>
              {isEditing ? <><Save size={14} /> Salvar</> : <><Edit3 size={14} /> Editar</>}
            </button>
            <button onClick={() => setShowMotivoModal({show: true, status: 'Incompleto'})} className="px-6 py-4 bg-white border border-amber-200 text-amber-600 rounded-2xl font-black text-[10px] uppercase">Incompleto</button>
            <button onClick={() => setShowMotivoModal({show: true, status: 'Desistente'})} className="px-6 py-4 bg-white border border-red-200 text-red-600 rounded-2xl font-black text-[10px] uppercase">Desistência</button>
          </div>
        </div>
      </div>

      {/* MODAL JUSTIFICATIVA */}
      {showMotivoModal.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[300] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md rounded-[32px] p-8">
            <h3 className="text-xs font-black uppercase text-black mb-4 italic">Motivo: {showMotivoModal.status}</h3>
            <textarea 
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 text-sm font-black h-32 outline-none" 
              placeholder="Justifique a mudança..." 
              value={motivoTexto}
              onChange={(e) => setMotivoTexto(e.target.value)}
            />
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowMotivoModal({show: false, status: null})} className="flex-1 text-[10px] font-black uppercase text-gray-400">Cancelar</button>
              <button onClick={() => handleUpdateStatus(showMotivoModal.status!, motivoTexto)} className="flex-[2] py-4 bg-black text-white rounded-2xl text-[10px] font-black uppercase">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Auxiliares
function EditableField({ label, value, isEditing, type = "text", fieldName, onChange }: {
  label: string; value: any; isEditing: boolean; type?: string; fieldName: keyof InscricaoData; onChange: (f: keyof InscricaoData, v: any) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[8px] font-black text-gray-400 uppercase">{label}</label>
      {isEditing ? (
        <input type={type} value={value || ''} onChange={(e) => onChange(fieldName, type === "number" ? Number(e.target.value) : e.target.value)} className="p-2 bg-white border border-purple-200 rounded-lg text-xs font-black" />
      ) : (
        <p className="text-xs font-black text-black uppercase truncate">{value || '---'}</p>
      )}
    </div>
  );
}

function DocItem({ label, url }: { label: string, url: string }) {
  return (
    <div className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl">
      <div className="flex items-center gap-3">
        <FileText size={18} className="text-purple-600" />
        <span className="text-[10px] font-black text-black uppercase">{label}</span>
      </div>
      {url ? <a href={url} target="_blank" rel="noreferrer" className="p-2 bg-purple-50 text-purple-600 rounded-lg text-[9px] font-black uppercase">Ver</a> : <span className="text-[9px] text-gray-300 font-black uppercase">Ausente</span>}
    </div>
  );
}