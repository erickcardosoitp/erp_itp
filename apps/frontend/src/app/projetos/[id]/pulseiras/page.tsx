'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer, RefreshCw, Upload, X, Settings2 } from 'lucide-react';
import api from '@/services/api';

interface Equipe {
  id: string; nome: string; cor: string;
  imagem_template?: string | null;
}
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

interface TplPos {
  fotoTop: number; fotoLeft: number; fotoW: number; fotoH: number;
  row1Top: number; row1H: number;
  row2Top: number; row2H: number;
  row3Top: number; row3H: number;
  row4Top: number; row4H: number;
  colEsqW: number; colDirLeft: number; colDirW: number;
  padLR: number;
}

const DEFAULT_POS: TplPos = {
  fotoTop: 37, fotoLeft: 13, fotoW: 74, fotoH: 30,
  row1Top: 69, row1H: 9,
  row2Top: 79, row2H: 8,
  row3Top: 88, row3H: 7,
  row4Top: 95, row4H: 5,
  colEsqW: 54, colDirLeft: 62, colDirW: 35,
  padLR: 2,
};

// Presets: [label, largura, altura, colunas]
const PRESETS: [string, number, number, number][] = [
  ['5×5 A4', 38, 55, 5],
  ['4×5 A4', 48, 55, 4],
  ['3×4 A4', 64, 70, 3],
];

function calcIdade(dob?: string) {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob.slice(0, 10) + 'T12:00:00').getTime();
  const age = Math.floor(diff / (365.25 * 24 * 3600 * 1000));
  return isNaN(age) ? null : age;
}

// ── Crachá com template PNG ────────────────────────────────────────────────
function CrachaComTemplate({ ins, equipe, largura, altura, pos }: {
  ins: Inscricao; equipe: Equipe; largura: number; altura: number; pos: TplPos;
}) {
  const idade = calcIdade(ins.data_nascimento);
  const temCuidado = !!(ins.cuidado_especial && ins.cuidado_especial !== 'Não' && ins.cuidado_especial !== 'Nao');
  const detalhe = ins.detalhes_cuidado && ins.detalhes_cuidado !== 'Nao' && ins.detalhes_cuidado !== 'Não' ? ins.detalhes_cuidado : null;

  // Font proporcional à LARGURA da coluna disponível × chars do nome
  // Técnica padrão de badge printing: cálculo de fit automático
  const colEsqMm = largura * (pos.colEsqW / 100) - largura * (pos.padLR / 100) * 2;
  const nomeIdade = ins.nome_completo + (idade !== null ? ` | ${idade}a` : '');
  // Assume ~0.58 de largura por caractere em relação ao tamanho da fonte (Arial caps)
  // Clamp: mín 1.8mm (legível), máx 3mm (não transborda célula)
  const fSizeMm = Math.max(1.6, Math.min(2.2, (colEsqMm * 0.58) / Math.max(nomeIdade.length, 1)));
  const infoSizeMm = Math.max(1.5, largura * 0.034);

  const cell = (top: number, left: number | undefined, right: number | undefined, w: number | undefined, h: number, wrap = false): React.CSSProperties => ({
    position: 'absolute',
    top: `${top}%`,
    ...(left !== undefined ? { left: `${left}%` } : {}),
    ...(right !== undefined ? { right: `${right}%` } : {}),
    ...(w !== undefined ? { width: `${w}%` } : {}),
    height: `${h}%`,
    overflow: 'hidden',
    display: 'flex',
    alignItems: wrap ? 'flex-start' : 'center',
    padding: `${wrap ? '1%' : '0'} ${pos.padLR / 2}%`,
    boxSizing: 'border-box',
  });

  const txtStyle = (sizeMm: number, bold = false, col = '#1a1a1a'): React.CSSProperties => ({
    fontSize: `${sizeMm}mm`,
    fontWeight: bold ? 900 : 400,
    color: col,
    lineHeight: 1.15,
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  });

  return (
    <div className="cracha-item" style={{
      width: `${largura}mm`, height: `${altura}mm`,
      position: 'relative', overflow: 'hidden',
      pageBreakInside: 'avoid', breakInside: 'avoid',
      fontFamily: 'Arial, sans-serif',
    }}>
      {/* Template PNG — img tag = melhor qualidade que background-image */}
      <img src={equipe.imagem_template!} alt="" style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        objectFit: 'fill', display: 'block',
        imageRendering: 'high-quality' as React.CSSProperties['imageRendering'],
      }} />

      {/* Foto */}
      <div style={{
        position: 'absolute',
        top: `${pos.fotoTop}%`, left: `${pos.fotoLeft}%`,
        width: `${pos.fotoW}%`, height: `${pos.fotoH}%`,
        overflow: 'hidden',
      }}>
        {ins.foto_url ? (
          <img src={ins.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 25%', display: 'block' }} />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: equipe.cor + '22',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: `${altura * pos.fotoH / 100 * 0.35}mm`, fontWeight: 900, color: equipe.cor,
          }}>
            {ins.nome_completo.trim().split(/\s+/).slice(0, 2).map(n => n[0]).join('')}
          </div>
        )}
      </div>

      {/* Row 1 esq: Nome | Idade — até 2 linhas para nomes longos */}
      <div style={{ ...cell(pos.row1Top, pos.padLR, undefined, pos.colEsqW, pos.row1H), alignItems: 'center' }}>
        <span style={{
          ...txtStyle(fSizeMm, true),
          whiteSpace: 'normal',
          wordBreak: 'break-word',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          lineHeight: 1.1,
        }}>
          {nomeIdade}
        </span>
      </div>

      {/* Row 1 dir: Telefone */}
      <div style={cell(pos.row1Top, pos.colDirLeft, undefined, pos.colDirW, pos.row1H)}>
        <span style={txtStyle(infoSizeMm)}>
          {ins.telefone_responsavel ?? ''}
        </span>
      </div>

      {/* Row 2: Endereço */}
      <div style={cell(pos.row2Top, pos.padLR, undefined, 100 - pos.padLR * 2, pos.row2H)}>
        <span style={txtStyle(infoSizeMm)}>
          {ins.endereco ?? ''}
        </span>
      </div>

      {/* Row 3: Cuidados */}
      <div style={cell(pos.row3Top, pos.padLR, undefined, 100 - pos.padLR * 2, pos.row3H)}>
        <span style={txtStyle(infoSizeMm, temCuidado, temCuidado ? '#cc0000' : '#999')}>
          {temCuidado ? `⚠ ${ins.cuidado_especial}${detalhe ? `: ${detalhe}` : ''}` : ''}
        </span>
      </div>

      {/* Row 4: Equipe */}
      <div style={cell(pos.row4Top, pos.padLR, undefined, 100 - pos.padLR * 2, pos.row4H)}>
        <span style={txtStyle(infoSizeMm, true, equipe.cor)}>
          {equipe.nome}
        </span>
      </div>
    </div>
  );
}

// ── Crachá limpo (sem template) ────────────────────────────────────────────
function CrachaLimpo({ ins, equipe, largura, altura }: {
  ins: Inscricao; equipe?: Equipe; largura: number; altura: number;
}) {
  const idade = calcIdade(ins.data_nascimento);
  const temCuidado = !!(ins.cuidado_especial && ins.cuidado_especial !== 'Não' && ins.cuidado_especial !== 'Nao');
  const detalhe = ins.detalhes_cuidado && ins.detalhes_cuidado !== 'Nao' && ins.detalhes_cuidado !== 'Não' ? ins.detalhes_cuidado : null;
  const cor = equipe?.cor ?? '#7c3aed';
  const nomeLen = ins.nome_completo.length;
  const fSizeMm = Math.max(1.6, (altura * 0.036) - Math.max(0, nomeLen - 18) * 0.04);
  const infoSizeMm = Math.max(1.3, fSizeMm * 0.8);
  const barH = Math.max(4, altura * 0.08);
  const fotoMm = Math.min(Math.round(largura * 0.85), Math.round(altura * 0.42));
  const initials = ins.nome_completo.trim().split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase();

  return (
    <div className="cracha-item" style={{
      width: `${largura}mm`, height: `${altura}mm`,
      border: `0.5mm solid ${cor}`, borderRadius: '2mm', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      boxSizing: 'border-box', background: 'white',
      pageBreakInside: 'avoid', breakInside: 'avoid',
      fontFamily: 'Arial, sans-serif',
    }}>
      <div style={{ background: cor, height: '3.5mm', flexShrink: 0 }} />
      <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5mm 1mm 1mm', flexShrink: 0 }}>
        {ins.foto_url ? (
          <img src={ins.foto_url} alt="" style={{ width: `${fotoMm}mm`, height: `${fotoMm}mm`, objectFit: 'cover', borderRadius: '1mm', border: `0.3mm solid ${cor}`, display: 'block' }} />
        ) : (
          <div style={{ width: `${fotoMm}mm`, height: `${fotoMm}mm`, borderRadius: '1mm', background: cor + '22', border: `0.3mm solid ${cor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cor, fontWeight: 900, fontSize: `${Math.round(fotoMm * 1.5)}pt` }}>
            {initials}
          </div>
        )}
      </div>
      <div style={{ flex: 1, padding: '0 1.5mm', display: 'flex', flexDirection: 'column', gap: '0.5mm', overflow: 'hidden', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1mm' }}>
          <span style={{ flex: 1, fontWeight: 900, fontSize: `${fSizeMm}mm`, color: '#111', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {ins.nome_completo}{idade !== null ? ` | ${idade}a` : ''}
          </span>
          {ins.telefone_responsavel && (
            <span style={{ fontSize: `${infoSizeMm}mm`, color: '#555', lineHeight: 1.2, whiteSpace: 'nowrap', flexShrink: 0 }}>{ins.telefone_responsavel}</span>
          )}
        </div>
        <div style={{ fontSize: `${infoSizeMm}mm`, color: '#666', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ins.endereco || '—'}</div>
        <div style={{ fontSize: `${infoSizeMm}mm`, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: temCuidado ? '#dc2626' : '#bbb', fontWeight: temCuidado ? 700 : 400 }}>
          {temCuidado ? `⚠ ${ins.cuidado_especial}${detalhe ? `: ${detalhe}` : ''}` : 'Sem cuidados especiais'}
        </div>
      </div>
      <div style={{ background: cor, color: 'white', textAlign: 'center', fontWeight: 900, height: `${barH}mm`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: `${Math.max(1.4, barH * 0.45)}mm`, letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>
        {equipe?.nome ?? '—'}
      </div>
    </div>
  );
}

function Cracha(props: { ins: Inscricao; equipe?: Equipe; largura: number; altura: number; pos: TplPos }) {
  const { equipe, pos, ...rest } = props;
  if (equipe?.imagem_template) return <CrachaComTemplate {...rest} equipe={equipe} pos={pos} />;
  return <CrachaLimpo {...rest} equipe={equipe} />;
}

// ── Slider de calibração ───────────────────────────────────────────────────
function PosSlider({ label, field, pos, setPos, min = 0, max = 100, step = 0.5 }: {
  label: string; field: keyof TplPos; pos: TplPos; setPos: (p: TplPos) => void;
  min?: number; max?: number; step?: number;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-28 text-slate-500 text-[10px] shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={pos[field]}
        onChange={e => setPos({ ...pos, [field]: +e.target.value })}
        className="flex-1 accent-purple-600 h-1" />
      <span className="w-8 text-right font-mono text-slate-700 dark:text-slate-300 text-[10px]">{pos[field]}</span>
    </div>
  );
}

// ── Página ─────────────────────────────────────────────────────────────────
export default function CrachasPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [projeto, setProjeto] = useState<Projeto | null>(null);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [inscritos, setInscritos] = useState<Inscricao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEquipe, setFiltroEquipe] = useState('');
  const [largura, setLargura] = useState(54);
  const [altura, setAltura] = useState(85);
  const [colunas, setColunas] = useState(4);
  const [salvandoDims, setSalvandoDims] = useState(false);
  const [uploadingEq, setUploadingEq] = useState<string | null>(null);
  const [showCalib, setShowCalib] = useState(false);
  const [pos, setPos] = useState<TplPos>(DEFAULT_POS);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

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
      setLargura(rp.data.pulseira_largura_mm ?? 54);
      setAltura(rp.data.pulseira_altura_mm ?? 85);
    } catch {}
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const salvarDimensoes = async () => {
    setSalvandoDims(true);
    try { await api.patch(`/projetos/${id}`, { pulseira_largura_mm: largura, pulseira_altura_mm: altura }); }
    finally { setSalvandoDims(false); }
  };

  const uploadTemplate = async (eqId: string, file: File) => {
    setUploadingEq(eqId);
    try {
      const fd = new FormData();
      fd.append('arquivo', file);
      const r = await api.post(`/projetos/${id}/equipes/${eqId}/template`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setEquipes(prev => prev.map(e => e.id === eqId ? { ...e, imagem_template: r.data.imagem_template } : e));
    } catch {}
    finally { setUploadingEq(null); }
  };

  const removerTemplate = async (eqId: string) => {
    try {
      await api.patch(`/projetos/${id}/equipes/${eqId}`, { imagem_template: null });
      setEquipes(prev => prev.map(e => e.id === eqId ? { ...e, imagem_template: null } : e));
    } catch {}
  };

  const inscritosFiltrados = inscritos.filter(i => !filtroEquipe || i.equipe_id === filtroEquipe);

  if (loading) return <div className="flex items-center justify-center min-h-screen text-slate-400">Carregando...</div>;
  if (!projeto) return null;

  const temTemplate = equipes.some(e => e.imagem_template);
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${colunas}, ${largura}mm)`,
    gap: '2mm',
    padding: '5mm',
  };

  return (
    <>
      <div className="no-print bg-slate-50 dark:bg-slate-950 min-h-screen">

        {/* Barra principal */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center gap-3 flex-wrap">
            <button onClick={() => router.push(`/projetos/${id}`)}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-bold transition-colors">
              <ArrowLeft size={13} /> Voltar
            </button>
            <div className="flex-1">
              <h1 className="font-black text-sm text-slate-800 dark:text-slate-100">{projeto.nome} — Crachás</h1>
            </div>

            <select value={filtroEquipe} onChange={e => setFiltroEquipe(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400 text-slate-600 dark:text-slate-300">
              <option value="">Todas ({inscritos.length})</option>
              {equipes.map(e => (
                <option key={e.id} value={e.id}>{e.nome} ({inscritos.filter(i => i.equipe_id === e.id).length})</option>
              ))}
            </select>

            {/* Presets */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl px-2 py-1.5">
              <span className="text-[10px] font-black uppercase text-slate-500 mr-1">preset</span>
              {PRESETS.map(([label, w, h, c]) => (
                <button key={label} onClick={() => { setLargura(w); setAltura(h); setColunas(c); }}
                  className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-colors ${largura === w && altura === h && colunas === c ? 'bg-purple-600 text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Dimensões */}
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-1.5">
              <span className="text-[10px] font-black uppercase text-slate-500">mm</span>
              <input type="number" min={30} max={150} value={largura} onChange={e => setLargura(+e.target.value)} title="Largura"
                className="w-12 text-center text-xs font-bold border border-slate-200 dark:border-slate-600 rounded-lg px-1 py-1 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-400" />
              <span className="text-slate-400 text-xs">×</span>
              <input type="number" min={40} max={250} value={altura} onChange={e => setAltura(+e.target.value)} title="Altura"
                className="w-12 text-center text-xs font-bold border border-slate-200 dark:border-slate-600 rounded-lg px-1 py-1 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-400" />
              <button onClick={salvarDimensoes} disabled={salvandoDims}
                className="text-[10px] font-black uppercase text-purple-600 hover:text-purple-800 disabled:opacity-50">
                {salvandoDims ? <RefreshCw size={11} className="animate-spin" /> : 'Salvar'}
              </button>
            </div>

            {/* Colunas */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-1.5">
              <span className="text-[10px] font-black uppercase text-slate-500">cols</span>
              {[2, 3, 4, 5, 6].map(n => (
                <button key={n} onClick={() => setColunas(n)}
                  className={`text-xs font-bold w-6 h-6 rounded-lg transition-colors ${colunas === n ? 'bg-purple-600 text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}>
                  {n}
                </button>
              ))}
            </div>

            {temTemplate && (
              <button onClick={() => setShowCalib(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${showCalib ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-amber-50'}`}>
                <Settings2 size={12} /> Calibrar posições
              </button>
            )}

            <button onClick={() => window.print()}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl font-black text-xs uppercase transition-colors">
              <Printer size={13} /> Imprimir ({inscritosFiltrados.length})
            </button>
          </div>
        </div>

        {/* Painel de calibração */}
        {showCalib && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-6 py-4">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                  Calibrar posições do template (% da largura/altura do crachá)
                </p>
                <button onClick={() => setPos(DEFAULT_POS)} className="text-[10px] font-bold text-amber-600 hover:text-amber-800 underline">
                  Resetar padrão
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-1.5">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Foto</p>
                  <PosSlider label="Topo foto %" field="fotoTop" pos={pos} setPos={setPos} />
                  <PosSlider label="Esquerda foto %" field="fotoLeft" pos={pos} setPos={setPos} />
                  <PosSlider label="Largura foto %" field="fotoW" pos={pos} setPos={setPos} />
                  <PosSlider label="Altura foto %" field="fotoH" pos={pos} setPos={setPos} />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Linhas (topo %)</p>
                  <PosSlider label="Linha 1 topo" field="row1Top" pos={pos} setPos={setPos} />
                  <PosSlider label="Linha 1 altura" field="row1H" pos={pos} setPos={setPos} min={2} max={15} />
                  <PosSlider label="Linha 2 topo" field="row2Top" pos={pos} setPos={setPos} />
                  <PosSlider label="Linha 2 altura" field="row2H" pos={pos} setPos={setPos} min={2} max={15} />
                  <PosSlider label="Linha 3 topo" field="row3Top" pos={pos} setPos={setPos} />
                  <PosSlider label="Linha 4 topo" field="row4Top" pos={pos} setPos={setPos} />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Colunas linha 1</p>
                  <PosSlider label="Col. esq. largura" field="colEsqW" pos={pos} setPos={setPos} />
                  <PosSlider label="Col. dir. esquerda" field="colDirLeft" pos={pos} setPos={setPos} />
                  <PosSlider label="Col. dir. largura" field="colDirW" pos={pos} setPos={setPos} />
                  <PosSlider label="Padding lateral" field="padLR" pos={pos} setPos={setPos} min={0} max={15} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Templates por equipe */}
        <div className="max-w-6xl mx-auto px-6 pt-4">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Templates por equipe</p>
          <div className="flex flex-wrap gap-2">
            {equipes.map(eq => (
              <div key={eq.id} className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: eq.cor }} />
                <span className="font-bold text-slate-700 dark:text-slate-200">{eq.nome}</span>
                {eq.imagem_template ? (
                  <>
                    <span className="text-emerald-500 font-bold">✓ template</span>
                    <button onClick={() => removerTemplate(eq.id)} className="text-red-400 hover:text-red-600"><X size={11} /></button>
                  </>
                ) : (
                  <>
                    <span className="text-slate-400">sem template</span>
                    <button onClick={() => fileRefs.current[eq.id]?.click()} disabled={uploadingEq === eq.id}
                      className="flex items-center gap-1 text-purple-600 hover:text-purple-800 font-bold disabled:opacity-50">
                      {uploadingEq === eq.id ? <RefreshCw size={10} className="animate-spin" /> : <Upload size={10} />}
                      PNG
                    </button>
                  </>
                )}
                <input ref={el => { fileRefs.current[eq.id] = el; }} type="file" accept="image/png,image/jpeg,image/webp"
                  className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadTemplate(eq.id, f); e.target.value = ''; }} />
              </div>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="max-w-6xl mx-auto p-6">
          {inscritosFiltrados.length === 0 && (
            <div className="py-16 text-center text-slate-400 text-sm">Nenhum inscrito para imprimir.</div>
          )}
          <div style={{ ...gridStyle, gridTemplateColumns: `repeat(auto-fill, ${Math.round(largura * 3.78)}px)` }}>
            {inscritosFiltrados.map(ins => {
              const eq = equipes.find(e => e.id === ins.equipe_id);
              return (
                <div key={ins.id} className="shadow-sm hover:shadow-md transition-shadow rounded">
                  <Cracha ins={ins} equipe={eq} largura={largura} altura={altura} pos={pos} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Impressão */}
      <div className="print-only">
        <div style={gridStyle}>
          {inscritosFiltrados.map(ins => {
            const eq = equipes.find(e => e.id === ins.equipe_id);
            return <Cracha key={ins.id} ins={ins} equipe={eq} largura={largura} altura={altura} pos={pos} />;
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
          .print-only { position: absolute; top: 0; left: 0; }
          .cracha-item * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { margin: 5mm; size: auto; }
        }
        @media screen { .print-only { display: none; } }
      `}</style>
    </>
  );
}
