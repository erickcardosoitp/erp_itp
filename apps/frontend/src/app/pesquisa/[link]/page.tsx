'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Star, CheckCircle, AlertTriangle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '/backend-api';

interface Pergunta { id: string; texto: string; tipo: 'nota' | 'texto'; }
interface Pesquisa { id: string; titulo: string; tipo: string; perguntas: Pergunta[]; data_limite?: string; }
interface Resposta { pergunta_id: string; nota?: number; texto?: string; }

export default function PesquisaPublicaPage() {
  const params = useParams();
  const link = params?.link as string;

  const [pesquisa, setPesquisa] = useState<Pesquisa | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [respostas, setRespostas] = useState<Record<string, Resposta>>({});
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    if (!link) return;
    fetch(`${API_URL}/pesquisas/publica/${link}`)
      .then(r => {
        if (!r.ok) return r.json().then(d => { throw new Error(d?.message || 'Pesquisa indisponível'); });
        return r.json();
      })
      .then(data => { setPesquisa(data); setLoading(false); })
      .catch(err => { setErro(err.message); setLoading(false); });
  }, [link]);

  const setNota = (perguntaId: string, nota: number) => {
    setRespostas(prev => ({ ...prev, [perguntaId]: { pergunta_id: perguntaId, nota } }));
  };

  const setTexto = (perguntaId: string, texto: string) => {
    setRespostas(prev => ({ ...prev, [perguntaId]: { pergunta_id: perguntaId, texto } }));
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pesquisa) return;

    // Validar que todas as perguntas de nota foram respondidas
    const perguntasSemResposta = pesquisa.perguntas.filter(p => {
      const r = respostas[p.id];
      if (p.tipo === 'nota') return !r?.nota;
      return false;
    });
    if (perguntasSemResposta.length > 0) {
      alert('Por favor, responda todas as perguntas de avaliação.');
      return;
    }

    setEnviando(true);
    try {
      const lista = pesquisa.perguntas.map(p => respostas[p.id] || { pergunta_id: p.id });
      const r = await fetch(`${API_URL}/pesquisas/publica/${link}/responder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respostas: lista }),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d?.message || 'Erro ao enviar resposta');
      }
      setSucesso(true);
    } catch (err: any) {
      alert(err.message || 'Erro ao enviar resposta');
    } finally {
      setEnviando(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-slate-100">
        <div className="text-slate-400 text-sm">Carregando pesquisa...</div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-slate-100 p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center space-y-4">
          <AlertTriangle size={40} className="mx-auto text-red-400" />
          <h2 className="font-black text-lg text-slate-800">Pesquisa Indisponível</h2>
          <p className="text-sm text-slate-500">{erro}</p>
        </div>
      </div>
    );
  }

  if (sucesso) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-slate-100 p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center space-y-4">
          <CheckCircle size={48} className="mx-auto text-green-500" />
          <h2 className="font-black text-xl text-slate-800">Obrigado!</h2>
          <p className="text-sm text-slate-500">Sua resposta foi registrada com sucesso de forma anônima.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-slate-100 p-4 flex items-start justify-center pt-12 pb-16">
      <div className="w-full max-w-xl space-y-6">
        {/* Cabeçalho */}
        <div className="text-center space-y-2">
          <div className="inline-block bg-purple-600 text-white text-[9px] font-black uppercase px-3 py-1 rounded-full mb-2">
            Pesquisa Anônima · {pesquisa?.tipo}
          </div>
          <h1 className="text-2xl font-black text-slate-800">{pesquisa?.titulo}</h1>
          {pesquisa?.data_limite && (
            <p className="text-[10px] text-slate-400">Prazo: {new Date(pesquisa.data_limite).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
          )}
          <p className="text-[10px] text-slate-400">Suas respostas são completamente anônimas.</p>
        </div>

        {/* Formulário */}
        <form onSubmit={enviar} className="space-y-4">
          {pesquisa?.perguntas.map((p, i) => (
            <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
              <p className="font-bold text-sm text-slate-800">
                <span className="text-purple-500 font-black mr-2">{i + 1}.</span>
                {p.texto}
              </p>

              {p.tipo === 'nota' ? (
                <div className="flex gap-2 justify-center py-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} type="button" onClick={() => setNota(p.id, n)}
                      className="group flex flex-col items-center gap-1 transition-all">
                      <Star
                        size={36}
                        className={`transition-all ${(respostas[p.id]?.nota ?? 0) >= n
                          ? 'text-amber-400 fill-amber-400 scale-110'
                          : 'text-slate-200 group-hover:text-amber-300'}`}
                      />
                      <span className="text-[9px] text-slate-400 font-bold">{n}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <textarea
                  value={respostas[p.id]?.texto || ''}
                  onChange={e => setTexto(p.id, e.target.value)}
                  rows={3}
                  placeholder="Escreva sua resposta aqui..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
                />
              )}
            </div>
          ))}

          <button type="submit" disabled={enviando}
            className="w-full bg-purple-600 text-white py-3 rounded-2xl font-black text-sm uppercase disabled:opacity-50 hover:bg-purple-700 shadow-md transition-all">
            {enviando ? 'Enviando...' : 'Enviar Resposta'}
          </button>
        </form>

        <p className="text-center text-[9px] text-slate-300">Instituto Tiapretinha · Sistema ITP</p>
      </div>
    </div>
  );
}
