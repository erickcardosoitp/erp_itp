'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';
const PONTO_TOKEN = 'itp-ponto-2026';

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
    const clientX = 'clientX' in e ? e.clientX : e.clientX;
    const clientY = 'clientY' in e ? e.clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
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
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);

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
  const [data, setData] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [minData, setMinData] = useState('');
  const DIAS_OK = ['Segunda', 'Quinta', 'Sexta'];

  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    setMinData(d.toISOString().split('T')[0]);
  }, []);

  const solicitar = async () => {
    if (!data) return toast.error('Selecione uma data.');
    setEnviando(true);
    try {
      const r = await fetch(`${API}/gente/folgas/solicitar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colaborador_id: colaborador.colaborador_id, data }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.message || 'Erro ao solicitar folga.');
      toast.success('Folga solicitada com sucesso! Aguarde aprovação.');
      setData('');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={onVoltar} className="text-purple-400 hover:text-white transition text-xl">←</button>
        <h2 className="text-white font-black text-lg">Solicitar Folga</h2>
      </div>
      <div className="bg-purple-900/30 border border-purple-700/40 rounded-xl p-4 text-xs text-purple-300 space-y-1">
        <p>📋 <strong className="text-white">Regras:</strong></p>
        <p>· Dias disponíveis: {DIAS_OK.join(', ')}</p>
        <p>· Mínimo 10 dias de antecedência</p>
        <p>· Máximo 1 folga por semana por colaborador</p>
        <p>· Máximo 2 folgas por semana no total</p>
        <p>· Débito de horas no mês anterior bloqueia folgas por 1 mês</p>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-bold text-purple-300 uppercase tracking-widest">Data da folga</label>
        <input type="date" value={data} min={minData} onChange={e => setData(e.target.value)}
          className="w-full bg-purple-950/60 border border-purple-700/50 text-white rounded-xl px-4 py-3 text-sm" />
      </div>
      <button onClick={solicitar} disabled={enviando || !data}
        className="w-full bg-yellow-400 text-purple-950 font-black uppercase tracking-widest rounded-xl py-3 text-sm hover:bg-yellow-300 transition disabled:opacity-50">
        {enviando ? 'Enviando...' : 'Solicitar Folga'}
      </button>
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
  const [agora, setAgora] = useState(new Date());

  useEffect(() => {
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
          {agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
        <div className="text-purple-300 text-xs mt-1">
          {agora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
        </div>
      </div>

      <div className={`rounded-xl px-3 py-2 text-xs font-semibold flex items-center gap-2 ${
        geo ? 'bg-green-900/30 text-green-300 border border-green-700/40' : 'bg-orange-900/30 text-orange-300 border border-orange-700/40'
      }`}>
        <span>{geo ? '📍' : '⚠️'}</span>
        <span>{geo ? `${geo.lat.toFixed(4)}, ${geo.lon.toFixed(4)}` : geoErro || 'Obtendo localização...'}</span>
        {!geo && <button onClick={obterGeo} className="ml-auto underline">Retry</button>}
      </div>

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
  const [agora, setAgora] = useState(new Date());

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
              {agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-purple-300 text-sm mt-1">
              {agora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
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
