'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';
const PONTO_TOKEN = 'itp-ponto-2026';

interface ColaboradorInfo {
  colaborador_id: string;
  nome: string;
  matricula: string;
  horario_entrada: string | null;
  horario_saida: string | null;
  latitude_permitida: number | null;
  longitude_permitida: number | null;
  raio_metros: number;
  ultimo_ponto: { tipo: string; data_hora: string } | null;
}

export default function PontoExternoPage() {
  const [token, setToken] = useState('');
  const [identificador, setIdentificador] = useState('');
  const [colaborador, setColaborador] = useState<ColaboradorInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [geo, setGeo] = useState<{ lat: number; lon: number } | null>(null);
  const [geoErro, setGeoErro] = useState('');
  const [agora, setAgora] = useState(new Date());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token') || PONTO_TOKEN;
    setToken(t);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const obterGeo = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoErro('Geolocalização não disponível neste dispositivo.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setGeo({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setGeoErro('');
      },
      () => setGeoErro('Não foi possível obter sua localização. Verifique as permissões.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  useEffect(() => { obterGeo(); }, [obterGeo]);

  const buscarColaborador = async () => {
    if (!identificador.trim()) {
      toast.error('Informe seu CPF ou matrícula.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `${API}/gente/ponto/externo/verificar?token=${encodeURIComponent(token)}&identificador=${encodeURIComponent(identificador.trim())}`,
      );
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.message || 'Não encontrado.');
      }
      const data = await res.json();
      setColaborador(data);
      obterGeo();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao buscar colaborador.');
    } finally {
      setLoading(false);
    }
  };

  const registrarPonto = async (tipo: 'entrada' | 'saida') => {
    if (!colaborador) return;
    setRegistrando(true);
    try {
      const body: any = {
        token,
        identificador: identificador.trim(),
        tipo,
      };
      if (geo) {
        body.latitude = geo.lat;
        body.longitude = geo.lon;
      }
      const res = await fetch(`${API}/gente/ponto/externo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.message || 'Erro ao registrar ponto.');
      }
      toast.success(`${tipo === 'entrada' ? 'Entrada' : 'Saída'} registrada com sucesso!`);
      setColaborador(prev => prev ? { ...prev, ultimo_ponto: { tipo, data_hora: new Date().toISOString() } } : prev);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao registrar ponto.');
    } finally {
      setRegistrando(false);
    }
  };

  const formatHora = (iso: string) =>
    new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const tipoProximo = colaborador?.ultimo_ponto?.tipo === 'entrada' ? 'saida' : 'entrada';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#1a0b2e] px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black italic text-white tracking-tighter">
            ITP <span className="text-yellow-400">ERP</span>
          </h1>
          <p className="text-purple-300 text-sm mt-1 font-semibold uppercase tracking-widest">Registro de Ponto</p>
        </div>

        {/* Relógio */}
        <div className="bg-purple-900/40 border border-purple-700/50 rounded-2xl p-5 text-center mb-6">
          <div className="text-4xl font-black text-white tabular-nums">
            {agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="text-purple-300 text-sm mt-1">
            {agora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        </div>

        {/* Geolocalização */}
        <div className={`rounded-xl px-4 py-2 text-xs font-semibold mb-5 flex items-center gap-2 ${
          geo ? 'bg-green-900/30 text-green-300 border border-green-700/40' : 'bg-orange-900/30 text-orange-300 border border-orange-700/40'
        }`}>
          <span>{geo ? '📍' : '⚠️'}</span>
          <span>
            {geo
              ? `Localização obtida (${geo.lat.toFixed(5)}, ${geo.lon.toFixed(5)})`
              : geoErro || 'Obtendo localização...'}
          </span>
          {!geo && (
            <button onClick={obterGeo} className="ml-auto text-orange-400 underline text-xs">Tentar novamente</button>
          )}
        </div>

        {!colaborador ? (
          /* Formulário de identificação */
          <div className="bg-white/5 border border-purple-700/40 rounded-2xl p-6 space-y-4">
            <label className="block text-purple-200 text-sm font-bold uppercase tracking-widest mb-1">
              CPF ou Matrícula
            </label>
            <input
              type="text"
              value={identificador}
              onChange={e => setIdentificador(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && buscarColaborador()}
              placeholder="Ex: 123.456.789-00 ou ITP-FUNC-202503-001"
              className="w-full bg-purple-950/60 border border-purple-700/50 text-white placeholder-purple-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
            <button
              onClick={buscarColaborador}
              disabled={loading}
              className="w-full bg-yellow-400 text-purple-950 font-black uppercase tracking-widest rounded-xl py-3 text-sm hover:bg-yellow-300 transition disabled:opacity-50"
            >
              {loading ? 'Buscando...' : 'Identificar'}
            </button>
          </div>
        ) : (
          /* Painel do colaborador */
          <div className="space-y-4">
            <div className="bg-white/5 border border-purple-700/40 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-yellow-400 flex items-center justify-center text-purple-950 font-black text-lg">
                  {colaborador.nome.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-white font-bold">{colaborador.nome}</div>
                  <div className="text-purple-400 text-xs">{colaborador.matricula}</div>
                </div>
              </div>

              {colaborador.horario_entrada && (
                <div className="text-purple-300 text-xs mb-3">
                  Horário: <span className="text-white font-semibold">{colaborador.horario_entrada}</span> →{' '}
                  <span className="text-white font-semibold">{colaborador.horario_saida}</span>
                </div>
              )}

              {colaborador.ultimo_ponto && (
                <div className="text-xs text-purple-400 mb-3">
                  Último registro:{' '}
                  <span className={`font-bold ${colaborador.ultimo_ponto.tipo === 'entrada' ? 'text-green-400' : 'text-red-400'}`}>
                    {colaborador.ultimo_ponto.tipo.toUpperCase()}
                  </span>{' '}
                  às {formatHora(colaborador.ultimo_ponto.data_hora)}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mt-4">
                <button
                  onClick={() => registrarPonto('entrada')}
                  disabled={registrando || tipoProximo !== 'entrada'}
                  className={`rounded-xl py-4 font-black uppercase tracking-widest text-sm transition ${
                    tipoProximo === 'entrada'
                      ? 'bg-green-500 text-white hover:bg-green-400'
                      : 'bg-green-900/30 text-green-700 cursor-not-allowed'
                  } disabled:opacity-60`}
                >
                  ✅ Entrada
                </button>
                <button
                  onClick={() => registrarPonto('saida')}
                  disabled={registrando || tipoProximo !== 'saida'}
                  className={`rounded-xl py-4 font-black uppercase tracking-widest text-sm transition ${
                    tipoProximo === 'saida'
                      ? 'bg-red-500 text-white hover:bg-red-400'
                      : 'bg-red-900/30 text-red-700 cursor-not-allowed'
                  } disabled:opacity-60`}
                >
                  🔴 Saída
                </button>
              </div>
            </div>

            <button
              onClick={() => { setColaborador(null); setIdentificador(''); }}
              className="w-full text-purple-400 text-xs py-2 hover:text-white transition"
            >
              ← Trocar usuário
            </button>
          </div>
        )}

        <p className="text-center text-purple-600 text-xs mt-8">
          Instituto Tiapretinha · Sistema ERP
        </p>
      </div>
    </div>
  );
}
