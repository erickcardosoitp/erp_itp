'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, RotateCcw, Check, Upload, X } from 'lucide-react';

const GUIDE: Record<string, { label: string; aspect: number }> = {
  foto_aluno:              { label: 'Foto do Aluno', aspect: 1 },
  identidade_aluno:        { label: 'RG / Doc. do Aluno', aspect: 1.586 },
  identidade_responsavel:  { label: 'RG / Doc. do Responsável', aspect: 1.586 },
  comprovante_residencia:  { label: 'Comprovante de Residência', aspect: 0.707 },
  certidao_nascimento:     { label: 'Certidão de Nascimento', aspect: 0.707 },
  declaracao_escolar:      { label: 'Declaração Escolar', aspect: 0.707 },
};

interface Props {
  tipo: string;
  onCapture: (blob: Blob) => void;
  onClose: () => void;
}

export default function DocumentCamera({ tipo, onCapture, onClose }: Props) {
  const videoRef      = useRef<HTMLVideoElement>(null);
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const streamRef     = useRef<MediaStream | null>(null);

  const [stage, setStage]           = useState<'camera' | 'preview' | 'noCamera'>('camera');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [blob, setBlob]             = useState<Blob | null>(null);

  const guide = GUIDE[tipo] ?? { label: tipo, aspect: 1 };

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setStage('noCamera');
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const capture = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.filter = 'contrast(1.2) brightness(1.05)';
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(b => {
      if (!b) return;
      setBlob(b);
      setPreviewUrl(URL.createObjectURL(b));
      setStage('preview');
      stopCamera();
    }, 'image/jpeg', 0.92);
  };

  const retry = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setBlob(null);
    setStage('camera');
    startCamera();
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const b = new Blob([file], { type: file.type });
    setBlob(b);
    setPreviewUrl(URL.createObjectURL(b));
    setStage('preview');
  };

  // Compute guide dimensions so it fits on screen while preserving aspect ratio
  const landscape = guide.aspect >= 1;
  const guideStyle: React.CSSProperties = landscape
    ? { width: '75%', aspectRatio: String(guide.aspect) }
    : { height: '75%', aspectRatio: String(guide.aspect) };

  return (
    <div className="fixed inset-0 z-[400] bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent">
        <p className="text-white font-black text-xs uppercase tracking-widest">{guide.label}</p>
        <button onClick={onClose} className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Main area */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {stage === 'camera' && (
          <>
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
            {/* Dim overlay */}
            <div className="absolute inset-0 bg-black/35 pointer-events-none" />
            {/* Frame guide */}
            <div className="relative pointer-events-none" style={guideStyle}>
              {/* Corners */}
              <div className="absolute top-0    left-0  w-7 h-7 border-t-[3px] border-l-[3px] border-white" />
              <div className="absolute top-0    right-0 w-7 h-7 border-t-[3px] border-r-[3px] border-white" />
              <div className="absolute bottom-0 left-0  w-7 h-7 border-b-[3px] border-l-[3px] border-white" />
              <div className="absolute bottom-0 right-0 w-7 h-7 border-b-[3px] border-r-[3px] border-white" />
            </div>
          </>
        )}

        {stage === 'preview' && previewUrl && (
          <img src={previewUrl} alt="preview" className="absolute inset-0 w-full h-full object-contain" />
        )}

        {stage === 'noCamera' && (
          <div className="flex flex-col items-center gap-4 text-white/70">
            <Camera size={48} />
            <p className="text-sm">Câmera não disponível</p>
            <button onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-colors">
              <Upload size={14} /> Selecionar arquivo
            </button>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 pb-10 pt-4 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-6">
        {stage === 'camera' && (
          <>
            <button onClick={() => fileInputRef.current?.click()}
              className="p-3 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors" title="Upload">
              <Upload size={18} />
            </button>
            <button onClick={capture}
              className="w-16 h-16 rounded-full border-4 border-white bg-white/25 hover:bg-white/40 transition-all active:scale-95" />
            <div className="w-12" />
          </>
        )}
        {stage === 'preview' && (
          <>
            <button onClick={retry}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-5 py-3 rounded-2xl font-bold text-sm transition-colors">
              <RotateCcw size={15} /> Tirar novamente
            </button>
            <button onClick={() => blob && onCapture(blob)}
              className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-5 py-3 rounded-2xl font-bold text-sm transition-colors">
              <Check size={15} /> Usar esta foto
            </button>
          </>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/heic" className="hidden" onChange={handleFileInput} />
    </div>
  );
}
