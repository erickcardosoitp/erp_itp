import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../constants/roles.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger('RolesGuard');

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.role) {
      throw new ForbiddenException('Cargo não identificado no token de acesso.');
    }

    // ✅ MAPEAMENTO À PROVA DE FALHAS (Normaliza aadmin -> admin)
    const mapaHierarquia: Record<string, number> = {
      'user': 0,
      'cozinha': 1,
      'assist': 2,
      'monitor': 3,
      'prof': 4,
      'adjunto': 5,
      'drt': 8,
      'vp': 9,
      'admin': 10,
      'aadmin': 10 // 👈 Escudo contra erro de concatenação
    };

    const roleUsuario = String(user.role).toLowerCase().trim();
    const userValue = mapaHierarquia[roleUsuario];

    // Converte roles exigidas (Enum) para seus valores numéricos
    const requiredValues = requiredRoles.map(r => {
      // Se já for número (do Enum antigo), usa. Senão busca no mapa.
      if (typeof r === 'number') return r;
      return mapaHierarquia[String(r).toLowerCase()] ?? 99;
    });

    const minRequired = Math.min(...requiredValues);

    this.logger.debug(
      `🛡️ [ITP] Usuário: ${roleUsuario} (Nível ${userValue}) | Mínimo Exigido: ${minRequired}`
    );

    if (userValue === undefined) {
      throw new ForbiddenException(`Cargo '${roleUsuario}' não existe no mapa do ITP.`);
    }

    // ✅ LÓGICA DE HIERARQUIA
    if (userValue < minRequired) {
      throw new ForbiddenException('Nível de acesso insuficiente.');
    }

    return true;
  }
}