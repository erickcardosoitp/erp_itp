'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer, RefreshCw, Upload, X } from 'lucide-react';
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

function calcIdade(dob?: string) {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob.slice(0, 10) + 'T12:00:00').getTime();
  const age = Math.floor(diff / (365.25 * 24 * 3600 * 1000));
  return isNaN(age) ? null : age;
}

// Posições do conteúdo sobre o template (% do total width/height)
// Ajuste aqui se o template tiver layout diferente
const TPL = {
  foto:  { top: 37, left: 18, w: 64, h: 33 },   // área da foto
  row1:  { top: 72, left: 5,  h: 7  },            // nome | telefone
  row1r: { left: 52, w: 44 },                     // coluna direita do row1
  row1l: { w: 44 },                               // coluna esquerda do row1
  row2:  { top: 80, left: 5, right: 5, h: 5.5 }, // endereço
  row3:  { top: 86.5, left: 5, right: 5, h: 5.5 }, // cuidados
  row4:  { top: 93, left: 5, right: 5, h: 5.5 }, // equipe (texto)
};

// ── Crachá com template PNG ────────────────────────────────────────────────
function CrachaComTemplate({ ins, equipe, largura, altura }: {
  ins: Inscricao; equipe: Equipe; largura: number; altura: number;
}) {
  const idade = calcIdade(ins.data_nascimento);
  const temCuidado = ins.cuidado_especial && ins.cuidado_especial !== 'Não';
  const nomeLen = ins.nome_completo.length;
  const fSize = Math.max(4, 6.5 - Math.max(0, nomeLen - 16) * 0.15);
  const infoSize = Math.max(3.5, fSize - 1);

  const abs = (t: number, l?: number, r?: number, w?: number, h?: number): React.CSSProperties => ({
    position: 'absolute',
    top: `${t}%`,
    ...(l !== undefined ? { left: `${l}%` } : {}),
    ...(r !== undefined ? { right: `${r}%` } : {}),
    ...(w !== undefined ? { width: `${w}%` } : {}),
    ...(h !== undefined ? { height: `${h}%` } : {}),
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
  });

  return (
    <div className="cracha-item" style={{
      width: `${largura}mm`, height: `${altura}mm`,
      position: 'relative', overflow: 'hidden',
      backgroundImage: `url(${equipe.imagem_template})`,
      backgroundSize: '100% 100%',
      pageBreakInside: 'avoid', breakInside: 'avoid',
      fontFamily: 'Arial, sans-serif',
    }}>
      {/* Foto */}
      <div style={{ ...abs(TPL.foto.top, TPL.foto.left, undefined, TPL.foto.w, TPL.foto.h), alignItems: 'stretch' }}>
        {ins.foto_url ? (
          <img src={ins.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: equipe.cor + '33',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: `${Math.max(8, largura * 0.2)}pt`, fontWeight: 900, color: equipe.cor,
          }}>
            {ins.nome_completo.trim().split(/\s+/).slice(0, 2).map(n => n[0]).join('')}
          </div>
        )}
      </div>

      {/* Row 1 esquerda: Nome | Idade */}
      <div style={{ ...abs(TPL.row1.top, TPL.row1.left, undefined, TPL.row1l.w, TPL.row1.h) }}>
        <span style={{ fontWeight: 900, fontSize: `${fSize}pt`, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
          {ins.nome_completo}{idade !== null ? ` | ${idade}a` : ''}
        </span>
      </div>

      {/* Row 1 direita: Telefone */}
      {ins.telefone_responsavel && (
        <div style={{ ...abs(TPL.row1.top, TPL.row1r.left, undefined, TPL.row1r.w, TPL.row1.h) }}>
          <span style={{ fontSize: `${infoSize}pt`, color: '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
            {ins.telefone_responsavel}
          </span>
        </div>
      )}

      {/* Row 2: Endereço */}
      <div style={{ ...abs(TPL.row2.top, TPL.row2.left, TPL.row2.right, undefined, TPL.row2.h) }}>
        <span style={{ fontSize: `${infoSize}pt`, color: '#444', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
          {ins.endereco || ''}
        </span>
      </div>

      {/* Row 3: Cuidados */}
      <div style={{ ...abs(TPL.row3.top, TPL.row3.left, TPL.row3.right, undefined, TPL.row3.h) }}>
        <span style={{ fontSize: `${infoSize}pt`, color: temCuidado ? '#dc2626' : '#888', fontWeight: temCuidado ? 700 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
          {temCuidado ? `⚠ ${ins.cuidado_especial}${ins.detalhes_cuidado ? `: ${ins.detalhes_cuidado}` : ''}` : ''}
        </span>
      </div>

      {/* Row 4: Equipe */}
      <div style={{ ...abs(TPL.row4.top, TPL.row4.left, TPL.row4.right, undefined, TPL.row4.h) }}>
        <span style={{ fontSize: `${infoSize}pt`, fontWeight: 700, color: equipe.cor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
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
  const temCuidado = ins.cuidado_especial && ins.cuidado_especial !== 'Não';
  const cor = equipe?.cor ?? '#7c3aed';
  const nomeLen = ins.nome_completo.length;
  const fSize = Math.max(5, 7.5 - Math.max(0, nomeLen - 16) * 0.15);
  const infoSize = Math.max(4, fSize - 1.2);
  const barH = Math.max(5, altura * 0.1);

  // Foto: max 42% da altura e 85% da largura
  const fotoMm = Math.min(Math.round(largura * 0.85), Math.round(altura * 0.42));
  const initials = ins.nome_completo.trim().split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase();

  return (
    <div className="cracha-item" style={{
      width: `${largura}mm`, height: `${altura}mm`,
      border: `0.5mm solid ${cor}`,
      borderRadius: '2mm', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      boxSizing: 'border-box', background: 'white',
      pageBreakInside: 'avoid', breakInside: 'avoid',
      fontFamily: 'Arial, sans-serif',
    }}>
      {/* Barra topo */}
      <div style={{ background: cor, height: '3.5mm', flexShrink: 0 }} />

      {/* Foto centralizada */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5mm 1mm 1mm', flexShrink: 0 }}>
        {ins.foto_url ? (
          <img src={ins.foto_url} alt="" style={{
            width: `${fotoMm}mm`, height: `${fotoMm}mm`,
            objectFit: 'cover', borderRadius: '1mm',
            border: `0.3mm solid ${cor}`, display: 'block',
          }} />
        ) : (
          <div style={{
            width: `${fotoMm}mm`, height: `${fotoMm}mm`,
            borderRadius: '1mm', background: cor + '22',
            border: `0.3mm solid ${cor}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: cor, fontWeight: 900,
            fontSize: `${Math.round(fotoMm * 1.5)}pt`,
          }}>
            {initials}
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, padding: '0 1.5mm', display: 'flex', flexDirection: 'column', gap: '0.5mm', overflow: 'hidden', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1mm' }}>
          <span style={{ flex: 1, fontWeight: 900, fontSize: `${fSize}pt`, color: '#111', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {ins.nome_completo}{idade !== null ? ` | ${idade}a` : ''}
          </span>
          {ins.telefone_responsavel && (
            <span style={{ fontSize: `${infoSize}pt`, color: '#555', lineHeight: 1.2, whiteSpace: 'nowrap', flexShrink: 0 }}>
              {ins.telefone_responsavel}
            </span>
          )}
        </div>
        <div style={{ fontSize: `${infoSize}pt`, color: '#666', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {ins.endereco || '—'}
        </div>
        <div style={{ fontSize: `${infoSize}pt`, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: temCuidado ? '#dc2626' : '#bbb', fontWeight: temCuidado ? 700 : 400 }}>
          {temCuidado ? `⚠ ${ins.cuidado_especial}${ins.detalhes_cuidado ? `: ${ins.detalhes_cuidado}` : ''}` : 'Sem cuidados especiais'}
        </div>
      </div>

      {/* Barra equipe */}
      <div style={{
        background: cor, color: 'white', textAlign: 'center',
        fontWeight: 900, height: `${barH}mm`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: `${Math.max(4.5, barH * 0.55)}pt`,
        letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0,
      }}>
        {equipe?.nome ?? '—'}
      </div>
    </div>
  );
}

// ── Componente unificado ───────────────────────────────────────────────────
function Cracha(props: { ins: Inscricao; equipe?: Equipe; largura: number; altura: number }) {
  const { equipe } = props;
  if (equipe?.imagem_template) return <CrachaComTemplate {...props} equipe={equipe} />;
  return <CrachaLimpo {...props} />;
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

            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-1.5">
              <span className="text-[10px] font-black uppercase text-slate-500">mm</span>
              <input type="number" min={30} max={120} value={largura} onChange={e => setLargura(+e.target.value)}
                title="Largura (mm)"
                className="w-12 text-center text-xs font-bold border border-slate-200 dark:border-slate-600 rounded-lg px-1 py-1 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-400" />
              <span className="text-slate-400 text-xs">×</span>
              <input type="number" min={40} max={200} value={altura} onChange={e => setAltura(+e.target.value)}
                title="Altura (mm)"
                className="w-12 text-center text-xs font-bold border border-slate-200 dark:border-slate-600 rounded-lg px-1 py-1 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-400" />
              <button onClick={salvarDimensoes} disabled={salvandoDims}
                className="text-[10px] font-black uppercase text-purple-600 hover:text-purple-800 disabled:opacity-50">
                {salvandoDims ? <RefreshCw size={11} className="animate-spin" /> : 'Salvar'}
              </button>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-1.5">
              <span className="text-[10px] font-black uppercase text-slate-500">colunas</span>
              {[2, 3, 4, 5, 6].map(n => (
                <button key={n} onClick={() => setColunas(n)}
                  className={`text-xs font-bold w-6 h-6 rounded-lg transition-colors ${colunas === n ? 'bg-purple-600 text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}>
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

        {/* Templates por equipe */}
        {equipes.length > 0 && (
          <div className="max-w-6xl mx-auto px-6 pt-5">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Templates por equipe</p>
            <div className="flex flex-wrap gap-3">
              {equipes.map(eq => (
                <div key={eq.id} className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: eq.cor }} />
                  <span className="font-bold text-slate-700 dark:text-slate-200">{eq.nome}</span>
                  {eq.imagem_template ? (
                    <>
                      <span className="text-emerald-500 font-bold">✓ template</span>
                      <button onClick={() => removerTemplate(eq.id)}
                        className="text-red-400 hover:text-red-600 ml-1">
                        <X size={11} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-slate-400">sem template</span>
                      <button onClick={() => fileRefs.current[eq.id]?.click()}
                        disabled={uploadingEq === eq.id}
                        className="flex items-center gap-1 text-purple-600 hover:text-purple-800 font-bold disabled:opacity-50">
                        {uploadingEq === eq.id ? <RefreshCw size={10} className="animate-spin" /> : <Upload size={10} />}
                        Enviar PNG
                      </button>
                    </>
                  )}
                  <input
                    ref={el => { fileRefs.current[eq.id] = el; }}
                    type="file" accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadTemplate(eq.id, f); e.target.value = ''; }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

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
          .print-only { position: absolute; top: 0; left: 0; }
          .cracha-item * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page { margin: 5mm; size: auto; }
        }
        @media screen { .print-only { display: none; } }
      `}</style>
    </>
  );
}
