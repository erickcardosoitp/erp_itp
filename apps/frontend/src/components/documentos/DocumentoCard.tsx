'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Card, CardContent, CardHeader, CardTitle, CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ── Tipos ─────────────────────────────────────────────────────────

export type StatusDocumento = 'pendente' | 'aguardando' | 'aprovado' | 'pendencia';

export interface DocumentoValidacao {
  id: string;
  tipo: string;
  url_drive: string | null;
  status: StatusDocumento;
  motivo_pendencia: string | null;
  validado_por_nome: string | null;
  validado_em: string | null;
}

interface Props {
  doc: DocumentoValidacao;
  label: string;
  alunoId: string;
  isAdmin?: boolean;
  onAtualizado?: (doc: DocumentoValidacao) => void;
}

// ── Helpers visuais ───────────────────────────────────────────────

const STATUS_CONFIG: Record<StatusDocumento, { label: string; className: string }> = {
  pendente:    { label: 'Pendente',     className: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
  aguardando:  { label: 'Aguardando',   className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' },
  aprovado:    { label: 'Aprovado',     className: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
  pendencia:   { label: 'Com pendência', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
};

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

async function apiPatch(url: string, body: object) {
  const res = await fetch(url, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message ?? 'Erro na requisição');
  }
  return res.json();
}

async function apiPost(url: string, body: object) {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message ?? 'Erro na requisição');
  }
  return res.json();
}

// ── Componente ────────────────────────────────────────────────────

export function DocumentoCard({ doc, label, alunoId, isAdmin = false, onAtualizado }: Props) {
  const [urlInput, setUrlInput]         = useState('');
  const [motivo, setMotivo]             = useState('');
  const [loading, setLoading]           = useState<string | null>(null);
  const [showInvalidar, setShowInvalidar] = useState(false);

  const config = STATUS_CONFIG[doc.status] ?? STATUS_CONFIG.pendente;

  const handleEnviar = async () => {
    if (!urlInput.trim()) return toast.error('Informe o link do Drive');
    setLoading('enviar');
    try {
      const atualizado = await apiPost(`${API}/api/alunos/${alunoId}/documentos`, {
        tipo: doc.tipo,
        url_drive: urlInput.trim(),
      });
      onAtualizado?.(atualizado);
      setUrlInput('');
      toast.success('Documento enviado para validação');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(null);
    }
  };

  const handleValidar = async () => {
    setLoading('validar');
    try {
      const atualizado = await apiPatch(
        `${API}/api/alunos/${alunoId}/documentos/${doc.id}/validar`,
        {},
      );
      onAtualizado?.(atualizado);
      toast.success('Documento aprovado');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(null);
    }
  };

  const handleInvalidar = async () => {
    if (!motivo.trim()) return toast.error('Informe o motivo da pendência');
    setLoading('invalidar');
    try {
      const atualizado = await apiPatch(
        `${API}/api/alunos/${alunoId}/documentos/${doc.id}/invalidar`,
        { motivo_pendencia: motivo.trim() },
      );
      onAtualizado?.(atualizado);
      setMotivo('');
      setShowInvalidar(false);
      toast.success('Pendência registrada — aluno será solicitado a reenviar');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card size="sm" className="w-full">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">{label}</CardTitle>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}>
            {config.label}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-2 pt-3">
        {/* Link atual */}
        {doc.url_drive ? (
          <a
            href={doc.url_drive}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-xs text-blue-600 underline underline-offset-2 hover:text-blue-800 dark:text-blue-400"
          >
            {doc.url_drive}
          </a>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum arquivo enviado</p>
        )}

        {/* Motivo de pendência */}
        {doc.status === 'pendencia' && doc.motivo_pendencia && (
          <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
            <span className="font-medium">Motivo: </span>{doc.motivo_pendencia}
          </div>
        )}

        {/* Aluno: enviar / reenviar link */}
        {!isAdmin && doc.status !== 'aprovado' && (
          <div className="flex gap-2">
            <Input
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              placeholder="Cole o link do Google Drive…"
              className="h-8 text-xs"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 shrink-0 text-xs"
              disabled={loading === 'enviar'}
              onClick={handleEnviar}
            >
              {loading === 'enviar' ? 'Enviando…' : doc.status === 'pendencia' ? 'Reenviar' : 'Enviar'}
            </Button>
          </div>
        )}

        {/* Admin: formulário de invalidação */}
        {isAdmin && showInvalidar && (
          <div className="space-y-1.5">
            <Label className="text-xs">Motivo da pendência</Label>
            <Input
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Ex.: Foto ilegível, documento cortado…"
              className="h-8 text-xs"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-xs"
                disabled={loading === 'invalidar'}
                onClick={handleInvalidar}
              >
                {loading === 'invalidar' ? 'Salvando…' : 'Confirmar Pendência'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setShowInvalidar(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Admin: botões de validação */}
      {isAdmin && doc.status !== 'pendente' && !showInvalidar && (
        <CardFooter className="gap-2">
          {doc.status !== 'aprovado' && (
            <Button
              size="sm"
              variant="default"
              className="h-7 bg-green-600 text-xs hover:bg-green-700"
              disabled={loading === 'validar' || !doc.url_drive}
              onClick={handleValidar}
            >
              {loading === 'validar' ? 'Validando…' : '✓ Validar'}
            </Button>
          )}
          {doc.status !== 'aprovado' && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-red-300 text-xs text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
              onClick={() => setShowInvalidar(true)}
            >
              ✕ Invalidar
            </Button>
          )}
          {doc.status === 'aprovado' && (
            <span className="text-xs text-muted-foreground">
              Aprovado por {doc.validado_por_nome ?? 'admin'} em{' '}
              {doc.validado_em ? new Date(doc.validado_em).toLocaleDateString('pt-BR') : '—'}
            </span>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
