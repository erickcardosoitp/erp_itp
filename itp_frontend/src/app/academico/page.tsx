'use client';

import React, { useState, useEffect } from 'react';
import { 
  GraduationCap, Users, Calendar, BookOpen, 
  Search, Clock, Plus, LayoutGrid, History,
  Save, Trash2, UserPlus, CheckCircle2, ChevronRight
} from 'lucide-react';

export default function GestaoAcademicaCompleta() {
  const [activeTab, setActiveTab] = useState('grade'); 
  const [isMounted, setIsMounted] = useState(false);
  const [grade, setGrade] = useState({}); // Estado da Grade

  useEffect(() => { setIsMounted(true); }, []);
  if (!isMounted) return null;

  // --- LÓGICA DA GRADE ---
  const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
  const HORARIOS = ['08:00', '09:00', '10:00', '11:00'];

  const handleAlocar = (dia, hora) => {
    const disc = prompt("Disciplina:");
    if (disc) setGrade({ ...grade, [`${dia}-${hora}`]: { disc, prof: 'Prof. Ricardo' } });
  };

  return (
    <div className="min-h-screen bg-[#FDFDFF] p-6 lg:p-10 font-sans">
      <div className="max-w-[1600px] mx-auto space-y-8">
        
        {/* HEADER UNIFICADO */}
        <header className="flex justify-between items-center bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="bg-purple-600 p-3 rounded-2xl shadow-lg"><GraduationCap className="text-white" size={28} /></div>
            <h1 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Acadêmico<span className="text-purple-600">.ITP</span></h1>
          </div>
          <nav className="flex bg-slate-100 p-1.5 rounded-2xl gap-1">
            <TabBtn id="grade" active={activeTab} set={setActiveTab} label="Grade" icon={LayoutGrid} />
            <TabBtn id="alunos" active={activeTab} set={setActiveTab} label="Alunos" icon={Users} />
            <TabBtn id="diario" active={activeTab} set={setActiveTab} label="Diário" icon={History} />
          </nav>
        </header>

        {/* CONTEÚDO DINÂMICO */}
        <div className="animate-in fade-in duration-500">
          
          {/* VIEW: MONTAR GRADE */}
          {activeTab === 'grade' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-black uppercase italic text-slate-800">Editor de Matriz Semanal</h2>
                <button className="bg-purple-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 shadow-lg shadow-purple-200">
                  <Save size={16}/> Salvar Alterações
                </button>
              </div>

              <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl overflow-hidden">
                <div className="grid grid-cols-6 bg-slate-50 border-b border-slate-100">
                  <div className="p-4 border-r border-slate-100"></div>
                  {DIAS.map(d => <div key={d} className="p-4 text-center text-[10px] font-black uppercase text-slate-400">{d}</div>)}
                </div>
                {HORARIOS.map(h => (
                  <div key={h} className="grid grid-cols-6 border-b border-slate-50 last:border-0 group">
                    <div className="p-6 border-r border-slate-100 bg-slate-50/30 flex items-center justify-center font-mono font-black text-slate-400 text-xs">{h}</div>
                    {DIAS.map(d => {
                      const aula = grade[`${d}-${h}`];
                      return (
                        <div key={`${d}-${h}`} onClick={() => !aula && handleAlocar(d, h)} className={`p-2 min-h-[100px] border-r border-slate-50 last:border-0 transition-all ${!aula ? 'hover:bg-purple-50/50 cursor-pointer' : ''}`}>
                          {aula ? (
                            <div className="h-full bg-purple-900 rounded-xl p-3 shadow-md relative group/card">
                              <p className="text-[9px] font-black text-purple-300 uppercase leading-none">{aula.disc}</p>
                              <p className="text-[10px] font-bold text-white uppercase mt-1">{aula.prof}</p>
                              <button onClick={(e) => {e.stopPropagation(); const n = {...grade}; delete n[`${d}-${h}`]; setGrade(n);}} className="absolute top-1 right-1 opacity-0 group-hover/card:opacity-100 text-rose-400 p-1"><Trash2 size={12}/></button>
                            </div>
                          ) : (
                            <div className="h-full border-2 border-dashed border-slate-100 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Plus size={16} className="text-purple-200" /></div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VIEW: GESTÃO DE ALUNOS */}
          {activeTab === 'alunos' && (
            <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl p-8">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-black uppercase italic text-slate-800">Base de Discentes</h2>
                <button className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase flex items-center gap-2"><UserPlus size={16}/> Novo Aluno</button>
              </div>
              <div className="space-y-3">
                 {[1,2,3].map(i => (
                   <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl hover:bg-purple-50 transition-colors cursor-pointer border border-transparent hover:border-purple-100">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center font-black text-purple-600 text-xs">AL</div>
                        <div>
                          <p className="text-sm font-black text-slate-800 uppercase">Aluno de Exemplo {i}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Matrícula: 202600{i} • Informática</p>
                        </div>
                      </div>
                      <ChevronRight className="text-slate-300" size={18} />
                   </div>
                 ))}
              </div>
            </div>
          )}

          {/* VIEW: DIÁRIO DE CLASSE */}
          {activeTab === 'diario' && (
            <div className="h-64 border-4 border-dashed border-slate-100 rounded-[40px] flex items-center justify-center text-slate-300 uppercase font-black text-[10px] tracking-widest">
              Selecione uma aula na Grade para lançar presença
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// --- SUB-COMPONENTES ---

function TabBtn({ id, active, set, label, icon: Icon }) {
  const isActive = active === id;
  return (
    <button 
      onClick={() => set(id)}
      className={`px-6 py-3 rounded-xl flex items-center gap-2 transition-all ${isActive ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
    >
      <Icon size={16} strokeWidth={isActive ? 3 : 2} />
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}