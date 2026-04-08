import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MODULO_PERM_KEY, ModuloPermMeta } from '../decorators/modulo-perm.decorator';

@Injectable()
export class ModuloPermGuard implements CanActivate {
  private readonly logger = new Logger('ModuloPermGuard');

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const meta = this.reflector.getAllAndOverride<ModuloPermMeta>(MODULO_PERM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Sem decorator → rota não tem restrição de módulo/ação
    if (!meta) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('Usuário não autenticado.');

    const grupoNome = (user.grupo ?? '').toUpperCase();

    // Grupo ADMIN tem acesso total a tudo
    if (grupoNome === 'ADMIN') return true;

    // Sem permissões configuradas → nega por segurança
    const permissoes = user.permissoes?.permissoes;
    if (!permissoes) {
      throw new ForbiddenException('Grupo sem permissões configuradas.');
    }

    const permModulo = permissoes[meta.modulo];
    if (!permModulo) {
      this.logger.warn(`[${grupoNome}] módulo '${meta.modulo}' não configurado → negado`);
      throw new ForbiddenException(`Sem acesso ao módulo '${meta.modulo}'.`);
    }

    const permitido = !!permModulo[meta.acao];
    this.logger.debug(`[${grupoNome}] ${meta.modulo}.${meta.acao} → ${permitido ? 'PERMITIDO' : 'NEGADO'}`);

    if (!permitido) {
      throw new ForbiddenException(`Sem permissão para '${meta.acao}' em '${meta.modulo}'.`);
    }

    return true;
  }
}
