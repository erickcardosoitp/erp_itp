'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TipoDocumento =
  | 'foto_aluno'
  | 'identidade'
  | 'comprovante_residencia'
  | 'certidao_nascimento'
  | 'identidade_responsavel'
  | 'declaracao_escolaridade'
  | 'extra';

interface DocumentoEnviado {
  id: string;
  tipo: TipoDocumento;
  nome_extra: string | null;
  url_arquivo: string;
  mimetype: string | null;
  tamanho_bytes: number | null;
  createdAt: string;
}

interface StatusResponse {
  inscricao: {
    id: number;
    nome_completo: string;
    status_matricula: string;
    maior_18_anos: boolean;
  };
  documentos: DocumentoEnviado[];
  tipos_enviados: string[];
  obrigatorios_pendentes: string[];
  completo: boolean;
}

// ─── Configuração dos documentos ──────────────────────────────────────────────

function getDocsObrigatorios(maior18: boolean): { tipo: TipoDocumento; label: string; desc: string }[] {
  const base: { tipo: TipoDocumento; label: string; desc: string }[] = [
    {
      tipo: 'identidade',
      label: 'Documento de Identidade',
      desc: 'RG, CNH ou CTPS do aluno',
    },
    {
      tipo: 'comprovante_residencia',
      label: 'Comprovante de Residência',
      desc: 'Conta de água, luz, gás ou fatura de cartão (últimos 3 meses)',
    },
  ];
  if (!maior18) {
    base.push({
      tipo: 'certidao_nascimento',
      label: 'Certidão de Nascimento',
      desc: 'Original ou cópia autenticada',
    });
    base.push({
      tipo: 'identidade_responsavel',
      label: 'Identidade do Responsável',
      desc: 'Para menores de 18 anos — RG ou CNH do responsável legal',
    });
  }
  return base;
}

const DOC_OPCIONAL: { tipo: TipoDocumento; label: string; desc: string } = {
  tipo: 'declaracao_escolaridade',
  label: 'Declaração de Escolaridade',
  desc: 'Declaração da escola atual (opcional)',
};

const DOC_FOTO_ALUNO = {
  tipo: 'foto_aluno' as TipoDocumento,
  label: 'Foto do Aluno',
  desc: 'Foto recente do rosto do aluno (frente, boa iluminação)',
};

// ─── Utilitários ──────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/backend-api';

async function fetchStatus(token: string): Promise<StatusResponse> {
  const res = await fetch(`${API}/matriculas/documentos/status/${token}`, { cache: 'no-store' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? 'Erro ao carregar dados.');
  }
  return res.json();
}

async function uploadFile(
  token: string,
  tipo: TipoDocumento,
  file: File,
  nomeExtra?: string,
): Promise<DocumentoEnviado> {
  const form = new FormData();
  form.append('arquivo', file);
  form.append('tipo', tipo);
  if (nomeExtra) form.append('nome_extra', nomeExtra);

  const res = await fetch(`${API}/matriculas/documentos/upload/${token}`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? 'Erro ao enviar arquivo.');
  }
  return res.json();
}

// ─── Componente de Foto ───────────────────────────────────────────────────────

interface FotoCardProps {
  enviado?: DocumentoEnviado;
  onUpload: (tipo: TipoDocumento, file: File) => Promise<void>;
  uploading: boolean;
}

function FotoCard({ enviado, onUpload, uploading }: FotoCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(enviado?.url_arquivo ?? null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    await onUpload('foto_aluno', file);
    if (inputRef.current) inputRef.current.value = '';
  };

  const apiOrigin = typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_BASE_URL ?? '/backend-api').replace('/backend-api', '')
    : '';
  const fotoSrc = enviado
    ? (enviado.url_arquivo.startsWith('http') ? enviado.url_arquivo : `${apiOrigin}${enviado.url_arquivo}`)
    : preview;

  return (
    <div className="rounded-2xl border-2 border-dashed border-blue-300 dark:border-blue-700 bg-blue-50/40 dark:bg-blue-900/10 p-6">
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Preview */}
        <div className="flex-shrink-0 w-32 h-32 rounded-2xl overflow-hidden border-4 border-white dark:border-gray-700 shadow-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
          {fotoSrc ? (
            <img src={fotoSrc} alt="Foto do aluno" className="w-full h-full object-cover" />
          ) : (
            <svg className="w-12 h-12 text-gray-300 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          )}
        </div>
        {/* Info */}
        <div className="flex-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
            <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${enviado ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
            <p className="font-bold text-gray-800 dark:text-gray-100 text-sm">
              Foto do Aluno
              {!enviado && <span className="text-red-500 text-xs font-normal align-top ml-0.5">*</span>}
            </p>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Foto recente do rosto do aluno, frente para a câmera, boa iluminação.<br />
            Formatos aceitos: JPG, PNG ou WebP. Máximo 8 MB.
          </p>
          {enviado && (
            <p className="text-xs text-green-600 dark:text-green-400 font-semibold mb-3">
              ✔ Foto enviada com sucesso!
            </p>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleChange}
            id="input-foto-aluno"
          />
          <label
            htmlFor="input-foto-aluno"
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-colors ${
              uploading
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : enviado
                ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400'
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
            }`}
            onClick={e => { if (uploading) e.preventDefault(); }}
          >
            {uploading ? (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
            {enviado ? 'Trocar Foto' : 'Enviar Foto'}
          </label>
        </div>
      </div>
    </div>
  );
}

// ─── Componente Foto Aluno ────────────────────────────────────────────────────

function FotoAlunoCard({
  apiOrigin,
  enviado,
  onUpload,
  uploading,
}: {
  apiOrigin: string;
  enviado?: DocumentoEnviado;
  onUpload: (tipo: TipoDocumento, file: File) => Promise<void>;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    await onUpload('foto_aluno', file);
    if (inputRef.current) inputRef.current.value = '';
  };

  const fotoSrc = enviado
    ? (enviado.url_arquivo.startsWith('http') ? enviado.url_arquivo : `${apiOrigin}${enviado.url_arquivo}`)
    : preview;

  return (
    <div className="rounded-2xl border-2 border-dashed border-blue-300 dark:border-blue-700 bg-blue-50/40 dark:bg-blue-900/10 p-6">
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Preview */}
        <div className="flex-shrink-0 w-32 h-32 rounded-2xl overflow-hidden border-4 border-white dark:border-gray-700 shadow-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
          {fotoSrc ? (
            <img src={fotoSrc} alt="Foto do aluno" className="w-full h-full object-cover" />
          ) : (
            <svg className="w-12 h-12 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          )}
        </div>
        {/* Info */}
        <div className="flex-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
            <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${enviado ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
            <p className="font-bold text-gray-800 dark:text-gray-100 text-sm">
              Foto do Aluno
              {!enviado && <span className="text-red-500 text-xs font-normal align-top ml-0.5">*</span>}
            </p>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Foto recente do rosto do aluno, frente para a câmera, boa iluminação.<br />
            Formatos aceitos: JPG, PNG ou WebP. Máximo 8 MB.
          </p>
          {enviado && (
            <p className="text-xs text-green-600 dark:text-green-400 font-semibold mb-3">✔ Foto enviada!</p>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleChange}
            id="input-foto-aluno"
          />
          <label
            htmlFor="input-foto-aluno"
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-colors ${
              uploading
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : enviado
                ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400'
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
            }`}
            onClick={e => { if (uploading) e.preventDefault(); }}
          >
            {uploading ? (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
            {enviado ? 'Trocar Foto' : 'Enviar Foto'}
          </label>
        </div>
      </div>
    </div>
  );
}

// ─── Componente de Upload Individual ─────────────────────────────────────────

interface DocCardProps {
  label: string;
  desc: string;
  tipo: TipoDocumento;
  obrigatorio: boolean;
  enviado?: DocumentoEnviado;
  nomeExtra?: string;
  onNomeExtraChange?: (nome: string) => void;
  onUpload: (tipo: TipoDocumento, file: File, nomeExtra?: string) => Promise<void>;
  uploading: boolean;
}

function DocCard({
  label,
  desc,
  tipo,
  obrigatorio,
  enviado,
  nomeExtra,
  onNomeExtraChange,
  onUpload,
  uploading,
}: DocCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await onUpload(tipo, file, nomeExtra);
    // reset input para permitir reenvio do mesmo nome
    if (inputRef.current) inputRef.current.value = '';
  };

  const isOk = !!enviado;
  const borderColor = isOk
    ? 'border-green-400'
    : obrigatorio
    ? 'border-yellow-400'
    : 'border-gray-300 dark:border-gray-600';

  return (
    <div
      className={`rounded-xl border-2 ${borderColor} bg-white dark:bg-gray-800 p-4 transition-colors`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                isOk
                  ? 'bg-green-500'
                  : obrigatorio
                  ? 'bg-yellow-500 animate-pulse'
                  : 'bg-gray-400'
              }`}
            />
            <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm leading-tight">
              {label}{' '}
              {obrigatorio && !isOk && (
                <span className="text-red-500 text-xs font-normal align-top">*</span>
              )}
            </p>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-5">{desc}</p>

          {tipo === 'extra' && onNomeExtraChange && (
            <input
              type="text"
              placeholder="Nome do documento"
              value={nomeExtra ?? ''}
              onChange={e => onNomeExtraChange(e.target.value)}
              className="mt-2 w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}

          {isOk && (
            <div className="mt-2 ml-5 flex items-center gap-2 text-xs text-green-700 dark:text-green-400">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>
                Enviado
                {enviado.tamanho_bytes ? ` · ${formatBytes(enviado.tamanho_bytes)}` : ''}
              </span>
            </div>
          )}
        </div>

        <div className="flex-shrink-0">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={handleChange}
            id={`input-${tipo}-${label}`}
          />
          <label
            htmlFor={`input-${tipo}-${label}`}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              uploading
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : isOk
                ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400'
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
            }`}
            onClick={e => {
              if (uploading) e.preventDefault();
              if (tipo === 'extra' && !nomeExtra?.trim()) {
                e.preventDefault();
                alert('Informe o nome do documento antes de enviar.');
              }
            }}
          >
            {uploading ? (
              <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            )}
            {isOk ? 'Reenviar' : 'Enviar'}
          </label>
        </div>
      </div>
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function DocumentosPage() {
  const { token } = useParams<{ token: string }>();

  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [uploadingTipo, setUploadingTipo] = useState<string | null>(null);
  const [uploadErro, setUploadErro] = useState<string | null>(null);
  const [concluido, setConcluido] = useState(false);

  // Nomes dos documentos extras
  const [nomesExtra, setNomesExtra] = useState<string[]>(['', '', '', '', '']);

  const carregar = useCallback(async () => {
    try {
      const data = await fetchStatus(token as string);
      setStatus(data);
      // concluido só é ativado quando o usuário clica "Concluir Envio" —
      // não ativamos automaticamente para que documentos opcionais possam ser enviados
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) carregar();
  }, [token, carregar]);

  const handleUpload = async (tipo: TipoDocumento, file: File, nomeExtra?: string) => {
    setUploadingTipo(tipo + (nomeExtra ?? ''));
    setUploadErro(null);
    try {
      await uploadFile(token as string, tipo, file, nomeExtra);
      await carregar();
    } catch (e: any) {
      setUploadErro(e.message);
    } finally {
      setUploadingTipo(null);
    }
  };

  const docEnviado = (tipo: TipoDocumento): DocumentoEnviado | undefined =>
    status?.documentos.find(d => d.tipo === tipo);

  const extrasEnviados = status?.documentos.filter(d => d.tipo === 'extra') ?? [];

  const apiOrigin = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '/backend-api').replace('/backend-api', '');

  // ── Render ──────────────────────────────────────────────────────────────────

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">Link Inválido</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{erro}</p>
          <p className="text-xs text-gray-400">
            Este link pode ter expirado ou ser inválido. Entre em contato com o Instituto Tiapretinha.
          </p>
        </div>
      </div>
    );
  }

  if (concluido) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center space-y-4">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Documentos Enviados!</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Obrigado, <strong>{status?.inscricao.nome_completo}</strong>!<br />
            Seus documentos foram recebidos com sucesso. A equipe do Instituto irá analisá-los e entrará em contato em breve.
          </p>
        </div>
      </div>
    );
  }

  const docsObrigatorios = getDocsObrigatorios(status?.inscricao.maior_18_anos ?? true);
  const totalEnviados = (status?.tipos_enviados.length ?? 0);
  const totalObrig = docsObrigatorios.length;
  const obrigEnviados = docsObrigatorios.filter(d => status?.tipos_enviados.includes(d.tipo)).length;
  const pct = Math.round((obrigEnviados / totalObrig) * 100);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-900 text-white py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586A1 1 0 0114 3.586L18.414 8A1 1 0 0119 8.414V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-blue-200 text-xs uppercase tracking-widest">Instituto Tiapretinha</p>
              <h1 className="text-xl font-bold leading-tight">Envio de Documentos</h1>
            </div>
          </div>
          <p className="text-blue-100 text-sm">
            Olá, <strong>{status?.inscricao.nome_completo}</strong>! Envie os documentos solicitados abaixo.
          </p>

          {/* Barra de progresso */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-blue-200 mb-1">
              <span>Documentos obrigatórios</span>
              <span>{obrigEnviados}/{totalObrig}</span>
            </div>
            <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Banner: já cadastrado em sessão anterior */}
        {status?.inscricao.status_matricula === 'Documentos Enviados' && !concluido && (
          <div className="bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-700 rounded-xl p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-teal-800 dark:text-teal-200">Documentos já enviados!</p>
              <p className="text-xs text-teal-600 dark:text-teal-400 mt-0.5">
                Seus documentos obrigatórios já foram recebidos. Você ainda pode enviar documentos adicionais abaixo.
              </p>
            </div>
          </div>
        )}

        {/* Aviso de erro de upload */}
        {uploadErro && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-700 dark:text-red-300">Erro ao enviar arquivo</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{uploadErro}</p>
            </div>
            <button
              onClick={() => setUploadErro(null)}
              className="ml-auto text-red-400 hover:text-red-600 text-lg leading-none"
            >
              ×
            </button>
          </div>
        )}

        {/* Foto do Aluno */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 bg-blue-600 rounded-full" />
            <h2 className="text-base font-semibold text-gray-800 dark:text-white">
              Foto do Aluno
            </h2>
            <span className="text-xs text-gray-400">* obrigatório</span>
          </div>
          <FotoAlunoCard
            apiOrigin={apiOrigin}
            enviado={docEnviado('foto_aluno')}
            onUpload={handleUpload}
            uploading={uploadingTipo === 'foto_aluno'}
          />
        </section>

        {/* Documentos Obrigatórios */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 bg-red-500 rounded-full" />
            <h2 className="text-base font-semibold text-gray-800 dark:text-white">
              Documentos Obrigatórios
            </h2>
            <span className="text-xs text-gray-400">* obrigatório</span>
          </div>
          <div className="space-y-3">
            {docsObrigatorios.map(d => (
              <DocCard
                key={d.tipo}
                label={d.label}
                desc={d.desc}
                tipo={d.tipo}
                obrigatorio={true}
                enviado={docEnviado(d.tipo)}
                onUpload={handleUpload}
                uploading={uploadingTipo === d.tipo}
              />
            ))}
          </div>
        </section>

        {/* Documento Opcional */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 bg-blue-500 rounded-full" />
            <h2 className="text-base font-semibold text-gray-800 dark:text-white">
              Documento Opcional
            </h2>
          </div>
          <DocCard
            label={DOC_OPCIONAL.label}
            desc={DOC_OPCIONAL.desc}
            tipo={DOC_OPCIONAL.tipo}
            obrigatorio={false}
            enviado={docEnviado(DOC_OPCIONAL.tipo)}
            onUpload={handleUpload}
            uploading={uploadingTipo === DOC_OPCIONAL.tipo}
          />
        </section>

        {/* Documentos Extras */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 bg-purple-500 rounded-full" />
            <h2 className="text-base font-semibold text-gray-800 dark:text-white">
              Documentos Adicionais
            </h2>
            <span className="text-xs text-gray-400">até 5</span>
          </div>
          <div className="space-y-3">
            {/* Exibe os já enviados */}
            {extrasEnviados.map((doc, i) => (
              <DocCard
                key={doc.id}
                label={doc.nome_extra ?? `Documento extra ${i + 1}`}
                desc="Documento adicional enviado"
                tipo="extra"
                obrigatorio={false}
                enviado={doc}
                onUpload={handleUpload}
                uploading={false}
              />
            ))}
            {/* Novos extras disponíveis */}
            {extrasEnviados.length < 5 &&
              nomesExtra.slice(0, 5 - extrasEnviados.length).map((nome, i) => (
                <DocCard
                  key={`extra-new-${i}`}
                  label={`Documento Adicional ${extrasEnviados.length + i + 1}`}
                  desc='Informe o nome e selecione o arquivo'
                  tipo="extra"
                  obrigatorio={false}
                  nomeExtra={nome}
                  onNomeExtraChange={v => {
                    const arr = [...nomesExtra];
                    arr[i] = v;
                    setNomesExtra(arr);
                  }}
                  onUpload={handleUpload}
                  uploading={uploadingTipo === `extra${nome}`}
                />
              ))}
          </div>
        </section>

        {/* Botão de Conclusão */}
        <div className="pb-8 space-y-3">
          {status && !status.completo && status.obrigatorios_pendentes.length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl p-4">
              <p className="text-sm text-yellow-700 dark:text-yellow-300 font-medium text-center">
                ⚠ {status.obrigatorios_pendentes.length} documento(s) recomendado(s) ainda não enviado(s)
              </p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1 text-center">
                Você pode concluir agora, mas nossa equipe poderá solicitar os documentos faltantes posteriormente.
              </p>
            </div>
          )}
          {status?.completo && (
            <div className="inline-flex items-center gap-2 text-green-600 dark:text-green-400 font-semibold w-full justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Todos os documentos foram enviados!
            </div>
          )}
          <div className="text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Nossa equipe irá analisar e entrar em contato em breve.
            </p>
            <button
              onClick={() => setConcluido(true)}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-3 rounded-xl shadow transition-colors"
            >
              Concluir Envio
            </button>
          </div>
        </div>

        {/* Informações */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6 pb-8">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">
            Formatos aceitos
          </h3>
          <div className="flex flex-wrap gap-2">
            {['JPEG', 'PNG', 'WebP', 'PDF'].map(f => (
              <span
                key={f}
                className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs text-gray-600 dark:text-gray-300"
              >
                {f}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">Tamanho máximo por arquivo: 8 MB</p>
        </div>
      </div>
    </div>
  );
}
