'use client';

import { useEffect } from 'react';

/**
 * Lê as preferências de acessibilidade do localStorage e aplica as
 * classes CSS correspondentes no elemento <html> em todas as páginas.
 *
 * Classes aplicadas:
 *  - font-size-sm / font-size-base / font-size-lg
 *  - reduce-motion
 *  - compact
 */
export default function SettingsApplier() {
  useEffect(() => {
    const root = document.documentElement;

    const fontSize = localStorage.getItem('itp_font_size') || 'base';
    root.classList.remove('font-size-sm', 'font-size-base', 'font-size-lg');
    root.classList.add(`font-size-${fontSize}`);

    root.classList.toggle('reduce-motion', localStorage.getItem('itp_reduce_motion') === 'true');
    root.classList.toggle('compact', localStorage.getItem('itp_compact') === 'true');
  }, []);

  return null;
}
