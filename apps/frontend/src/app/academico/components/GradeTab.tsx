'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, Clock, User, MapPin, Coffee, Calendar } from 'lucide-react';
import api from '@/services/api';
import { Turma, GradeCard } from './_types';
import { DIAS_SEMANA, HORARIOS, CORES_CARD, Modal, FieldInput, FieldSelect } from './_shared';

// ─── KPI Colors ───────────────────────────────────────────────────────────────

const KPI_GRADE_COLORS: Record<string, { accent: string; bg: string; text: string; sub: string; dot: string }> = {
  purple: { accent: 'bg-purple-500', bg: 'bg-white', text: 'text-slate-800',  sub: 'text-slate-400', dot: 'bg-purple-500' },
  blue:   { accent: 'bg-blue-500',   bg: 'bg-white', text: 'text-slate-800',  sub: 'text-slate-400', dot: 'bg-blue-500'   },
  green:  { accent: 'bg-emerald-500',bg: 'bg-white', text: 'text-slate-800',  sub: 'text-slate-400', dot: 'bg-emerald-500'},
  amber:  { accent: 'bg-amber-400',  bg: 'bg-white', text: 'text-slate-800',  sub: 'text-slate-400', dot: 'bg-amber-400'  },
  red:    { accent: 'bg-red-500',    bg: 'bg-white', text: 'text-slate-800',  sub: 'text-slate-400', dot: 'bg-red-500'    },
};

function KpiGrade({ label, value, sub, color, isText }: {
  label: string; value: number | string; sub: string; color: string; isText?: boolean;
}) {
  const c = KPI_GRADE_COLORS[color] ?? KPI_GRADE_COLORS.purple;
  return (
    <div className={`${c.bg} border border-slate-100 rounded-2xl p-4 flex flex-col gap-1.5 min-w-0 overflow-hidden relative shadow-sm`}>
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${c.accent} rounded-l-2xl`} />
      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 pl-2">{label}</span>
      <span className={`font-black ${c.text} leading-none truncate pl-2 ${isText ? 'text-base' : 'text-[2rem]'}`}>{value}</span>
      <span className="text-[10px] font-medium text-slate-400 truncate pl-2 flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />{sub}
      </span>
    </div>
  );
}

// ─── Grade layout helpers ─────────────────────────────────────────────────────

const GRADE_ROW_H  = 56;
const GRADE_HEAD_H = 56;

function timeToMinsGrade(t: string) {
  const [h, m] = (t || '00:00').split(':').map(Number);
  return h * 60 + m;
}

function computeCardLayout(cards: GradeCard[]): Map<string, { col: number; cols: number }> {
  const result = new Map<string, { col: number; cols: number }>();
  if (!cards.length) return result;

  const sorted = [...cards]
    .filter(c => c.horario_inicio)
    .sort((a, b) => timeToMinsGrade(a.horario_inicio) - timeToMinsGrade(b.horario_inicio));

  const clusters: { cards: GradeCard[]; maxEnd: number }[] = [];
  for (const card of sorted) {
    const start = timeToMinsGrade(card.horario_inicio);
    const end   = card.horario_fim ? timeToMinsGrade(card.horario_fim) : start + 60;
    const cluster = [...clusters].reverse().find(c => c.maxEnd > start);
    if (cluster) { cluster.cards.push(card); cluster.maxEnd = Math.max(cluster.maxEnd, end); }
    else clusters.push({ cards: [card], maxEnd: end });
  }

  for (const { cards: cc } of clusters) {
    const colEnds: number[] = [];
    for (const card of cc) {
      const start = timeToMinsGrade(card.horario_inicio);
      const end   = card.horario_fim ? timeToMinsGrade(card.horario_fim) : start + 60;
      let col = colEnds.findIndex(e => e <= start);
      if (col === -1) col = colEnds.length;
      colEnds[col] = end;
      result.set(card.id, { col, cols: cc.length });
    }
  }
  return result;
}

function timeToPixelGrade(t: string): number {
  const targetMins = timeToMinsGrade((t || '').slice(0, 5));
  const knownSlots = HORARIOS
    .map((h, idx) => h.value ? { mins: timeToMinsGrade(h.value), idx } : null)
    .filter(Boolean) as { mins: number; idx: number }[];

  const exact = knownSlots.find(s => s.mins === targetMins);
  if (exact) return exact.idx * GRADE_ROW_H;

  const prev = [...knownSlots].reverse().find(s => s.mins < targetMins);
  const next = knownSlots.find(s => s.mins > targetMins);

  if (!prev) return 0;
  if (!next) return (prev.idx + 1) * GRADE_ROW_H;

  const frac = (targetMins - prev.mins) / (next.mins - prev.mins);
  return (prev.idx + frac * (next.idx - prev.idx)) * GRADE_ROW_H;
}

// ─── GradeTab ─────────────────────────────────────────────────────────────────

export function GradeTab({ podeEditar, turmas }: { podeEditar: boolean; turmas: Turma[] }) {
  const [grade, setGrade] = useState<GradeCard[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [dragCard, setDragCard] = useState<GradeCard | null>(null);
  const [form, setForm] = useState<Partial<GradeCard>>({ cor: '#7c3aed' });
  const [erroGrade, setErroGrade] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/academico/grade');
      setGrade(r.data);
      setErroGrade(null);
    } catch (e: any) {
      setErroGrade(e?.response?.data?.message || e?.message || 'Erro ao carregar grade horária.');
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const currentMins = now.getHours() * 60 + now.getMinutes();
  const jsDow = now.getDay();
  const todayDia = jsDow >= 1 && jsDow <= 6 ? jsDow : 0;

  const slotsComValor = HORARIOS.filter(h => h.value);
  let currentRowIdx = -1;
  let slotFraction = 0;
  for (let i = 0; i < slotsComValor.length; i++) {
    const start = timeToMinsGrade(slotsComValor[i].value!);
    const end = i + 1 < slotsComValor.length ? timeToMinsGrade(slotsComValor[i + 1].value!) : start + 30;
    if (currentMins >= start && currentMins < end) {
      currentRowIdx = HORARIOS.findIndex(h => h.value === slotsComValor[i].value);
      slotFraction = (currentMins - start) / (end - start);
      break;
    }
  }
  const lineTop = currentRowIdx >= 0 ? GRADE_HEAD_H + currentRowIdx * GRADE_ROW_H + slotFraction * GRADE_ROW_H : -1;

  const professoresArr = [...new Set(grade.map(g => g.nome_professor).filter(Boolean) as string[])];
  const aulasHoje = grade.filter(g => g.dia_semana === todayDia);
  const aulaAgora = grade.filter(g =>
    g.dia_semana === todayDia && g.horario_inicio && g.horario_fim &&
    timeToMinsGrade(g.horario_inicio) <= currentMins &&
    timeToMinsGrade(g.horario_fim) > currentMins
  );
  const proxAula = grade
    .filter(g => g.dia_semana === todayDia && g.horario_inicio && timeToMinsGrade(g.horario_inicio) > currentMins)
    .sort((a, b) => timeToMinsGrade(a.horario_inicio!) - timeToMinsGrade(b.horario_inicio!))[0];

  const profSubtext = professoresArr.length
    ? professoresArr.slice(0, 2).join(', ') + (professoresArr.length > 2 ? ` +${professoresArr.length - 2}` : '')
    : 'nenhum cadastrado';

  const handleDrop = async (e: React.DragEvent, dia: number, hora: string) => {
    e.preventDefault();
    if (!dragCard || !podeEditar) return;
    try {
      await api.patch(`/academico/grade/${dragCard.id}`, { dia_semana: dia, horario_inicio: hora + ':00' });
      await load();
    } catch {}
    setDragCard(null);
  };

  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroGrade(null);
    if (!form.turma_id) { setErroGrade('Selecione uma turma para continuar.'); return; }
    try {
      await api.post('/academico/grade', {
        ...form,
        horario_inicio: form.horario_inicio ? form.horario_inicio + ':00' : undefined,
        horario_fim:    form.horario_fim    ? form.horario_fim    + ':00' : undefined,
      });
      setShowModal(false); setForm({ cor: '#7c3aed' }); await load();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Erro ao salvar horário.';
      setErroGrade(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  };

  const handleDeletar = async (id: string) => {
    if (!confirm('Remover este horário?')) return;
    try { await api.delete(`/academico/grade/${id}`); await load(); } catch {}
  };

  return (
    <div className="space-y-5">

      {erroGrade && grade.length === 0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-2xl px-4 py-3 flex items-center gap-2">
          <X size={14} className="shrink-0"/> Erro ao carregar grade: {erroGrade}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiGrade label="Aulas na Semana" value={grade.length} sub="horários cadastrados" color="purple" />
        <KpiGrade label="Professores" value={professoresArr.length} sub={profSubtext} color="blue" />
        <KpiGrade label="Aulas Hoje" value={aulasHoje.length} sub={todayDia >= 1 ? DIAS_SEMANA[todayDia - 1] : 'Sem aula hoje'} color="green" />
        <KpiGrade
          label={aulaAgora.length ? 'Em Aula Agora' : 'Próxima Aula'}
          value={aulaAgora.length ? (aulaAgora[0].nome_turma || '–') : (proxAula?.nome_turma ?? '–')}
          sub={aulaAgora.length ? (aulaAgora[0].nome_professor || aulaAgora[0].horario_inicio?.slice(0,5) || '') : proxAula ? proxAula.horario_inicio?.slice(0,5) ?? '' : 'Nenhuma hoje'}
          color={aulaAgora.length ? 'red' : 'amber'} isText
        />
      </div>

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-black text-slate-800 tracking-tight">Grade Horária Semanal</h2>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">
            {grade.length === 0 ? 'Nenhum horário cadastrado ainda' : `${grade.length} aula${grade.length !== 1 ? 's' : ''} distribuídas na semana`}
          </p>
        </div>
        {podeEditar && (
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase hover:bg-purple-700 active:scale-95 transition-all shadow-sm shadow-purple-200">
            <Plus size={14}/> Adicionar Horário
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[820px] relative">

            {lineTop >= 0 && todayDia >= 1 && (
              <div className="absolute left-0 right-0 z-20 pointer-events-none"
                style={{ top: `${lineTop}px` }}>
                <div className="flex items-center">
                  <div className="flex items-center justify-end pr-2" style={{ width: 68, flexShrink: 0 }}>
                    <span className="text-[9px] font-black text-red-500 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full leading-none whitespace-nowrap">
                      {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-red-500 ring-4 ring-red-100 shrink-0 -ml-1 z-10" />
                  <div className="flex-1 h-px bg-red-400" style={{ backgroundImage: 'repeating-linear-gradient(90deg,#f87171 0,#f87171 6px,transparent 6px,transparent 12px)' }} />
                </div>
              </div>
            )}

            <div className="flex">
              <div style={{ width: 68, flexShrink: 0 }} className="border-r border-slate-100">
                <div style={{ height: GRADE_HEAD_H }}
                  className="border-b border-slate-100 flex items-center justify-center bg-slate-50">
                  <Clock size={12} className="text-slate-300" />
                </div>
                {HORARIOS.map((h, idx) => {
                  const isCurrentRow = idx === currentRowIdx && todayDia >= 1;
                  return (
                    <div key={idx}
                      style={{ height: GRADE_ROW_H }}
                      className={`border-b border-slate-100 flex items-center justify-end pr-3 transition-colors
                        ${h.lanche ? 'bg-amber-50/70' : isCurrentRow ? 'bg-red-50/40' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                      {h.lanche
                        ? <Coffee size={11} className="text-amber-300" />
                        : <span className={`text-[10px] tabular-nums font-semibold ${isCurrentRow ? 'text-red-500 font-black' : 'text-slate-300'}`}>{h.label}</span>}
                    </div>
                  );
                })}
              </div>

              {DIAS_SEMANA.map((d, di) => {
                const diaNum = di + 1;
                const isToday = diaNum === todayDia;
                const cardsForDay = grade.filter(g => g.dia_semana === diaNum);
                const totalBodyH = HORARIOS.length * GRADE_ROW_H;

                return (
                  <div key={d} className="flex-1 border-r border-slate-100 last:border-0 flex flex-col min-w-0">
                    <div style={{ height: GRADE_HEAD_H }}
                      className={`border-b flex flex-col items-center justify-center shrink-0 gap-0.5 transition-colors
                        ${isToday
                          ? 'bg-gradient-to-b from-purple-600 to-purple-700 border-purple-700'
                          : 'bg-slate-50 border-slate-100'}`}>
                      <span className={`text-[11px] font-black uppercase tracking-widest ${isToday ? 'text-white' : 'text-slate-500'}`}>{d.slice(0,3)}</span>
                      {isToday
                        ? <span className="text-[8px] font-black text-purple-200 uppercase tracking-wider">Hoje</span>
                        : cardsForDay.length > 0
                          ? <span className="text-[8px] font-semibold text-slate-400">{cardsForDay.length} aula{cardsForDay.length > 1 ? 's' : ''}</span>
                          : <span className="text-[8px] text-slate-200">—</span>}
                    </div>

                    <div className="relative" style={{ height: totalBodyH }}>
                      {HORARIOS.map((h, idx) => (
                        <div key={idx}
                          style={{ position: 'absolute', top: idx * GRADE_ROW_H, height: GRADE_ROW_H, left: 0, right: 0 }}
                          className={`border-b border-slate-100/70 transition-colors group/slot
                            ${h.lanche ? 'bg-amber-50/50' : isToday ? (idx % 2 === 0 ? 'bg-purple-50/20' : 'bg-purple-50/10') : (idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30')}
                            ${podeEditar && !h.lanche ? 'hover:bg-purple-50/40' : ''}`}
                          onDragOver={e => { if (podeEditar && !h.lanche) e.preventDefault(); }}
                          onDrop={e => { if (!h.lanche && h.value) handleDrop(e, diaNum, h.value); }}
                        />
                      ))}

                      {(() => {
                        const validCards = cardsForDay.filter(c => c.horario_inicio);
                        const layout = computeCardLayout(validCards);
                        return validCards.map(card => {
                          const topY  = timeToPixelGrade(card.horario_inicio!);
                          const endY  = card.horario_fim ? timeToPixelGrade(card.horario_fim) : topY + GRADE_ROW_H;
                          const top   = topY + 3;
                          const height = Math.max(endY - topY, GRADE_ROW_H - 6) - 6;
                          const isDragging = dragCard?.id === card.id;
                          const { col, cols } = layout.get(card.id) ?? { col: 0, cols: 1 };
                          const GAP = 3;
                          const colW = `calc(${100 / cols}% - ${GAP * (1 + 1 / cols)}px)`;
                          const leftPx = `calc(${(col / cols) * 100}% + ${GAP}px)`;
                          return (
                            <div key={card.id}
                              draggable={podeEditar}
                              onDragStart={() => setDragCard(card)}
                              onDragEnd={() => setDragCard(null)}
                              title={`${card.nome_turma || card.nome_curso || ''}${card.nome_professor ? ' · ' + card.nome_professor : ''}${card.sala ? ' · Sala ' + card.sala : ''}`}
                              className={`absolute rounded-xl text-white z-10 group/card overflow-hidden transition-all duration-150
                                ${isDragging ? 'opacity-40 scale-95' : 'hover:z-50 hover:shadow-xl hover:scale-[1.02] hover:-translate-y-0.5 shadow-md shadow-black/10'}`}
                              style={{
                                top, height,
                                left: leftPx,
                                width: colW,
                                backgroundColor: card.cor || '#7c3aed',
                                cursor: podeEditar ? 'grab' : 'default',
                                backgroundImage: `linear-gradient(160deg, color-mix(in srgb, ${card.cor || '#7c3aed'} 80%, white) 0%, ${card.cor || '#7c3aed'} 60%)`,
                              }}>
                              <div className="absolute inset-x-0 top-0 h-px bg-white/30" />
                              {podeEditar && (
                                <button onClick={() => handleDeletar(card.id)}
                                  className="absolute top-1 right-1 bg-black/20 hover:bg-black/40 rounded-full p-0.5 opacity-0 group-hover/card:opacity-100 transition-all z-20">
                                  <X size={8}/>
                                </button>
                              )}
                              <div className="p-1.5 h-full flex flex-col gap-0.5 overflow-hidden">
                                <div className={`font-black leading-tight drop-shadow-sm ${cols > 1 ? 'text-[9px] line-clamp-1' : 'text-[10px] line-clamp-2'}`}>
                                  {card.nome_turma || card.nome_curso || '–'}
                                </div>
                                <div className="text-[8px] font-semibold text-white/75 tabular-nums flex items-center gap-0.5 mt-0.5">
                                  <Clock size={6} className="shrink-0 opacity-70"/>
                                  {card.horario_inicio?.slice(0,5)}–{card.horario_fim?.slice(0,5)}
                                </div>
                                {card.nome_professor && (
                                  <div className={`text-white/80 truncate flex items-center gap-0.5 mt-0.5 ${cols > 1 ? 'text-[7px]' : 'text-[8px]'}`}>
                                    <User size={6} className="shrink-0 opacity-60"/>
                                    {card.nome_professor}
                                  </div>
                                )}
                                {card.sala && cols === 1 && height > 50 && (
                                  <div className="text-[8px] text-white/60 truncate flex items-center gap-0.5">
                                    <MapPin size={6} className="shrink-0 opacity-60"/>
                                    {card.sala}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {grade.length > 0 && (() => {
        const turmasNaGrade = [...new Map(
          grade.filter(g => g.turma_id && (g.nome_turma || g.nome_curso))
            .map(g => [g.turma_id, { id: g.turma_id!, nome: g.nome_turma || g.nome_curso!, cor: g.cor || '#7c3aed' }])
        ).values()];
        if (!turmasNaGrade.length) return null;
        return (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[9px] font-black uppercase text-slate-300 tracking-widest shrink-0">Turmas</span>
            {turmasNaGrade.map(t => (
              <div key={t.id} className="flex items-center gap-2 bg-white border border-slate-100 rounded-full px-3 py-1.5 shadow-sm">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.cor }} />
                <span className="text-[10px] font-bold text-slate-600">{t.nome}</span>
              </div>
            ))}
          </div>
        );
      })()}

      {grade.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <Calendar size={28} className="text-slate-300" />
          </div>
          <p className="text-slate-500 font-bold text-sm">Nenhum horário cadastrado</p>
          <p className="text-slate-400 text-xs mt-1">
            {podeEditar ? 'Clique em "Adicionar Horário" para montar a grade semanal.' : 'A grade ainda não foi configurada.'}
          </p>
        </div>
      )}

      {!podeEditar && grade.length > 0 && (
        <p className="text-[10px] text-center text-slate-300 font-medium">
          Visualização apenas — edição restrita a ADMIN / PRT / VP / DRT
        </p>
      )}

      {showModal && (
        <Modal title="Adicionar Horário na Grade" onClose={() => { setShowModal(false); setForm({ cor: '#7c3aed' }); setErroGrade(null); }}>
          <form onSubmit={handleCriar} className="space-y-4">
            <FieldSelect label="Turma *" value={form.turma_id ?? ''}
              onChange={v => {
                const t = turmas.find(t => t.id === v);
                setForm(p => ({ ...p, turma_id: v, cor: t?.cor || p.cor || '#7c3aed' }));
              }}
              options={turmas.map(t => ({ value: t.id, label: t.nome }))} required />

            <FieldSelect label="Dia da Semana" value={String(form.dia_semana ?? '')}
              onChange={v => setForm(p => ({ ...p, dia_semana: Number(v) }))}
              options={DIAS_SEMANA.map((d, i) => ({ value: String(i+1), label: d }))} required />

            <div className="grid grid-cols-2 gap-3">
              <FieldSelect label="Hora Início" value={form.horario_inicio}
                onChange={v => setForm(p => ({ ...p, horario_inicio: v }))}
                options={HORARIOS.filter(h => h.value).map(h => ({ value: h.value!, label: h.label }))} required />
              <FieldSelect label="Hora Fim" value={form.horario_fim}
                onChange={v => setForm(p => ({ ...p, horario_fim: v }))}
                options={HORARIOS.filter(h => h.value).map(h => ({ value: h.value!, label: h.label }))} required />
            </div>

            {form.horario_inicio && form.horario_fim && (
              <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-2.5 flex items-center gap-2">
                <Clock size={12} className="text-purple-400 shrink-0" />
                <span className="text-[11px] font-bold text-purple-700">
                  {form.horario_inicio} → {form.horario_fim}
                  {' · '}
                  {(() => {
                    const [h1, m1] = form.horario_inicio.split(':').map(Number);
                    const [h2, m2] = form.horario_fim.split(':').map(Number);
                    const mins = (h2*60+m2) - (h1*60+m1);
                    return mins > 0 ? `${mins} min` : '–';
                  })()}
                </span>
              </div>
            )}

            <FieldInput label="Sala (opcional)" value={form.sala} onChange={v => setForm(p => ({ ...p, sala: v }))} />

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500 block">Cor do Card</label>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl border-2 border-slate-200 shadow-sm shrink-0 overflow-hidden">
                  <input type="color" value={form.cor || '#7c3aed'}
                    onChange={e => setForm(p => ({ ...p, cor: e.target.value }))}
                    className="w-14 h-14 -ml-2 -mt-2 cursor-pointer border-0" />
                </div>
                <div className="flex gap-1.5 flex-wrap flex-1">
                  {CORES_CARD.map(c => (
                    <button key={c} type="button" onClick={() => setForm(p => ({ ...p, cor: c }))}
                      className={`w-6 h-6 rounded-lg transition-all shadow-sm ${form.cor === c ? 'ring-2 ring-offset-2 ring-slate-700 scale-110' : 'hover:scale-110 hover:shadow-md'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </div>

            {form.turma_id && (
              <div className="rounded-xl p-3 text-white text-[11px] font-black shadow-sm"
                style={{ backgroundColor: form.cor || '#7c3aed' }}>
                {turmas.find(t => t.id === form.turma_id)?.nome || 'Turma'}
                {form.horario_inicio && <span className="font-semibold opacity-75 ml-2">{form.horario_inicio}–{form.horario_fim}</span>}
              </div>
            )}

            {erroGrade && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-[11px] font-bold rounded-xl px-4 py-3 flex items-center gap-2">
                <X size={12} className="shrink-0" /> {erroGrade}
              </div>
            )}

            <button type="submit"
              className="w-full bg-purple-600 text-white py-3 rounded-xl font-black text-xs uppercase hover:bg-purple-700 active:scale-[0.98] transition-all shadow-sm">
              Confirmar
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
