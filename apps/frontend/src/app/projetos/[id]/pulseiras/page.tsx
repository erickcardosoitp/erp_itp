'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer, AlertTriangle, RefreshCw } from 'lucide-react';
import api from '@/services/api';

interface Equipe { id: string; nome: string; cor: string; }
interface Inscricao {
  id: string; nome_completo: string; data_nascimento?: string;
  nome_responsavel?: string; telefone_responsavel?: string;
  cuidado_especial?: string; equipe_id?: string; equipe?: Equipe;
}
interface Projeto {
  id: string; nome: string;
  pulseira_largura_mm: number; pulseira_altura_mm: number;
}

function calcIdade(dob?: string) {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob + 'T12:00:00').getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

// ── Componente Pulseira ───────────────────────────────────────────────────────

function Pulseira({ ins, equipe, largura, altura }: {
  ins: Inscricao; equipe?: Equipe; largura: number; altura: number;
}) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const idade = calcIdade(ins.data_nascimento);
  const temCuidado = ins.cuidado_especial && ins.cuidado_especial !== 'Não';
  const nomeLen = ins.nome_completo.length;
  const fontSize = Math.max(5, 8 - Math.max(0, nomeLen - 22) * 0.2);

  useEffect(() => {
    if (!barcodeRef.current) return;
    import('jsbarcode').then(({ default: JsBarcode }) => {
      try {
        JsBarcode(barcodeRef.current, ins.id, {
          format: 'CODE128',
          displayValue: false,
          margin: 0,
          height: Math.max(12, altura * 1.5),
          width: 1,
          background: 'transparent',
        });
      } catch {}
    });
  }, [ins.id, altura]);

  return (
    <div
      className="pulseira-container"
      style={{
        width: `${largura}mm`,
        height: `${altura}mm`,
        border: '0.5px solid #ccc',
        borderRadius: '3px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        padding: '1.5mm',
        boxSizing: 'border-box',
        background: 'white',
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
        position: 'relative',
        fontFamily: 'Arial, sans-serif',
      }}>

      {/* Linha 1: cuidado especial + equipe */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', minHeight: `${altura * 0.22}mm` }}>
        {temCuidado ? (
          <span style={{
            background: '#dc2626', color: 'white',
            fontSize: `${Math.max(4, altura * 0.18)}pt`, fontWeight: 900,
            padding: '0.3mm 1mm', borderRadius: '1mm', lineHeight: 1.2,
            maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            ⚠ {ins.cuidado_especial}
          </span>
        ) : <span />}

        {equipe && (
          <span style={{
            background: equipe.cor, color: 'white',
            fontSize: `${Math.max(4, altura * 0.18)}pt`, fontWeight: 900,
            padding: '0.3mm 1.5mm', borderRadius: '1mm', lineHeight: 1.2,
            maxWidth: '50%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {equipe.nome}
          </span>
        )}
      </div>

      {/* Linha 2: nome + idade */}
      <div style={{
        fontWeight: 900,
        fontSize: `${fontSize}pt`,
        lineHeight: 1.2,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        color: '#111',
        flexShrink: 0,
      }}>
        {ins.nome_completo}{idade !== null ? ` · ${idade} ANOS` : ''}
      </div>

      {/* Linha 3: responsável */}
      {ins.nome_responsavel && (
        <div style={{
          fontSize: `${Math.max(4, fontSize - 1.5)}pt`,
          color: '#444', lineHeight: 1.2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          {ins.nome_responsavel}{ins.telefone_responsavel ? ` · ${ins.telefone_responsavel}` : ''}
        </div>
      )}

      {/* Barcode */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
        <svg ref={barcodeRef} style={{ width: '100%', height: `${Math.max(8, altura * 0.38)}mm`, display: 'block' }} />
      </div>
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function PulseirasPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [projeto, setProjeto] = useState<Projeto | null>(null);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [inscritos, setInscritos] = useState<Inscricao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEquipe, setFiltroEquipe] = useState('');
  const [largura, setLargura] = useState(54);
  const [altura, setAltura] = useState(25);
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
      setLargura(rp.data.pulseira_largura_mm);
      setAltura(rp.data.pulseira_altura_mm);
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

  const inscritosFiltrados = inscritos.filter(i =>
    !filtroEquipe || i.equipe_id === filtroEquipe
  );

  if (loading) return <div className="flex items-center justify-center min-h-screen text-slate-400">Carregando...</div>;
  if (!projeto) return null;

  return (
    <>
      {/* ── Controles (ocultos na impressão) ─────────────────────────────── */}
      <div className="no-print bg-slate-50 dark:bg-slate-950 min-h-screen">
        <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center gap-4 flex-wrap">
            <button onClick={() => router.push(`/projetos/${id}`)}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-bold transition-colors">
              <ArrowLeft size={13}/> Voltar
            </button>
            <div className="flex-1">
              <h1 className="font-black text-sm text-slate-800 dark:text-slate-100">{projeto.nome} — Pulseiras</h1>
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
              <input type="number" min={20} max={200} value={largura} onChange={e => setLargura(+e.target.value)}
                className="w-14 text-center text-xs font-bold border border-slate-200 dark:border-slate-600 rounded-lg px-1 py-1 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-400" />
              <span className="text-slate-400 text-xs">×</span>
              <input type="number" min={10} max={100} value={altura} onChange={e => setAltura(+e.target.value)}
                className="w-14 text-center text-xs font-bold border border-slate-200 dark:border-slate-600 rounded-lg px-1 py-1 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-400" />
              <button onClick={salvarDimensoes} disabled={salvandoDims}
                className="text-[10px] font-black uppercase text-purple-600 hover:text-purple-800 disabled:opacity-50">
                {salvandoDims ? <RefreshCw size={11} className="animate-spin"/> : 'Salvar'}
              </button>
            </div>

            <button onClick={() => window.print()}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl font-black text-xs uppercase transition-colors">
              <Printer size={13}/> Imprimir ({inscritosFiltrados.length})
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="max-w-6xl mx-auto p-6">
          {inscritosFiltrados.length === 0 && (
            <div className="py-16 text-center text-slate-400 text-sm">Nenhum inscrito para imprimir.</div>
          )}
          <div className="preview-grid flex flex-wrap gap-4 justify-start">
            {inscritosFiltrados.map(ins => {
              const eq = equipes.find(e => e.id === ins.equipe_id);
              return (
                <div key={ins.id} className="shadow-sm hover:shadow-md transition-shadow">
                  <Pulseira ins={ins} equipe={eq} largura={largura} altura={altura} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Área de impressão ────────────────────────────────────────────── */}
      <div className="print-only">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3mm', padding: '5mm' }}>
          {inscritosFiltrados.map(ins => {
            const eq = equipes.find(e => e.id === ins.equipe_id);
            return <Pulseira key={ins.id} ins={ins} equipe={eq} largura={largura} altura={altura} />;
          })}
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { margin: 0; }
          @page { margin: 5mm; size: auto; }
        }
        @media screen {
          .print-only { display: none; }
        }
      `}</style>
    </>
  );
}
