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