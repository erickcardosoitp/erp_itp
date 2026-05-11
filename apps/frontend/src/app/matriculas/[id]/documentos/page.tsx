'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { DocumentoCard, type DocumentoValidacao } from '@/components/documentos/DocumentoCard';

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

const LABELS: Record<string, string> = {
  comprovante_inscricao: 'Comprovante de Inscrição',
  comprovante_bancario:  'Comprovante Bancário',
  selfie:                'Selfie',
  identidade_frente:     'Identidade (Frente)',
  identidade_verso:      'Identidade (Verso)',
};

interface Sumario {
  total: number;
  aprovados: number;
  pendencias: number;
  aguardando: number;
  concluido: boolean;
  docs: DocumentoValidacao[];
}

async function fetchSumario(alunoId: string): Promise<Sumario> {
  const res = await fetch(`${API}/api/alunos/${alunoId}/documentos/sumario`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Erro ao carregar documentos');
  return res.json();
}

export default function DocumentosValidacaoPage() {
  const { id: alunoId } = useParams<{ id: string }>();
  const [sumario, setSumario]   = useState<Sumario | null>(null);
  const [loading, setLoading]   = useState(true);

  const carregar = useCallback(async () => {
    try {
      const data = await fetchSumario(alunoId);
      setSumario(data);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [alunoId]);

  useEffect(() => { carregar(); }, [carregar]);

  const handleAtualizado = (atualizado: DocumentoValidacao) => {
    setSumario(prev => {
      if (!prev) return prev;
      const docs = prev.docs.map(d => d.id === atualizado.id ? atualizado : d);
      const aprovados  = docs.filter(d => d.status === 'aprovado').length;
      const pendencias = docs.filter(d => d.status === 'pendencia').length;
      const aguardando = docs.filter(d => d.status === 'aguardando').length;
      return { ...prev, docs, aprovados, pendencias, aguardando, concluido: aprovados === docs.length };
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-muted-foreground text-sm">
        Carregando documentos…
      </div>
    );
  }

  if (!sumario) return null;

  const { docs, aprovados, total, pendencias, aguardando, concluido } = sumario;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      {/* Cabeçalho + progresso */}
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Validação de Documentos</h1>
        <p className="text-sm text-muted-foreground">
          {aprovados}/{total} documentos aprovados
          {pendencias > 0 && ` · ${pendencias} com pendência`}
          {aguardando > 0 && ` · ${aguardando} aguardando revisão`}
        </p>
        {/* Barra de progresso */}
        <div className="h-2 w-full rounded-full bg-muted">
          <div
            className="h-2 rounded-full bg-green-500 transition-all"
            style={{ width: `${(aprovados / total) * 100}%` }}
          />
        </div>
        {concluido && (
          <p className="text-xs font-medium text-green-600">
            ✓ Todos os documentos foram aprovados
          </p>
        )}
      </div>

      {/* Grid de cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {docs.map(doc => (
          <DocumentoCard
            key={doc.id}
            doc={doc}
            label={LABELS[doc.tipo] ?? doc.tipo}
            alunoId={alunoId}
            isAdmin
            onAtualizado={handleAtualizado}
          />
        ))}
      </div>
    </div>
  );
}
