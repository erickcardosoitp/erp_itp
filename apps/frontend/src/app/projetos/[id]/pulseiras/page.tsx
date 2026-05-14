'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer, RefreshCw } from 'lucide-react';
import api from '@/services/api';

interface Equipe { id: string; nome: string; cor: string; }
interface Inscricao {
  id: string; nome_completo: string; data_nascimento?: string;
  nome_responsavel?: string; telefone_responsavel?: string;
  cuidado_especial?: string; detalhes_cuidado?: string;
  equipe_id?: string; equipe?: Equipe;
  endereco?: string; foto_url?: string;
}
interface Projeto {
  id: string; nome: string;
  pulseira_largura_mm: number; pulseira_altura_mm: number;
}

function calcIdade(dob?: string) {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob.slice(0, 10) + 'T12:00:00').getTime();
  const age = Math.floor(diff / (365.25 * 24 * 3600 * 1000));
  return isNaN(age) ? null : age;
}

// ── Componente Crachá ─────────────────────────────────────────────────────────

function Cracha({ ins, equipe, largura, altura }: {
  ins: Inscricao; equipe?: Equipe; largura: number; altura: number;
}) {
  const idade = calcIdade(ins.data_nascimento);
  const temCuidado = ins.cuidado_especial && ins.cuidado_especial !== 'Não';
  const cor = equipe?.cor ?? '#7c3aed';

  const nomeLen = ins.nome_completo.length;
  const fSize = Math.max(4.5, 7 - Math.max(0, nomeLen - 16) * 0.15);
  const infoSize = Math.max(4, fSize - 1.2);

  const fotoSize = Math.round(largura * 0.72); // ~72% da largura em mm
  const barHeight = Math.max(5, altura * 0.1);

  const initials = ins.nome_completo.trim().split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase();

  return (
    <div
      className="cracha-item"
      style={{
        width: `${largura}mm`,
        height: `${altura}mm`,
        border: `0.6mm solid ${cor}`,
        borderRadius: '2mm',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        background: 'white',
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      {/* Foto */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: `1.5mm 1.5mm 1mm`, flexShrink: 0 }}>
        {ins.foto_url ? (
          <img
            src={ins.foto_url}
            alt=""
            style={{
              width: `${fotoSize}mm`, height: `${fotoSize}mm`,
              objectFit: 'cover',
              borderRadius: '1.5mm',
              border: `0.4mm solid ${cor}`,
              display: 'block',
            }}
          />
        ) : (
          <div style={{
            width: `${fotoSize}mm`, height: `${fotoSize}mm`,
            borderRadius: '1.5mm',
            background: cor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 900,
            fontSize: `${Math.round(fotoSize * 1.8)}pt`,
            letterSpacing: '0.05em',
          }}>
            {initials}
          </div>
        )}
      </div>

      {/* Conteúdo textual */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 1.5mm', gap: '0.8mm', overflow: 'hidden', minHeight: 0 }}>

        {/* Linha 1: Nome | Idade + Telefone responsável */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5mm' }}>
          <div style={{
            flex: 1, fontWeight: 900, fontSize: `${fSize}pt`,
            color: '#111', lineHeight: 1.15,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {ins.nome_completo}{idade !== null ? ` | ${idade}a` : ''}
          </div>
          {ins.telefone_responsavel && (
            <div style={{
              fontSize: `${infoSize}pt`, color: '#444',
              lineHeight: 1.15, whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              {ins.telefone_responsavel}
            </div>
          )}
        </div>

        {/* Linha 2: Endereço */}
        <div style={{
          fontSize: `${infoSize}pt`, color: '#555', lineHeight: 1.15,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {ins.endereco || '—'}
        </div>

        {/* Linha 3: Cuidados especiais */}
        <div style={{
          fontSize: `${infoSize}pt`, lineHeight: 1.15,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          color: temCuidado ? '#dc2626' : '#aaa',
          fontWeight: temCuidado ? 700 : 400,
        }}>
          {temCuidado
            ? `⚠ ${ins.cuidado_especial}${ins.detalhes_cuidado ? `: ${ins.detalhes_cuidado}` : ''}`
            : 'Sem cuidados especiais'}
        </div>
      </div>

      {/* Linha 4: Cor da equipe */}
      <div style={{
        background: cor,
        color: 'white',
        textAlign: 'center',
        fontWeight: 900,
        fontSize: `${Math.max(4.5, barHeight * 0.55)}pt`,
        height: `${barHeight}mm`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        letterSpacing: '0.06em',
        flexShrink: 0,
        textTransform: 'uppercase',
      }}>
        {equipe?.nome ?? '—'}
      </div>
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function CrachasPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [projeto, setProjeto] = useState<Projeto | null>(null);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [inscritos, setInscritos] = useState<Inscricao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEquipe, setFiltroEquipe] = useState('');
  const [largura, setLargura] = useState(30);
  const [altura, setAltura] = useState(60);
  const [colunas, setColunas] = useState(4);
  const [salvandoDims, setSalvandoDims] = useState(false);

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
      setLargura(rp.data.pulseira_largura_mm ?? 30);
      setAltura(rp.data.pulseira_altura_mm ?? 60);
    } catch {}
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const salvarDimensoes = async () => {
    setSalvandoDims(true);
    try {
      await api.patch(`/projetos/${id}`, { pulseira_largura_mm: largura, pulseira_altura_mm: altura });
    } finally { setSalvandoDims(false); }
  };

  const inscritosFiltrados = inscritos.filter(i => !filtroEquipe || i.equipe_id === filtroEquipe);

  if (loading) return <div className="flex items-center justify-center min-h-screen text-slate-400">Carregando...</div>;
  if (!projeto) return null;

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${colunas}, ${largura}mm)`,
    gap: '3mm',
    padding: '5mm',
  };

  return (
    <>
      {/* Controles */}
      <div className="no-print bg-slate-50 dark:bg-slate-950 min-h-screen">
        <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center gap-4 flex-wrap">
            <button onClick={() => router.push(`/projetos/${id}`)}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-bold transition-colors">
              <ArrowLeft size={13} /> Voltar
            </button>
            <div className="flex-1">
              <h1 className="font-black text-sm text-slate-800 dark:text-slate-100">{projeto.nome} — Crachás</h1>
            </div>

            {/* Filtro equipe */}
            <select value={filtroEquipe} onChange={e => setFiltroEquipe(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400 text-slate-600 dark:text-slate-300">
              <option value="">Todas as equipes ({inscritos.length})</option>
              {equipes.map(e => (
                <option key={e.id} value={e.id}>{e.nome} ({inscritos.filter(i => i.equipe_id === e.id).length})</option>
              ))}
            </select>

            {/* Dimensões */}
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-1.5">
              <span className="text-[10px] font-black uppercase text-slate-500">mm</span>
              <input type="number" min={20} max={120} value={largura} onChange={e => setLargura(+e.target.value)}
                className="w-12 text-center text-xs font-bold border border-slate-200 dark:border-slate-600 rounded-lg px-1 py-1 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-400"
                title="Largura (mm)" />
              <span className="text-slate-400 text-xs">×</span>
              <input type="number" min={30} max={150} value={altura} onChange={e => setAltura(+e.target.value)}
                className="w-12 text-center text-xs font-bold border border-slate-200 dark:border-slate-600 rounded-lg px-1 py-1 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-400"
                title="Altura (mm)" />
              <button onClick={salvarDimensoes} disabled={salvandoDims}
                className="text-[10px] font-black uppercase text-purple-600 hover:text-purple-800 disabled:opacity-50">
                {salvandoDims ? <RefreshCw size={11} className="animate-spin" /> : 'Salvar'}
              </button>
            </div>

            {/* Colunas por linha */}
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-1.5">
              <span className="text-[10px] font-black uppercase text-slate-500">por linha</span>
              {[2, 3, 4, 5, 6].map(n => (
                <button key={n} onClick={() => setColunas(n)}
                  className={`text-xs font-bold w-6 h-6 rounded-lg transition-colors ${colunas === n ? 'bg-purple-600 text-white' : 'text-slate-500 hover:text-slate-800'}`}>
                  {n}
                </button>
              ))}
            </div>

            <button onClick={() => window.print()}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl font-black text-xs uppercase transition-colors">
              <Printer size={13} /> Imprimir ({inscritosFiltrados.length})
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="max-w-6xl mx-auto p-6">
          {inscritosFiltrados.length === 0 && (
            <div className="py-16 text-center text-slate-400 text-sm">Nenhum inscrito para imprimir.</div>
          )}
          <div style={{ ...gridStyle, gridTemplateColumns: `repeat(auto-fill, ${largura * 3.78}px)` }}>
            {inscritosFiltrados.map(ins => {
              const eq = equipes.find(e => e.id === ins.equipe_id);
              return (
                <div key={ins.id} className="shadow-sm hover:shadow-md transition-shadow">
                  <Cracha ins={ins} equipe={eq} largura={largura} altura={altura} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Área de impressão */}
      <div className="print-only">
        <div style={gridStyle}>
          {inscritosFiltrados.map(ins => {
            const eq = equipes.find(e => e.id === ins.equipe_id);
            return <Cracha key={ins.id} ins={ins} equipe={eq} largura={largura} altura={altura} />;
          })}
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-only, .print-only * {
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          .print-only {
            position: absolute;
            top: 0; left: 0;
          }
          .cracha-item * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page { margin: 5mm; size: auto; }
        }
        @media screen {
          .print-only { display: none; }
        }
      `}</style>
    </>
  );
}
