/**
 * Suprime deprecation warnings conhecidos e inofensivos que só geram ruído
 * nos logs (o Vercel classifica qualquer coisa no stderr como nível "error").
 *
 * DEP0169 — uso de `url.parse()` internamente pelo Express — não é código
 * nosso, não afeta o funcionamento, e não há fix disponível até o Express
 * atualizar internamente.
 */
process.on('warning', (warning: any) => {
  if (warning.code === 'DEP0169') return;
  console.warn(warning);
});
