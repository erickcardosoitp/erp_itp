'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';
const PONTO_TOKEN = 'itp-ponto-2026';

function calcDistanciaM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcStatusGeofence(geo: { lat: number; lon: number } | null, colaborador: ColaboradorInfo): { dentro: boolean | null; distancia: number | null; local: string | null } {
  if (!geo) return { dentro: null, distancia: null, local: null };
  const locais = colaborador.locais ?? [];
  if (locais.length > 0) {
    let melhor = { dist: Infinity, raio: 100, nome: '' };
    for (const l of locais) {
      const d = calcDistanciaM(geo.lat, geo.lon, Number(l.latitude), Number(l.longitude));
      if (d < melhor.dist) melhor = { dist: d, raio: l.raio_metros, nome: l.nome };
    }
    const dentro = locais.some(l => calcDistanciaM(geo.lat, geo.lon, Number(l.latitude), Number(l.longitude)) <= l.raio_metros);
    return { dentro, distancia: Math.round(melhor.dist), local: melhor.nome };
  }
  if (colaborador.latitude_permitida && colaborador.longitude_permitida) {
    const d = Math.round(calcDistanciaM(geo.lat, geo.lon, Number(colaborador.latitude_permitida), Number(colaborador.longitude_permitida)));
    return { dentro: d <= (colaborador.raio_metros ?? 100), distancia: d, local: 'Instituto' };
  }
  return { dentro: null, distancia: null, local: null };
}

type Tela = 'login' | 'menu' | 'ponto' | 'banco' | 'historico' | 'folga';

interface LocalPermitido { id: string; nome: string; latitude: number; longitude: number; raio_metros: number; }

interface ColaboradorInfo {
  colaborador_id: string;
  nome: string;
  matricula: string;
  horario_entrada: string | null;
  horario_saida: string | null;
  jornada_flexivel: boolean;
  latitude_permitida: number | null;
  longitude_permitida: number | null;
  raio_metros: number;
  locais: LocalPermitido[];
  ultimo_ponto: { tipo: string; data_hora: string } | null;
}

// ── Pad de assinatura ─────────────────────────────────────────────────────

function SignaturePad({ onConfirm, onCancel }: { onConfirm: (sig: string) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const getPos = (e: MouseEvent | Touch, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const start = (pos: { x: number; y: number }) => { drawing.current = true; lastPos.current = pos; };
    const draw = (pos: { x: number; y: number }) => {
      if (!drawing.current || !lastPos.current) return;
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastPos.current = pos;
    };
    const stop = () => { drawing.current = false; lastPos.current = null; };

    const onMouseDown = (e: MouseEvent) => start(getPos(e, canvas));
    const onMouseMove = (e: MouseEvent) => draw(getPos(e, canvas));
    const onMouseUp = () => stop();
    const onTouchStart = (e: TouchEvent) => { e.preventDefault(); start(getPos(e.touches[0], canvas)); };
    const onTouchMove = (e: TouchEvent) => { e.preventDefault(); draw(getPos(e.touches[0], canvas)); };
    const onTouchEnd = () => stop();

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  const limpar = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const confirmar = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onConfirm(canvas.toDataURL('image/png'));
  };

  return (
    <div className="space-y-3">
      <p className="text-purple-300 text-xs text-center uppercase tracking-widest font-bold">Assine abaixo para confirmar</p>
      <div className="border-2 border-purple-500 rounded-xl overflow-hidden">
        <canvas ref={canvasRef} width={320} height={140} className="w-full touch-none bg-white" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={limpar} className="py-2 rounded-xl border border-purple-700 text-purple-300 text-sm font-bold hover:bg-purple-900/30 transition">Limpar</button>
        <button onClick={confirmar} className="py-2 rounded-xl bg-yellow-400 text-purple-950 text-sm font-black hover:bg-yellow-300 transition">Confirmar</button>
      </div>
      <button onClick={onCancel} className="w-full text-xs text-purple-500 hover:text-purple-300 transition">← Cancelar</button>
    </div>
  );
}

// ── Banco de Horas ────────────────────────────────────────────────────────

function TelaBancoHoras({ colaborador, onVoltar }: { colaborador: ColaboradorInfo; onVoltar: () => void }) {
  const [banco, setBanco] = useState<any>(null);
  const [mes, setMes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (!mes) setMes(new Date().toISOString().slice(0, 7)); }, [mes]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/gente/ponto/externo/banco-horas?colaborador_id=${colaborador.colaborador_id}&mes=${mes}`);
      if (r.ok) setBanco(await r.json());
    } catch { toast.error('Erro ao carregar banco de horas.'); }
    finally { setLoading(false); }
  }, [colaborador.colaborador_id, mes]);

  useEffect(() => { carregar(); }, [carregar]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={onVoltar} className="text-purple-400 hover:text-white transition text-xl">←</button>
        <h2 className="text-white font-black text-lg">Banco de Horas</h2>
      </div>
      <input type="month" value={mes} onChange={e => setMes(e.target.value)}
        className="w-full bg-purple-950/60 border border-purple-700/50 text-white rounded-xl px-4 py-2 text-sm" />
      {loading ? (
        <p className="text-purple-400 text-center text-sm">Carregando...</p>
      ) : banco ? (
        <div className="bg-white/5 border border-purple-700/40 rounded-2xl p-5 space-y-4">
          <div className="text-center">
            <div className={`text-4xl font-black ${banco.saldo_minutos >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {banco.saldo}
            </div>
            <div className="text-purple-300 text-xs mt-1">Saldo de horas</div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center text-sm">
            <div className="bg-purple-900/40 rounded-xl p-3">
              <div className="text-white font-bold">{banco.trabalhado}</div>
              <div className="text-purple-400 text-xs">Trabalhado</div>
            </div>
            <div className="bg-purple-900/40 rounded-xl p-3">
              <div className="text-white font-bold">{banco.esperado}</div>
              <div className="text-purple-400 text-xs">Esperado</div>
            </div>
          </div>
          <div className="text-xs text-purple-400 text-center">{banco.dias_esperados} dia(s) de trabalho esperado(s)</div>
          {banco.marcacoes_incompletas?.length > 0 && (
            <div className="bg-yellow-500/20 border border-yellow-500/40 rounded-xl p-3 text-xs text-yellow-300 space-y-1">
              <div className="font-bold text-yellow-200">⚠️ Marcações com problema — avise o administrador:</div>
              {banco.marcacoes_incompletas.map((m: string, i: number) => <div key={i}>• {m}</div>)}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ── Histórico ─────────────────────────────────────────────────────────────

function TelaHistorico({ colaborador, onVoltar }: { colaborador: ColaboradorInfo; onVoltar: () => void }) {
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/gente/ponto/externo/historico?colaborador_id=${colaborador.colaborador_id}`)
      .then(r => r.json()).then(setRegistros).catch(() => toast.error('Erro ao carregar histórico.'))
      .finally(() => setLoading(false));
  }, [colaborador.colaborador_id]);

  const fmtDH = (iso: string) => {
    const d = new Date(iso);
    return { data: d.toLocaleDateString('pt-BR'), hora: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) };
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={onVoltar} className="text-purple-400 hover:text-white transition text-xl">←</button>
        <h2 className="text-white font-black text-lg">Histórico de Marcações</h2>
      </div>
      {loading ? (
        <p className="text-purple-400 text-center text-sm">Carregando...</p>
      ) : registros.length === 0 ? (
        <p className="text-purple-500 text-center text-sm">Nenhum registro encontrado.</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {registros.map(r => {
            const { data, hora } = fmtDH(r.data_hora);
            return (
              <div key={r.id} className="flex items-center gap-3 bg-white/5 border border-purple-700/30 rounded-xl px-4 py-2.5">
                <span className={`text-lg ${r.tipo === 'entrada' ? '✅' : '🔴'}`}>{r.tipo === 'entrada' ? '✅' : '🔴'}</span>
                <div className="flex-1">
                  <span className={`text-sm font-bold ${r.tipo === 'entrada' ? 'text-green-400' : 'text-red-400'}`}>{r.tipo.toUpperCase()}</span>
                  <span className="text-purple-400 text-xs ml-2">{data} · {hora}</span>
                </div>
                {r.dentro_area !== null && (
                  <span className={`text-xs ${r.dentro_area ? 'text-green-500' : 'text-orange-400'}`}>{r.dentro_area ? '📍' : '⚠️'}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Solicitar Folga ───────────────────────────────────────────────────────

function TelaFolga({ colaborador, onVoltar }: { colaborador: ColaboradorInfo; onVoltar: () => void }) {
  const [disponibilidade, setDisponibilidade] = useState<any>(null);
  const [carregando, setCarregando] = useState(false);
  const [dataSelecionada, setDataSelecionada] = useState('');
  const [enviando, setEnviando] = useState(false);

  const consultarDisp = async () => {
    setCarregando(true);
    setDataSelecionada('');
    try {
      const r = await fetch(`${API}/gente/folgas/disponibilidade?colaborador_id=${colaborador.colaborador_id}`);
      if (r.ok) setDisponibilidade(await r.json());
      else toast.error('Erro ao consultar disponibilidade.');
    } catch { toast.error('Erro ao consultar disponibilidade.'); }
    finally { setCarregando(false); }
  };

  const solicitar = async () => {
    if (!dataSelecionada) return toast.error('Selecione uma data.');
    setEnviando(true);
    try {
      const r = await fetch(`${API}/gente/folgas/solicitar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colaborador_id: colaborador.colaborador_id, data: dataSelecionada }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.message || 'Erro ao solicitar folga.');
      toast.success('Folga solicitada! Aguarde aprovação.');
      setDataSelecionada('');
      consultarDisp();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setEnviando(false); }
  };

  const fmtData = (iso: string) => {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={onVoltar} className="text-purple-400 hover:text-white transition text-xl">←</button>
        <h2 className="text-white font-black text-lg">Solicitar Folga</h2>
      </div>

      <div className="bg-purple-900/30 border border-purple-700/40 rounded-xl p-3 text-xs text-purple-300 space-y-0.5">
        <p className="font-bold text-white mb-1">📋 Regras</p>
        <p>· Dias: Segunda, Quinta e Sexta</p>
        <p>· Máx. 1 folga/semana por colaborador · 2 no total</p>
        <p>· Mínimo <span className="text-yellow-400 font-bold">10 dias</span> de antecedência</p>
        <p>· Débito de horas no mês anterior bloqueia por 1 mês</p>
      </div>

      {!disponibilidade ? (
        <button onClick={consultarDisp} disabled={carregando}
          className="w-full bg-yellow-400 text-purple-950 font-black uppercase tracking-widest rounded-xl py-3 text-sm hover:bg-yellow-300 transition disabled:opacity-50">
          {carregando ? 'Consultando...' : '🔍 Consultar Disponibilidade'}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-purple-300 font-semibold uppercase tracking-widest">Próximas datas</p>
            <button onClick={consultarDisp} className="text-xs text-purple-400 hover:text-yellow-400 transition">↻ Atualizar</button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {disponibilidade.datas.length === 0 ? (
              <p className="text-purple-500 text-center text-sm">Nenhuma data disponível nas próximas semanas.</p>
            ) : disponibilidade.datas.map((d: any) => {
              const selecionado = dataSelecionada === d.data;
              return (
                <button key={d.data} onClick={() => d.disponivel && setDataSelecionada(selecionado ? '' : d.data)}
                  disabled={!d.disponivel}
                  className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition border ${
                    selecionado
                      ? 'bg-yellow-400 border-yellow-400 text-purple-950'
                      : d.disponivel
                        ? 'bg-green-900/20 border-green-700/40 text-white hover:bg-green-900/40'
                        : 'bg-white/5 border-white/10 text-slate-500 cursor-not-allowed'
                  }`}>
                  <span className="text-lg">{d.disponivel ? '🟢' : '🔴'}</span>
                  <div className="flex-1">
                    <div className="font-bold text-sm">{d.dia} · {fmtData(d.data)}</div>
                    {d.disponivel
                      ? <div className={`text-xs ${selecionado ? 'text-purple-900' : 'text-green-400'}`}>{d.vagas_semana} vaga(s) disponível(is) nesta semana</div>
                      : <div className="text-xs text-red-400">{d.motivo}</div>}
                  </div>
                  {selecionado && <span className="text-purple-950 font-black text-lg">✓</span>}
                </button>
              );
            })}
          </div>

          {dataSelecionada && (
            <button onClick={solicitar} disabled={enviando}
              className="w-full bg-yellow-400 text-purple-950 font-black uppercase tracking-widest rounded-xl py-3 text-sm hover:bg-yellow-300 transition disabled:opacity-50">
              {enviando ? 'Enviando...' : `Confirmar folga — ${fmtData(dataSelecionada)}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tela de Ponto (com assinatura) ────────────────────────────────────────

function TelaMarcarPonto({
  colaborador, geo, geoErro, obterGeo, token, identificador, onVoltar, onRegistrado,
}: {
  colaborador: ColaboradorInfo;
  geo: { lat: number; lon: number } | null;
  geoErro: string;
  obterGeo: () => void;
  token: string;
  identificador: string;
  onVoltar: () => void;
  onRegistrado: (tipo: string) => void;
}) {
  const [etapa, setEtapa] = useState<'botoes' | 'assinatura'>('botoes');
  const [tipoSelecionado, setTipoSelecionado] = useState<'entrada' | 'saida' | null>(null);
  const [registrando, setRegistrando] = useState(false);
  const tipoProximo = colaborador.ultimo_ponto?.tipo === 'entrada' ? 'saida' : 'entrada';
  const [agora, setAgora] = useState<Date | null>(null);

  useEffect(() => {
    setAgora(new Date());
    const id = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const iniciarRegistro = (tipo: 'entrada' | 'saida') => {
    setTipoSelecionado(tipo);
    setEtapa('assinatura');
  };

  const confirmarComAssinatura = async (assinatura: string) => {
    if (!tipoSelecionado) return;
    setRegistrando(true);
    try {
      const body: any = { token, identificador: identificador.trim(), tipo: tipoSelecionado, assinatura };
      if (geo) { body.latitude = geo.lat; body.longitude = geo.lon; }
      const res = await fetch(`${API}/gente/ponto/externo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Erro.'); }
      toast.success(`${tipoSelecionado === 'entrada' ? 'Entrada' : 'Saída'} registrada!`);
      onRegistrado(tipoSelecionado);
      setEtapa('botoes');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao registrar ponto.');
      setEtapa('botoes');
    } finally {
      setRegistrando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={onVoltar} className="text-purple-400 hover:text-white transition text-xl">←</button>
        <h2 className="text-white font-black text-lg">Marcar Ponto</h2>
      </div>

      <div className="bg-purple-900/40 border border-purple-700/50 rounded-2xl p-4 text-center">
        <div className="text-3xl font-black text-white tabular-nums">
          {agora?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
        <div className="text-purple-300 text-xs mt-1">
          {agora?.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
        </div>
      </div>

      {(() => {
        const status = calcStatusGeofence(geo, colaborador);
        if (!geo) return (
          <div className="bg-orange-900/30 text-orange-300 border border-orange-700/40 rounded-xl px-3 py-2 text-xs font-semibold flex items-center gap-2">
            <span>⚠️</span>
            <span>{geoErro || 'Obtendo localização...'}</span>
            <button onClick={obterGeo} className="ml-auto underline">Retry</button>
          </div>
        );
        if (status.dentro === false && status.distancia !== null) return (
          <div className="bg-red-900/40 border-2 border-red-500 rounded-xl p-4 text-center animate-pulse">
            <div className="text-red-400 text-xs font-bold uppercase tracking-widest mb-1">⛔ Fora da área permitida</div>
            <div className="text-white font-black text-3xl tabular-nums">
              {status.distancia >= 1000
                ? `${(status.distancia / 1000).toFixed(1)} km`
                : `${status.distancia} m`}
            </div>
            <div className="text-red-300 text-xs mt-1">de distância {status.local ? `do ${status.local}` : 'do local permitido'}</div>
            <div className="text-red-400 text-xs mt-2">O registro de ponto será recusado nesta localização.</div>
          </div>
        );
        if (status.dentro === true) return (
          <div className="bg-green-900/30 text-green-300 border border-green-700/40 rounded-xl px-3 py-2 text-xs font-semibold flex items-center gap-2">
            <span>✅</span>
            <span>Dentro da área{status.local ? ` — ${status.local}` : ''} ({status.distancia}m)</span>
          </div>
        );
        return (
          <div className="bg-green-900/30 text-green-300 border border-green-700/40 rounded-xl px-3 py-2 text-xs font-semibold flex items-center gap-2">
            <span>📍</span>
            <span>{geo.lat.toFixed(4)}, {geo.lon.toFixed(4)}</span>
          </div>
        );
      })()}

      {colaborador.ultimo_ponto && (
        <div className="text-xs text-purple-400 text-center">
          Último: <span className={`font-bold ${colaborador.ultimo_ponto.tipo === 'entrada' ? 'text-green-400' : 'text-red-400'}`}>
            {colaborador.ultimo_ponto.tipo.toUpperCase()}
          </span> às {new Date(colaborador.ultimo_ponto.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      {etapa === 'botoes' ? (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => iniciarRegistro('entrada')} disabled={tipoProximo !== 'entrada'}
            className={`rounded-xl py-5 font-black uppercase tracking-widest text-sm transition ${
              tipoProximo === 'entrada' ? 'bg-green-500 text-white hover:bg-green-400' : 'bg-green-900/20 text-green-800 cursor-not-allowed'
            }`}>✅ Entrada</button>
          <button onClick={() => iniciarRegistro('saida')} disabled={tipoProximo !== 'saida'}
            className={`rounded-xl py-5 font-black uppercase tracking-widest text-sm transition ${
              tipoProximo === 'saida' ? 'bg-red-500 text-white hover:bg-red-400' : 'bg-red-900/20 text-red-800 cursor-not-allowed'
            }`}>🔴 Saída</button>
        </div>
      ) : (
        <div className="bg-white/5 border border-purple-700/40 rounded-2xl p-4">
          <p className="text-white text-sm font-bold text-center mb-3">
            Confirmando {tipoSelecionado === 'entrada' ? '✅ Entrada' : '🔴 Saída'}
          </p>
          {registrando ? (
            <p className="text-center text-purple-400 text-sm">Registrando...</p>
          ) : (
            <SignaturePad onConfirm={confirmarComAssinatura} onCancel={() => setEtapa('botoes')} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────

export default function PontoExternoPage() {
  const [token, setToken] = useState('');
  const [identificador, setIdentificador] = useState('');
  const [colaborador, setColaborador] = useState<ColaboradorInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [geo, setGeo] = useState<{ lat: number; lon: number } | null>(null);
  const [geoErro, setGeoErro] = useState('');
  const [tela, setTela] = useState<Tela>('login');
  const [agora, setAgora] = useState<Date | null>(null);

  useEffect(() => {
    setAgora(new Date());
    const id = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get('token') || PONTO_TOKEN);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const obterGeo = useCallback(() => {
    if (!navigator.geolocation) { setGeoErro('Geolocalização não disponível.'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => { setGeo({ lat: pos.coords.latitude, lon: pos.coords.longitude }); setGeoErro(''); },
      () => setGeoErro('Não foi possível obter localização.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  useEffect(() => { obterGeo(); }, [obterGeo]);

  const buscarColaborador = async () => {
    if (!identificador.trim()) { toast.error('Informe seu CPF ou matrícula.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/gente/ponto/externo/verificar?token=${encodeURIComponent(token)}&identificador=${encodeURIComponent(identificador.trim())}`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Não encontrado.'); }
      setColaborador(await res.json());
      setTela('menu');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao buscar colaborador.');
    } finally {
      setLoading(false);
    }
  };

  const sair = () => { setColaborador(null); setIdentificador(''); setTela('login'); };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#1a0b2e] px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-black italic text-white tracking-tighter">
            ITP <span className="text-yellow-400">ERP</span>
          </h1>
          <p className="text-purple-300 text-sm mt-1 font-semibold uppercase tracking-widest">
            {tela === 'login' ? 'Registro de Ponto' : colaborador?.nome ?? ''}
          </p>
        </div>

        {/* Relógio (só na tela de login e menu) */}
        {(tela === 'login' || tela === 'menu') && (
          <div className="bg-purple-900/40 border border-purple-700/50 rounded-2xl p-4 text-center mb-5">
            <div className="text-4xl font-black text-white tabular-nums">
              {agora?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-purple-300 text-sm mt-1">
              {agora?.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
          </div>
        )}

        {/* Tela: Login */}
        {tela === 'login' && (
          <>
            <div className={`rounded-xl px-4 py-2 text-xs font-semibold mb-5 flex items-center gap-2 ${
              geo ? 'bg-green-900/30 text-green-300 border border-green-700/40' : 'bg-orange-900/30 text-orange-300 border border-orange-700/40'
            }`}>
              <span>{geo ? '📍' : '⚠️'}</span>
              <span>{geo ? `Localização obtida` : geoErro || 'Obtendo localização...'}</span>
              {!geo && <button onClick={obterGeo} className="ml-auto text-orange-400 underline text-xs">Tentar novamente</button>}
            </div>
            <div className="bg-white/5 border border-purple-700/40 rounded-2xl p-6 space-y-4">
              <label className="block text-purple-200 text-sm font-bold uppercase tracking-widest">CPF ou Matrícula</label>
              <input type="text" value={identificador} onChange={e => setIdentificador(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && buscarColaborador()}
                placeholder="Ex: 123.456.789-00"
                className="w-full bg-purple-950/60 border border-purple-700/50 text-white placeholder-purple-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              <button onClick={buscarColaborador} disabled={loading}
                className="w-full bg-yellow-400 text-purple-950 font-black uppercase tracking-widest rounded-xl py-3 text-sm hover:bg-yellow-300 transition disabled:opacity-50">
                {loading ? 'Buscando...' : 'Identificar'}
              </button>
            </div>
          </>
        )}

        {/* Tela: Menu */}
        {tela === 'menu' && colaborador && (
          <div className="space-y-3">
            <div className="bg-white/5 border border-purple-700/40 rounded-2xl p-4 flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center text-purple-950 font-black">
                {colaborador.nome.charAt(0)}
              </div>
              <div>
                <div className="text-white font-bold text-sm">{colaborador.nome}</div>
                <div className="text-purple-400 text-xs">{colaborador.matricula}</div>
              </div>
              {colaborador.ultimo_ponto && (
                <div className="ml-auto text-xs text-right">
                  <div className={`font-bold ${colaborador.ultimo_ponto.tipo === 'entrada' ? 'text-green-400' : 'text-red-400'}`}>
                    {colaborador.ultimo_ponto.tipo.toUpperCase()}
                  </div>
                  <div className="text-purple-500">
                    {new Date(colaborador.ultimo_ponto.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              )}
            </div>

            {[
              { label: '📍 Marcar Ponto', sub: colaborador.ultimo_ponto?.tipo === 'entrada' ? 'Próximo: Saída' : 'Próximo: Entrada', tela: 'ponto' as Tela, cor: 'bg-yellow-400 text-purple-950 hover:bg-yellow-300' },
              { label: '⏱️ Banco de Horas', sub: 'Consultar saldo de horas', tela: 'banco' as Tela, cor: 'bg-white/5 border border-purple-700/40 text-white hover:bg-white/10' },
              { label: '📋 Histórico', sub: 'Ver marcações anteriores', tela: 'historico' as Tela, cor: 'bg-white/5 border border-purple-700/40 text-white hover:bg-white/10' },
              { label: '🏖️ Solicitar Folga', sub: 'Agendar dia de descanso', tela: 'folga' as Tela, cor: 'bg-white/5 border border-purple-700/40 text-white hover:bg-white/10' },
            ].map(item => (
              <button key={item.tela} onClick={() => setTela(item.tela)}
                className={`w-full rounded-2xl px-5 py-4 text-left transition font-bold ${item.cor}`}>
                <div className="text-sm">{item.label}</div>
                <div className="text-xs opacity-70 font-normal mt-0.5">{item.sub}</div>
              </button>
            ))}

            <button onClick={sair} className="w-full text-purple-400 text-xs py-2 hover:text-white transition">← Trocar usuário</button>
          </div>
        )}

        {/* Tela: Marcar Ponto */}
        {tela === 'ponto' && colaborador && (
          <div className="bg-white/5 border border-purple-700/40 rounded-2xl p-5">
            <TelaMarcarPonto
              colaborador={colaborador}
              geo={geo}
              geoErro={geoErro}
              obterGeo={obterGeo}
              token={token}
              identificador={identificador}
              onVoltar={() => setTela('menu')}
              onRegistrado={tipo => setColaborador(prev => prev ? { ...prev, ultimo_ponto: { tipo, data_hora: new Date().toISOString() } } : prev)}
            />
          </div>
        )}

        {/* Tela: Banco de Horas */}
        {tela === 'banco' && colaborador && (
          <div className="bg-white/5 border border-purple-700/40 rounded-2xl p-5">
            <TelaBancoHoras colaborador={colaborador} onVoltar={() => setTela('menu')} />
          </div>
        )}

        {/* Tela: Histórico */}
        {tela === 'historico' && colaborador && (
          <div className="bg-white/5 border border-purple-700/40 rounded-2xl p-5">
            <TelaHistorico colaborador={colaborador} onVoltar={() => setTela('menu')} />
          </div>
        )}

        {/* Tela: Solicitar Folga */}
        {tela === 'folga' && colaborador && (
          <div className="bg-white/5 border border-purple-700/40 rounded-2xl p-5">
            <TelaFolga colaborador={colaborador} onVoltar={() => setTela('menu')} />
          </div>
        )}

        <p className="text-center text-purple-600 text-xs mt-6">Instituto Tiapretinha · Sistema ERP</p>
      </div>
    </div>
  );
}
