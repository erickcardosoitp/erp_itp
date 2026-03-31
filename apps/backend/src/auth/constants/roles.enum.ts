export enum Role {
  USER = 'user',       // Novo usuário pendente
  CZNH = 'cozinha',    // Cozinha
  ASSIST = 'assist',   // Assistente
  MNT = 'monitor',     // Monitor
  PROF = 'prof',       // Professor
  DRT_ADJ = 'adjunto', // Diretor Adjunto
  DRT = 'drt',         // Diretor
  VP = 'vp',           // Vice-Presidente
  ADMIN = 'admin',     // Presidente / Admin Total (Bate com seu banco!)
}

/** Nível numérico por role — usado para filtro de notificações */
export const RoleLevel: Record<string, number> = {
  [Role.USER]: 0,
  [Role.CZNH]: 1,
  [Role.ASSIST]: 2,
  [Role.MNT]: 3,
  [Role.PROF]: 4,
  [Role.DRT_ADJ]: 5,
  [Role.DRT]: 8,
  [Role.VP]: 9,
  [Role.ADMIN]: 10,
};

/** Roles que podem ler itens/categorias/alertas de estoque */
export const ESTOQUE_READ_ROLES = [Role.ADMIN, Role.VP, Role.DRT, Role.DRT_ADJ, Role.ASSIST, Role.CZNH, Role.MNT, Role.PROF] as const;

/** Roles que podem criar/editar produtos e categorias de estoque */
export const ESTOQUE_WRITE_ROLES = [Role.ADMIN, Role.VP, Role.DRT, Role.DRT_ADJ, Role.ASSIST, Role.MNT, Role.PROF] as const;

/** Roles que podem registrar movimentos de baixa de estoque */
export const ESTOQUE_BAIXA_ROLES = [Role.ADMIN, Role.VP, Role.DRT, Role.DRT_ADJ, Role.ASSIST, Role.CZNH] as const;

/** Roles que podem registrar entradas de estoque */
export const ESTOQUE_ENTRADA_ROLES = [Role.ADMIN, Role.VP, Role.DRT, Role.DRT_ADJ, Role.ASSIST] as const;

export const RoleLabels = {
  [Role.USER]: 'Pendente/Visitante',
  [Role.CZNH]: 'Cozinheiro(a)',
  [Role.ASSIST]: 'Assistente',
  [Role.MNT]: 'Monitor',
  [Role.PROF]: 'Professor',
  [Role.DRT_ADJ]: 'Diretor(a) Adjunto(a)',
  [Role.DRT]: 'Diretor(a)',
  [Role.VP]: 'Vice-Presidente',
  [Role.ADMIN]: 'Presidente',
};