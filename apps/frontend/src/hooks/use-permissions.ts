import { UserPayload } from '@/context/auth-context';

// Hierarquia numérica de roles (mesmo mapeamento do backend)
const ROLE_LEVEL: Record<string, number> = {
  user: 0,
  cozinha: 1,
  assist: 2,
  monitor: 3,
  prof: 4,
  adjunto: 5,
  drt: 8,
  vp: 9,
  prt: 10,
  admin: 10,
};

/** Retorna o nível numérico do role do usuário */
function getRoleLevel(role?: string): number {
  return ROLE_LEVEL[(role ?? '').toLowerCase().trim()] ?? 0;
}

/**
 * Verifica se o usuário pode acessar um módulo.
 * Prioridade: grupo_permissoes (se existir) > fallback por role level.
 */
export function podeAcessarModulo(
  user: UserPayload | null,
  modulo: string,
  acao: 'visualizar' | 'incluir' | 'editar' | 'excluir' = 'visualizar',
): boolean {
  if (!user) return false;

  const gp = user.grupo?.grupo_permissoes;

  // Se o grupo tem permissões configuradas, usa elas
  if (gp) {
    const isAdmin = (user.grupo?.nome ?? '').toUpperCase() === 'ADMIN';
    if (isAdmin) return true;

    const perm = gp.permissoes?.[modulo];
    if (perm !== undefined) return !!perm[acao];

    // Fallback: verifica apenas modulos_visiveis para 'visualizar'
    if (acao === 'visualizar') return !!gp.modulos_visiveis?.[modulo];
    return false;
  }

  // Sem grupo configurado: usa hierarquia de role como fallback
  const level = getRoleLevel(user.role);
  if (acao === 'visualizar') return level >= 1;
  if (acao === 'excluir')    return level >= 8; // drt+
  if (acao === 'incluir' || acao === 'editar') return level >= 4; // prof+
  return false;
}

/**
 * Hook principal de permissões.
 * Centraliza todas as verificações de acesso.
 */
export function usePermissions(user: UserPayload | null) {
  const level = getRoleLevel(user?.role);
  const grupoNome = (user?.grupo?.nome ?? '').toUpperCase();
  const isAdmin = grupoNome === 'ADMIN';

  return {
    // Nível numérico do role
    roleLevel: level,

    // Pode editar/criar em qualquer módulo (DRT ou superior, ou grupo ADMIN)
    canWrite: isAdmin || level >= 8,

    // Pode excluir registros sensíveis
    canDelete: isAdmin || level >= 8,

    // Pode acessar módulo específico com uma ação
    canAccess: (modulo: string, acao: 'visualizar' | 'incluir' | 'editar' | 'excluir' = 'visualizar') =>
      podeAcessarModulo(user, modulo, acao),

    // Verifica se o grupo do usuário está em uma lista de grupos permitidos
    inGroup: (...grupos: string[]) =>
      grupos.map(g => g.toUpperCase()).includes(grupoNome),
  };
}
