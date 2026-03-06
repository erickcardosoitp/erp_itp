import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  /**
   * Determina se a rota atual pode ser acessada.
   */
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // 1. Verifica se a rota ou a classe possui o decorator @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 2. Se for pública, libera o acesso imediatamente
    if (isPublic) {
      return true;
    }

    // 3. Caso contrário, executa a lógica padrão do Passport (chama a JwtStrategy)
    return super.canActivate(context);
  }

  /**
   * Customização do tratamento de erro para fornecer logs mais claros.
   */
  handleRequest(err: any, user: any, info: any) {
    // Se houver erro ou o usuário não for encontrado (cookie ausente ou inválido)
    if (err || !user) {
      throw err || new UnauthorizedException('Acesso negado: Sessão inválida ou expirada.');
    }
    return user;
  }
}