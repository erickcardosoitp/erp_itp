'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  GraduationCap, Users, BookOpen, LayoutGrid, History,
  ClipboardList, AlertCircle, RefreshCw, ClipboardCheck,
  FileText, Activity, Shield, UserPlus,
} from 'lucide-react';
import api from '@/services/api';
import { useAuth } from '@/context/auth-context';
import { usePermissions } from '@/hooks/use-permissions';

import { TabBtn } from './components/_shared';
import type { Curso, Professor, Turma, Aluno } from './components/_types';

import { GradeTab }    from './components/GradeTab';
import AlunosTab       from './components/AlunosTab';
import PresencaTab     from './components/PresencaTab';
import CursosTab       from './components/CursosTab';
import TurmasTab       from './components/TurmasTab';
import DiarioTab       from './components/DiarioTab';
import AcervoTab       from './components/AcervoTab';
import ChamadosTab     from './components/ChamadosTab';
import MonitoramentoTab from './components/MonitoramentoTab';
import ControlesTab    from './components/ControlesTab';
import MatriculasTab   from './components/MatriculasTab';

// ─── Cache helpers (12h TTL, localStorage) ────────────────────────────────────

const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours in ms

function getCached<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(key); return null; }
    return data as T;
  } catch { return null; }
}

function setCache(key: string, data: unknown) {
  try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

// ─── AcademicoPage ────────────────────────────────────────────────────────────

export default function AcademicoPage() {
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === 'undefined') return 'matriculas';
    const params = new URLSearchParams(window.location.search);
    if (params.get('aluno')) return 'alunos';
    const VALID = ['matriculas','grade','alunos','presenca','cursos','turmas','diario','acervo','chamados','monitoramento','controles'];
    const tab = params.get('tab') ?? 'matriculas';
    return VALID.includes(tab) ? tab : 'matriculas';
  });
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const { canWrite: podeEditar } = usePermissions(user);

  const loadBase = useCallback(async (forceRefresh = false) => {
    setRefreshing(true);
    try {
      if (!forceRefresh) {
        const cachedCursos    = getCached<Curso[]>('academico_cursos');
        const cachedProfs     = getCached<Professor[]>('academico_professores');
        const cachedTurmas    = getCached<Turma[]>('academico_turmas');
        const cachedAlunos    = getCached<Aluno[]>('academico_alunos');
        if (cachedCursos && cachedProfs && cachedTurmas && cachedAlunos) {
          setCursos(cachedCursos);
          setProfessores(cachedProfs);
          setTurmas(cachedTurmas);
          setAlunos(cachedAlunos);
          setRefreshing(false);
          return;
        }
      }
      const [rc, rp, rt, ra] = await Promise.all([
        api.get('/academico/cursos'),
        api.get('/academico/professores'),
        api.get('/academico/turmas'),
        api.get('/academico/alunos'),
      ]);
      setCursos(rc.data);
      setProfessores(rp.data);
      setTurmas(rt.data);
      setAlunos(ra.data);
      setCache('academico_cursos', rc.data);
      setCache('academico_professores', rp.data);
      setCache('academico_turmas', rt.data);
      setCache('academico_alunos', ra.data);
    } catch {}
    setRefreshing(false);
  }, []);

  useEffect(() => {
    setIsMounted(true);
    loadBase();
  }, [loadBase]);

  if (!isMounted) return null;

  const TABS = [
    { id: 'matriculas',    label: 'Matrículas',    Icon: UserPlus },
    { id: 'grade',         label: 'Grade',         Icon: LayoutGrid },
    { id: 'alunos',        label: 'Alunos',        Icon: Users },
    { id: 'presenca',      label: 'Presença',      Icon: ClipboardCheck },
    { id: 'cursos',        label: 'Cursos',        Icon: BookOpen },
    { id: 'turmas',        label: 'Turmas',        Icon: ClipboardList },
    { id: 'diario',        label: 'Diário',        Icon: History },
    { id: 'acervo',        label: 'Acervo',        Icon: FileText },
    { id: 'chamados',      label: 'Chamados',      Icon: AlertCircle },
    { id: 'monitoramento', label: 'Monitoramento', Icon: Activity },
    { id: 'controles',     label: 'Controles',     Icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#131b2e] p-4 md:p-6 lg:p-8 font-sans antialiased text-slate-900 dark:text-slate-100">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <header className="flex flex-col md:flex-row justify-between md:items-center bg-white dark:bg-slate-900 p-4 md:p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm gap-3">
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-purple-600 p-3 rounded-2xl shadow-lg">
              <GraduationCap className="text-white" size={26} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black uppercase tracking-tighter italic text-slate-900 dark:text-white">
                Acadêmico<span className="text-purple-400">.ITP</span>
              </h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                Matrículas · Grade · Alunos · Presença
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 min-w-0 w-full md:w-auto">
            <button
              onClick={() => loadBase(true)}
              disabled={refreshing}
              title="Atualizar dados"
              className="shrink-0 p-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-purple-100 dark:hover:bg-purple-900/30 text-slate-500 dark:text-slate-300 hover:text-purple-600 transition-all disabled:opacity-60"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <nav className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl gap-1 overflow-x-auto min-w-0 flex-1">
              {TABS.map(t => <TabBtn key={t.id} id={t.id} active={activeTab} set={setActiveTab} label={t.label} Icon={t.Icon} />)}
            </nav>
          </div>
        </header>
        <main>
          {activeTab === 'matriculas'    && <MatriculasTab podeEditar={podeEditar} />}
          {activeTab === 'grade'         && <GradeTab podeEditar={podeEditar} turmas={turmas} />}
          {activeTab === 'alunos'        && <AlunosTab cursos={cursos} turmas={turmas} podeEditar={podeEditar} />}
          {activeTab === 'presenca'      && <PresencaTab turmas={turmas} podeEditar={podeEditar} />}
          {activeTab === 'cursos'        && <CursosTab />}
          {activeTab === 'turmas'        && <TurmasTab cursos={cursos} professores={professores} alunos={alunos} />}
          {activeTab === 'diario'        && <DiarioTab turmas={turmas} alunos={alunos} />}
          {activeTab === 'acervo'        && <AcervoTab />}
          {activeTab === 'chamados'      && <ChamadosTab alunos={alunos} turmas={turmas} podeEditar={podeEditar} />}
          {activeTab === 'monitoramento' && <MonitoramentoTab />}
          {activeTab === 'controles'     && <ControlesTab podeEditar={podeEditar} />}
        </main>
      </div>
    </div>
  );
}
