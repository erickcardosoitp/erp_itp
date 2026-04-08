import { SetMetadata } from '@nestjs/common';

export const MODULO_PERM_KEY = 'moduloPerm';

export type AcaoPerm = 'visualizar' | 'incluir' | 'editar' | 'excluir';

export interface ModuloPermMeta {
  modulo: string;
  acao: AcaoPerm;
}

/**
 * Decorator que define qual módulo e ação são necessários para acessar a rota.
 * Verificado pelo ModuloPermGuard com base no grupo_permissoes do usuário.
 *
 * Exemplo: @ModuloPerm('financeiro', 'incluir')
 */
export const ModuloPerm = (modulo: string, acao: AcaoPerm) =>
  SetMetadata(MODULO_PERM_KEY, { modulo, acao });
