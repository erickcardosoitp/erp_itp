"use client";
import React, { useState, useEffect, useCallback } from 'react';
import {
  X, User, FileText, Camera, HeartPulse, Edit3,
  CheckCircle, Save, MessageSquare, GraduationCap, Users, 
  AlertTriangle, Send, Link, Check, Loader2
} from 'lucide-react';
// ✅ IMPORTANTE: Usando a nossa instância configurada que já lida com o itp_token
import api from '@/services/api'; 

// Interfaces (Mantidas para consistência)
interface Materia { id: string; nome: string; }
interface Anotacao { id: string; texto_anotacao: string; created_at: string; }
interface HistoricoInscricao { id: number; status_definido: string; justificativa?: string; criado_em: string; }

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
  url_documentos_zip?: string;
  url_termo_lgpd?: string;
  cuidado_especial?: string;
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
  const [abaAtiva, setAbaAtiva] = useState<'cadastro' | 'anotacoes' | 'movimentacoes' | 'documentos'>('cadastro');

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

  // ✅ HANDLERS UNIFICADOS VIA AXIOS (itp_token automático)
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

  const handleEfetivarMatricula = async () => {
    if (cursosSelecionados.length === 0) return;
    setLoading(true);
    try {
      // ✅ Endpoint correto do seu Backend para finalizar matrícula
      await api.post(`/matriculas/${aluno.id}/finalizar`, { 
        cursos: cursosSelecionados 
      });
      alert("Matrícula efetivada com sucesso!");
      onSuccess?.();
      onClose();
    } catch (error: any) {
      alert("Falha na efetivação: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    setLoading(true);
    try {
      await api.patch(`/matriculas/inscricao/${aluno.id}`, formData);
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

  // ✅ FETCH INICIAL SINCRONIZADO
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [resCursos, resAnot, resHist] = await Promise.all([
          api.get('/materias'),
          api.get(`/matriculas/inscricao/${aluno.id}/anotacoes`),
          api.get(`/matriculas/inscricao/${aluno.id}/historico`)
        ]);

        setAvailableCourses(resCursos.data);
        setAnotacoes(resAnot.data);
        setHistoricoInscricao(resHist.data);
      } catch (error: any) {
        console.error("Erro no load do Dossier:", error.response?.status);
      } finally {
        setLoading(false);
      }
    };

    if (aluno?.id) fetchData();
  }, [aluno.id]);

  return (
    <div className="fixed inset-0 bg-purple-950/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-3xl bg-white rounded-[40px] shadow-2xl flex flex-col overflow-hidden max-h-[95vh] border border-white/20">
        
        {/* HEADER */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center border-2 border-white shadow-sm overflow-hidden">
              {formData.foto_url ? <img src={formData.foto_url} className="w-full h-full object-cover" alt="Foto" /> : <Camera className="text-purple-400" size={24} />}
            </div>
            <div>
              <h2 className="text-xl font-black text-black uppercase tracking-tighter">{formData.nome_completo}</h2>
              <div className="flex gap-2 items-center mt-1">
                <span className="text-[9px] font-black px-2 py-0.5 rounded bg-purple-200 text-purple-700 uppercase">{formData.status_matricula}</span>
                <span className="text-[9px] font-bold text-gray-400 uppercase">CPF: {formData.cpf}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-red-50 text-red-500 rounded-xl transition-colors"><X size={24} /></button>
        </div>

        {/* NAV */}
        <div className="flex px-6 bg-white border-b border-gray-100 overflow-x-auto scrollbar-hide">
          {[
            { id: 'cadastro', label: 'Cadastro', icon: User, error: erroMaioridade },
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
           {loading && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-purple-600" size={32} /></div>}
           
           {!loading && abaAtiva === 'cadastro' && (
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

           {!loading && abaAtiva === 'anotacoes' && (
             <div className="space-y-4">
               {anotacoes.map((anot, idx) => (
                 <div key={idx} className="bg-gray-50 p-4 rounded-xl border border-gray-100">
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
               <button onClick={handleAddAnotacao} disabled={loading || !novaAnotacaoTexto.trim()} className="w-full py-3 bg-purple-600 text-white rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2">
                 <Save size={14} /> Salvar Anotação
               </button>
             </div>
           )}
           
           {!loading && abaAtiva === 'documentos' && (
             <div className="space-y-3">
                <DocItem label="RG/CPF (ZIP)" url={formData.url_documentos_zip || ''} />
                <DocItem label="Termo LGPD" url={formData.url_termo_lgpd || ''} />
             </div>
           )}
        </div>

        {/* FOOTER */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 flex flex-col gap-4">
          {formData.status_matricula === 'Em Validação' && (
            <div className="bg-white p-5 rounded-[32px] border-2 border-purple-100 shadow-sm">
              <p className="text-[10px] font-black uppercase text-purple-600 mb-3">Selecione os Cursos:</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {availableCourses.map(curso => (
                  <button 
                    key={curso.id} 
                    onClick={() => setCursosSelecionados(prev => prev.includes(curso.id) ? prev.filter(id => id !== curso.id) : [...prev, curso.id])} 
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all ${cursosSelecionados.includes(curso.id) ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-gray-100 bg-gray-50 text-gray-400'}`}
                  >
                    <span className="text-[9px] font-black uppercase">{curso.nome}</span>
                    {cursosSelecionados.includes(curso.id) && <Check size={10} />}
                  </button>
                ))}
              </div>
              <button onClick={handleEfetivarMatricula} disabled={cursosSelecionados.length === 0 || loading} className="w-full py-4 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 transition-all">
                {loading ? <Loader2 className="animate-spin" size={16} /> : <><CheckCircle size={16} /> Efetivar Matrícula</>}
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button onClick={() => isEditing ? handleSaveEdit() : setIsEditing(true)} className={`px-6 py-4 rounded-2xl font-black text-[10px] uppercase transition-all flex items-center gap-2 ${isEditing ? 'bg-green-600 text-white shadow-lg' : 'bg-white border border-gray-200 text-black hover:bg-gray-100'}`}>
              {isEditing ? <><Save size={14} /> Salvar Alterações</> : <><Edit3 size={14} /> Editar Dados</>}
            </button>
            <button onClick={() => setShowMotivoModal({show: true, status: 'Incompleto'})} className="px-6 py-4 bg-white border border-amber-200 text-amber-600 rounded-2xl font-black text-[10px] uppercase hover:bg-amber-50">Incompleto</button>
            <button onClick={() => setShowMotivoModal({show: true, status: 'Desistente'})} className="px-6 py-4 bg-white border border-red-200 text-red-600 rounded-2xl font-black text-[10px] uppercase hover:bg-red-50">Desistência</button>
          </div>
        </div>
      </div>

      {/* MODAL JUSTIFICATIVA */}
      {showMotivoModal.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[300] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md rounded-[32px] p-8">
            <h3 className="text-xs font-black uppercase text-black mb-4 italic">Motivo da alteração: {showMotivoModal.status}</h3>
            <textarea 
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 text-sm font-black h-32 outline-none focus:border-purple-500" 
              placeholder="Escreva a justificativa..." 
              value={motivoTexto}
              onChange={(e) => setMotivoTexto(e.target.value)}
            />
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowMotivoModal({show: false, status: null})} className="flex-1 text-[10px] font-black uppercase text-gray-400">Cancelar</button>
              <button onClick={() => handleUpdateStatus(showMotivoModal.status!, motivoTexto)} disabled={!motivoTexto.trim()} className="flex-[2] py-4 bg-black text-white rounded-2xl text-[10px] font-black uppercase disabled:opacity-50">Confirmar Mudança</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Auxiliares (Ajustados para tipagem correta)
function EditableField({ label, value, isEditing, type = "text", fieldName, onChange }: {
  label: string; value: any; isEditing: boolean; type?: string; fieldName: keyof InscricaoData; onChange: (f: keyof InscricaoData, v: any) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{label}</label>
      {isEditing ? (
        <input type={type} value={value || ''} onChange={(e) => onChange(fieldName, type === "number" ? Number(e.target.value) : e.target.value)} className="p-2 bg-white border border-purple-200 rounded-lg text-xs font-black text-purple-900 outline-none" />
      ) : (
        <p className="text-xs font-black text-black uppercase truncate">{value || '---'}</p>
      )}
    </div>
  );
}

function DocItem({ label, url }: { label: string, url: string }) {
  return (
    <div className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
      <div className="flex items-center gap-3">
        <FileText size={18} className="text-purple-600" />
        <span className="text-[10px] font-black text-black uppercase">{label}</span>
      </div>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="px-4 py-2 bg-purple-50 text-purple-600 rounded-xl text-[9px] font-black uppercase hover:bg-purple-100 transition-all">Ver Documento</a>
      ) : (
        <span className="text-[9px] text-gray-300 font-black uppercase">Não enviado</span>
      )}
    </div>
  );
}