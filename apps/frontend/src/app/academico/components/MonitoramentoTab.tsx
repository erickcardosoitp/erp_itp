'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Activity, Users, TrendingUp, TrendingDown, ClipboardCheck, History,
  ShieldCheck, AlertTriangle, RefreshCw, MapPin, Star, Clock, Zap,
} from 'lucide-react';
import api from '@/services/api';

// ─── Local interfaces ─────────────────────────────────────────────────────────

interface AlunoMapa { id: string; nome: string; foto_url: string | null; }
interface EnderecoGrupo {
  logradouro: string; bairro: string; cidade: string; cep?: string; tem_cep?: boolean;
  total: number; alunos: AlunoMapa[];
}

// ─── MapaLeaflet ──────────────────────────────────────────────────────────────

function MapaLeaflet({ enderecos, totalAlunos }: { enderecos: EnderecoGrupo[]; totalAlunos?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const [geocodedCount, setGeocodedCount] = useState(0);
  const totalToGeocode = enderecos.length;
  const alunosNoMapa   = enderecos.reduce((s, e) => s + (e.total || 0), 0);
  const semEndereco    = totalAlunos != null ? Math.max(0, totalAlunos - alunosNoMapa) : 0;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    if (!document.querySelector('#leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css'; link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (!document.querySelector('#itp-map-css')) {
      const s = document.createElement('style'); s.id = 'itp-map-css';
      s.innerHTML = `
        .itp-label { background:#7c3aed;color:#fff;font-size:11px;font-weight:900;
          padding:2px 7px;border-radius:20px;white-space:nowrap;
          box-shadow:0 2px 6px rgba(124,58,237,.4);border:1.5px solid #5b21b6;pointer-events:none; }
        .itp-popup .leaflet-popup-content-wrapper { border-radius:12px;padding:0;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.15); }
        .itp-popup .leaflet-popup-content { margin:0; }
        .itp-popup .leaflet-popup-tip-container { display:none; }
        .itp-av { width:38px;height:38px;border-radius:50%;object-fit:cover;border:2px solid #e2e8f0;flex-shrink:0; }
        .itp-ini { width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#4f46e5);
          display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:900;flex-shrink:0; }
      `;
      document.head.appendChild(s);
    }

    import('leaflet').then((L: any) => {
      delete L.Icon.Default.prototype._getIconUrl;

      const map = L.map(containerRef.current!, { center: [-22.8783, -43.3364], zoom: 14 });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors', maxZoom: 19,
      }).addTo(map);
      mapRef.current = { map, L };

      const CACHE_KEY = 'itp_geo_v4';
      let cache: Record<string, any> = {};
      try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch {}
      const saveCache = () => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {} };

      const API_BASE = (typeof window !== 'undefined' ? (window as any).__NEXT_PUBLIC_API_BASE_URL : '') || '';

      const buildPopupHtml = (e: EnderecoGrupo) => {
        const lista = (e.alunos || []).slice(0, 8);
        const resto = (e.alunos || []).slice(8);
        const avatares = lista.map(a => {
          const src = a.foto_url ? (a.foto_url.startsWith('http') ? a.foto_url : `${API_BASE}${a.foto_url}`) : null;
          const ini = (a.nome || '?').trim()[0].toUpperCase();
          return src
            ? `<img class="itp-av" src="${src}" alt="${a.nome}" title="${a.nome}" onerror="this.outerHTML='<div class=itp-ini title=\'${a.nome}\'>${ini}</div>'">`
            : `<div class="itp-ini" title="${a.nome}">${ini}</div>`;
        }).join('');
        return `
          <div style="font-family:system-ui,sans-serif;padding:14px 16px;min-width:200px;max-width:280px">
            <div style="font-size:12px;font-weight:900;color:#1e293b;margin-bottom:2px">${e.logradouro || e.bairro}</div>
            <div style="font-size:10px;color:#64748b;margin-bottom:10px">${e.bairro}${e.cidade !== 'Rio de Janeiro' ? ' · ' + e.cidade : ''}</div>
            <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px">${avatares}</div>
            ${resto.length ? `<div style="font-size:9px;color:#94a3b8;margin-top:4px">+${resto.length} mais: ${resto.map(a => a.nome.split(' ')[0]).join(', ')}</div>` : ''}
            <div style="margin-top:8px;padding-top:6px;border-top:1px solid #f1f5f9;font-size:11px;font-weight:900;color:#7c3aed">${e.total} aluno${e.total > 1 ? 's' : ''} nesta rua</div>
          </div>`;
      };

      const midOfLine = (coords: any[]): [number, number] => {
        const pts: [number,number][] = [];
        const collect = (c: any) => {
          if (typeof c[0] === 'number') pts.push(c as [number,number]);
          else c.forEach(collect);
        };
        coords.forEach(collect);
        const mid = pts[Math.floor(pts.length / 2)] || [0, 0];
        return [mid[1], mid[0]];
      };

      const drawLine = (e: EnderecoGrupo, geom: any) => {
        const weight = 5 + Math.min(e.total - 1, 8);
        const popup  = L.popup({ className: 'itp-popup', closeButton: true, autoPan: true }).setContent(buildPopupHtml(e));
        const layer  = L.geoJSON(geom, {
          style: { color: '#7c3aed', weight, opacity: 0.75, lineCap: 'round', lineJoin: 'round' },
        }).addTo(map);

        layer.on('mouseover', (ev: any) => {
          layer.setStyle({ color: '#4f46e5', weight: weight + 3 });
          popup.setLatLng(ev.latlng).openOn(map);
        });
        layer.on('mouseout', () => { layer.setStyle({ color: '#7c3aed', weight }); map.closePopup(); });
        layer.on('click',     (ev: any) => { popup.setLatLng(ev.latlng).openOn(map); });

        const coords = geom.type === 'MultiLineString' ? geom.coordinates.flat(1) : geom.coordinates;
        const mid = midOfLine(coords);
        L.marker(mid, {
          icon: L.divIcon({ html: `<div class="itp-label">${e.total}</div>`, className: '', iconAnchor: [0, 0] }),
          interactive: false,
        }).addTo(map);
      };

      const drawCircle = (e: EnderecoGrupo, lat: number, lng: number) => {
        const popup = L.popup({ className: 'itp-popup', closeButton: true }).setContent(buildPopupHtml(e));
        const c = L.circleMarker([lat, lng], {
          radius: 10 + Math.min(e.total * 2, 18),
          fillColor: '#7c3aed', color: '#4c1d95', weight: 2, fillOpacity: 0.7,
        }).addTo(map);
        c.on('mouseover', (ev: any) => { popup.setLatLng(ev.latlng).openOn(map); });
        c.on('mouseout',  ()         => { map.closePopup(); });
        c.on('click',     (ev: any) => { popup.setLatLng(ev.latlng).openOn(map); });
        L.marker([lat, lng], {
          icon: L.divIcon({ html: `<div class="itp-label">${e.total}</div>`, className: '', iconAnchor: [-4, 20] }),
          interactive: false,
        }).addTo(map);
      };

      let queued = 0;
      enderecos.forEach(e => {
        const cepLimpo = (e.cep || '').replace(/\D/g, '');
        const key = cepLimpo.length === 8 ? `cep:${cepLimpo}` : `${e.logradouro}|${e.bairro}|${e.cidade}`;
        const hit = cache[key];
        if (hit) {
          if (hit.type === 'line') drawLine(e, hit.geom);
          else drawCircle(e, hit.lat, hit.lng);
          setGeocodedCount(c => c + 1);
          return;
        }
        queued++;
        setTimeout(async () => {
          try {
            let feat: any = null;
            if (cepLimpo.length === 8) {
              try {
                const vr = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
                const vd = await vr.json();
                if (!vd.erro && vd.logradouro) {
                  const addr = [vd.logradouro, vd.bairro, vd.localidade, vd.uf, 'Brasil'].filter(Boolean).join(', ');
                  const nr = await fetch(`https://nominatim.openstreetmap.org/search?format=geojson&polygon_geojson=1&limit=1&q=${encodeURIComponent(addr)}`);
                  const nd = await nr.json();
                  feat = nd.features?.[0];
                }
              } catch {}
              if (!feat) {
                const nr = await fetch(`https://nominatim.openstreetmap.org/search?format=geojson&polygon_geojson=1&limit=1&postalcode=${cepLimpo}&countrycodes=br`);
                const nd = await nr.json();
                feat = nd.features?.[0];
              }
            } else {
              const q = [e.logradouro, e.bairro, e.cidade, 'RJ', 'Brasil'].filter(Boolean).join(', ');
              const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=geojson&polygon_geojson=1&limit=1&q=${encodeURIComponent(q)}`);
              const data = await resp.json();
              feat = data.features?.[0];
            }
            if (feat) {
              const geom = feat.geometry;
              if (geom?.type === 'LineString' || geom?.type === 'MultiLineString') {
                cache[key] = { type: 'line', geom };
                saveCache();
                drawLine(e, geom);
              } else {
                const bb = feat.bbox || [0, 0, 0, 0];
                const lat = (bb[1] + bb[3]) / 2, lng = (bb[0] + bb[2]) / 2;
                cache[key] = { type: 'circle', lat, lng };
                saveCache();
                drawCircle(e, lat, lng);
              }
            }
          } catch {}
          setGeocodedCount(c => c + 1);
        }, queued * 1400);
      });
    });

    return () => { if (mapRef.current) { mapRef.current.map.remove(); mapRef.current = null; } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = totalToGeocode > 0 ? Math.round((geocodedCount / totalToGeocode) * 100) : 100;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-purple-600" />
          <p className="text-sm font-black tracking-tight text-slate-700 dark:text-slate-200">
            Distribuição Geográfica de Alunos
          </p>
          <span className="text-[10px] font-bold text-slate-400 hidden sm:inline">· passe o mouse para ver alunos</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2.5 py-1 rounded-full">
            {alunosNoMapa} aluno{alunosNoMapa !== 1 ? 's' : ''} · {enderecos.length} rua{enderecos.length !== 1 ? 's' : ''}
          </span>
          {semEndereco > 0 && (
            <span className="text-[10px] font-black bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-full" title="Alunos sem rua/bairro cadastrado não aparecem no mapa">
              {semEndereco} sem endereço
            </span>
          )}
          {pct < 100 && (
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[9px] text-slate-400 font-bold">{pct}%</span>
            </div>
          )}
        </div>
      </div>
      <div ref={containerRef} style={{ height: 520, borderRadius: 12, overflow: 'hidden', zIndex: 0 }} />
      <p className="text-[9px] text-slate-400 mt-2 text-right">© OpenStreetMap · Nominatim</p>
    </div>
  );
}

// ─── MonitoramentoTab ─────────────────────────────────────────────────────────

export default function MonitoramentoTab() {
  const [dados, setDados] = useState<any>(null);
  const [mapa, setMapa] = useState<EnderecoGrupo[]>([]);
  const [turmasSemSessao, setTurmasSemSessao] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, rm, rts] = await Promise.allSettled([
        api.get('/academico/monitoramento'),
        api.get('/academico/monitoramento/mapa'),
        api.get('/academico/presenca/turmas-sem-sessao', { params: { dias: 7 } }),
      ]);
      if (r.status === 'fulfilled') setDados(r.value.data);
      if (rm.status === 'fulfilled') setMapa(rm.value.data ?? []);
      if (rts.status === 'fulfilled') setTurmasSemSessao(rts.value.data ?? []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const turmasPresencaKpis = useMemo(() => {
    const tps: any[] = dados?.turmas_presenca ?? [];
    if (!tps.length) return null;
    const comDados = tps.filter((t: any) => t.total_computados > 0);
    if (!comDados.length) return null;
    const medias = comDados.map((t: any) => Math.round(100 * t.presencas / t.total_computados));
    const media = Math.round(medias.reduce((s: number, v: number) => s + v, 0) / medias.length);
    const baixa = comDados.filter((t: any) => Math.round(100 * t.presencas / t.total_computados) < 75).length;
    const melhor = comDados.reduce((a: any, b: any) => (b.presencas / b.total_computados > a.presencas / a.total_computados ? b : a));
    return { media, baixa, totalTurmas: tps.length, melhor };
  }, [dados]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
      <Activity size={32} className="animate-pulse text-purple-400" />
      <p className="text-sm font-bold">Carregando monitoramento...</p>
    </div>
  );

  if (!dados) return (
    <div className="flex justify-center py-16 text-slate-400 text-sm">Erro ao carregar dados.</div>
  );

  const { resumo, top_faltas, top_presencas, turmas_presenca, faltas_frequentes, diario_por_tipo } = dados;

  const kpis = [
    { label: 'Alunos Ativos',    value: resumo.total_alunos,   icon: Users,         color: 'bg-purple-600',  text: 'text-purple-600' },
    { label: 'Taxa de Presença', value: resumo.taxa_presenca != null ? `${resumo.taxa_presenca}%` : '–', icon: TrendingUp, color: 'bg-emerald-600', text: 'text-emerald-600' },
    { label: 'Total de Faltas',  value: resumo.total_faltas,   icon: TrendingDown,  color: 'bg-rose-600',    text: 'text-rose-600' },
    { label: 'Sessões Registradas', value: resumo.total_sessoes, icon: ClipboardCheck, color: 'bg-blue-600', text: 'text-blue-600' },
    { label: 'Registros Diário', value: resumo.total_diario,   icon: History,       color: 'bg-amber-600',   text: 'text-amber-600' },
    { label: 'Justificadas',     value: resumo.total_justificadas, icon: ShieldCheck, color: 'bg-teal-600',  text: 'text-teal-600' },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className={`w-8 h-8 rounded-xl ${k.color} flex items-center justify-center mb-3`}>
              <k.icon size={15} className="text-white" />
            </div>
            <p className={`text-2xl font-black ${k.text}`}>{String(k.value)}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* KPIs de presença por turma */}
      {turmasPresencaKpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center mb-3"><Activity size={15} className="text-white" /></div>
            <p className={`text-2xl font-black ${turmasPresencaKpis.media >= 75 ? 'text-indigo-600' : turmasPresencaKpis.media >= 50 ? 'text-amber-500' : 'text-rose-600'}`}>{turmasPresencaKpis.media}%</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Presença Média por Turma</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className={`w-8 h-8 rounded-xl ${turmasPresencaKpis.baixa > 0 ? 'bg-rose-600' : 'bg-emerald-600'} flex items-center justify-center mb-3`}><TrendingDown size={15} className="text-white" /></div>
            <p className={`text-2xl font-black ${turmasPresencaKpis.baixa > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{turmasPresencaKpis.baixa}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Turmas com Presença &lt; 75%</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className={`w-8 h-8 rounded-xl ${turmasSemSessao.length > 0 ? 'bg-amber-500' : 'bg-emerald-600'} flex items-center justify-center mb-3`}><Clock size={15} className="text-white" /></div>
            <p className={`text-2xl font-black ${turmasSemSessao.length > 0 ? 'text-amber-500' : 'text-emerald-600'}`}>{turmasSemSessao.length}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Turmas sem Chamada (7d)</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center mb-3"><Star size={15} className="text-white" /></div>
            <p className="text-sm font-black text-emerald-600 leading-tight">{turmasPresencaKpis.melhor.turma_nome}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Melhor Presença</p>
          </div>
        </div>
      )}

      {/* Alerta turmas sem sessão */}
      {turmasSemSessao.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={13} className="text-amber-600" />
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">
              Turmas sem chamada nos últimos 7 dias
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {turmasSemSessao.map((t: any) => (
              <span key={t.turma_id} className="text-[10px] font-bold px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full border border-amber-200">
                {t.turma_nome}
                {t.dias_sem_sessao != null && <span className="text-amber-500 ml-1">({t.dias_sem_sessao}d)</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Mapa */}
      <MapaLeaflet enderecos={mapa} totalAlunos={resumo.total_alunos} />

      {/* Diário por tipo */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
          <History size={13} className="text-purple-600"/> Registros no Diário
        </p>
        {diario_por_tipo.length === 0 ? (
          <p className="text-xs text-slate-400">Sem registros.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {diario_por_tipo.map((d: any) => {
              const colors: Record<string, { bar: string; bg: string; text: string }> = {
                'Avaliação':        { bar: 'bg-blue-500',  bg: 'bg-blue-50 dark:bg-blue-900/20',   text: 'text-blue-600' },
                'Incidente':        { bar: 'bg-rose-500',  bg: 'bg-rose-50 dark:bg-rose-900/20',   text: 'text-rose-600' },
                'Observação':       { bar: 'bg-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600' },
                'Comunicado':       { bar: 'bg-teal-500',  bg: 'bg-teal-50 dark:bg-teal-900/20',   text: 'text-teal-600' },
                'Lista de Chamada': { bar: 'bg-green-500', bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-600' },
              };
              const c = colors[d.tipo] || { bar: 'bg-purple-500', bg: 'bg-purple-50', text: 'text-purple-600' };
              const total = diario_por_tipo.reduce((s: number, x: any) => s + x.total, 0) || 1;
              const pct = Math.round(100 * d.total / total);
              return (
                <div key={d.tipo} className={`${c.bg} rounded-xl p-3`}>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{d.tipo}</p>
                  <p className={`text-2xl font-black mt-1 ${c.text}`}>{d.total}</p>
                  <div className="h-1.5 bg-white/60 dark:bg-slate-800 rounded-full overflow-hidden mt-2">
                    <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1 font-bold">{pct}% do total</p>
                </div>
              );
            })}
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
          <div><span className="text-[9px] text-slate-400 uppercase font-black">Presenças</span><p className="text-lg font-black text-green-600">{resumo.total_presentes}</p></div>
          <div><span className="text-[9px] text-slate-400 uppercase font-black">Faltas</span><p className="text-lg font-black text-red-500">{resumo.total_faltas}</p></div>
          <div><span className="text-[9px] text-slate-400 uppercase font-black">Justificadas</span><p className="text-lg font-black text-amber-500">{resumo.total_justificadas}</p></div>
          <div><span className="text-[9px] text-slate-400 uppercase font-black">Isentos</span><p className="text-lg font-black text-slate-500">{resumo.total_isentos}</p></div>
        </div>
      </div>

      {/* Top faltas + Top presença */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
            <TrendingDown size={13} className="text-rose-500"/> Top Alunos — Mais Faltas
          </p>
          {top_faltas.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">Nenhuma falta registrada ainda.</p>
          ) : (
            <div className="space-y-3">
              {top_faltas.slice(0, 8).map((a: any, i: number) => {
                const turmas: { turma_nome: string; faltas: number; total_aulas: number }[] =
                  Array.isArray(a.turmas_detalhe) ? a.turmas_detalhe : [];
                return (
                  <div key={a.aluno_id} className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white ${i === 0 ? 'bg-rose-500' : i < 3 ? 'bg-orange-400' : 'bg-slate-400'}`}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{a.nome_completo}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${i === 0 ? 'bg-rose-500' : i < 3 ? 'bg-orange-400' : 'bg-slate-400'}`}
                              style={{ width: `${Math.round(100 * a.faltas / (top_faltas[0]?.faltas || 1))}%` }} />
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-xs font-black text-rose-600">{a.faltas}</span>
                        <span className="text-[9px] text-slate-400 ml-0.5">falta{a.faltas !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    {turmas.length > 0 && (
                      <div className="ml-8 flex flex-wrap gap-1">
                        {turmas.map(t => (
                          <span key={t.turma_nome} className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-800">
                            {t.turma_nome} <span className="opacity-70">({t.faltas}/{t.total_aulas})</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
            <Star size={13} className="text-emerald-500"/> Top Alunos — Maior Presença
          </p>
          {top_presencas.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">Nenhuma presença registrada ainda.</p>
          ) : (
            <div className="space-y-2">
              {top_presencas.slice(0, 8).map((a: any, i: number) => (
                <div key={a.aluno_id} className="flex items-center gap-3">
                  <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white ${i === 0 ? 'bg-emerald-500' : i < 3 ? 'bg-teal-400' : 'bg-slate-400'}`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{a.nome_completo}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${i === 0 ? 'bg-emerald-500' : i < 3 ? 'bg-teal-400' : 'bg-slate-400'}`}
                          style={{ width: `${a.pct_presenca}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-xs font-black text-emerald-600">{a.pct_presenca}%</span>
                    <span className="text-[9px] text-slate-400 ml-0.5">({a.presencas})</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Presença por turma */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <Zap size={13} className="text-amber-500"/> Presença por Turma
          </p>
          <span className="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">últimos 90 dias</span>
        </div>
        {turmas_presenca.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">Nenhuma chamada registrada ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="text-left py-2 pr-4 text-[9px] font-black uppercase text-slate-400">Turma</th>
                  <th className="text-center py-2 px-2 text-[9px] font-black uppercase text-slate-400">Alunos</th>
                  <th className="text-center py-2 px-2 text-[9px] font-black uppercase text-slate-400">Sessões</th>
                  <th className="text-center py-2 px-2 text-[9px] font-black uppercase text-green-600">Presenças</th>
                  <th className="text-center py-2 px-2 text-[9px] font-black uppercase text-rose-500">Faltas</th>
                  <th className="text-left py-2 pl-4 text-[9px] font-black uppercase text-slate-400">Taxa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {turmas_presenca.map((t: any) => {
                  const pct = t.total_computados > 0 ? Math.round(100 * t.presencas / t.total_computados) : null;
                  return (
                    <tr key={t.turma_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.turma_cor || '#6d28d9' }} />
                          <span className="font-bold text-slate-800 dark:text-slate-200">{t.turma_nome}</span>
                        </div>
                      </td>
                      <td className="text-center py-2.5 px-2 text-slate-500">{t.total_alunos}</td>
                      <td className="text-center py-2.5 px-2 text-slate-400">{t.total_sessoes ?? '–'}</td>
                      <td className="text-center py-2.5 px-2 text-emerald-600 font-bold">{t.presencas}</td>
                      <td className="text-center py-2.5 px-2 text-rose-500 font-bold">{t.faltas}</td>
                      <td className="py-2.5 pl-4">
                        {pct === null ? <span className="text-slate-400 text-[10px]">–</span> : (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden max-w-[80px]">
                              <div className={`h-full rounded-full ${pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                style={{ width: `${pct}%` }} />
                            </div>
                            <span className={`font-black text-[10px] ${pct >= 75 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
                              {pct}%
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Faltas Frequentes */}
      {faltas_frequentes.length > 0 && (
        <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-rose-600" />
              <p className="text-[10px] font-black uppercase tracking-widest text-rose-600">
                Alunos com Faltas Frequentes — últimos 60 dias
              </p>
            </div>
            <span className="text-[10px] font-black bg-rose-600 text-white px-2.5 py-1 rounded-full">
              {faltas_frequentes.length} aluno{faltas_frequentes.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {faltas_frequentes.map((a: any) => {
              const turmas: { turma_nome: string; faltas: number; total_aulas: number }[] =
                Array.isArray(a.turmas_detalhe) ? a.turmas_detalhe : [];
              return (
                <div key={a.aluno_id} className="bg-white dark:bg-slate-900 rounded-xl px-4 py-3 border border-rose-100 dark:border-rose-900">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{a.nome_completo}</p>
                      <p className="text-[9px] text-slate-400">{a.numero_matricula || '–'}</p>
                    </div>
                    {a.celular && (
                      <a href={`https://wa.me/55${a.celular.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
                        className="text-[9px] font-black uppercase px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors shrink-0">
                        WhatsApp
                      </a>
                    )}
                  </div>
                  {turmas.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {turmas.map(t => (
                        <span key={t.turma_nome} className="inline-flex items-center gap-1 bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400 text-[10px] font-black px-2.5 py-1 rounded-full">
                          {t.turma_nome}
                          <span className="opacity-60">({t.faltas}/{t.total_aulas})</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase text-slate-500 hover:text-purple-600 hover:border-purple-300 transition-all">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Atualizar dados
        </button>
      </div>
    </div>
  );
}
