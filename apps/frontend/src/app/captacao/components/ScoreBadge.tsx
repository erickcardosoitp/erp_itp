import React from 'react';
import { getScoreLabel, SCORE_STYLES } from '../constants';

interface Props {
  score: number;
  showBar?: boolean;
  size?: 'sm' | 'md';
}

export function ScoreBadge({ score, showBar = true, size = 'sm' }: Props) {
  const label = getScoreLabel(score);
  const styles = SCORE_STYLES[label];
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';

  return (
    <div className="flex items-center gap-1.5">
      {showBar && (
        <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${styles.bar}`}
            style={{ width: `${score}%` }}
          />
        </div>
      )}
      <span className={`${textSize} font-black px-1.5 py-0.5 rounded-md ${styles.bg} ${styles.text}`}>
        {label} {score}
      </span>
    </div>
  );
}
