import React from 'react';

interface Props {
  confidence: number; // 0-100
}

export function AiConfidenceBar({ confidence }: Props) {
  const blocks = 10;
  const filled = Math.round((confidence / 100) * blocks);

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">IA</span>
      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tracking-tighter">
        {Array.from({ length: blocks }, (_, i) => i < filled ? '■' : '□').join('')}
      </span>
      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{confidence}%</span>
    </div>
  );
}
