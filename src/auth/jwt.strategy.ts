import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger('JwtStrategy');

  constructor(private configService: ConfigService) {
    const secret = configService.get<string>('JWT_SECRET');

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // ✅ Prioridade 1: Header (Enviado pelo interceptor do Axios)
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        // ✅ Prioridade 2: Cookie (Enviado automaticamente pelo navegador)
        (req: any) => {
          let token = null;
          // Sincronizado com o novo nome: 'itp_token'
          if (req && req.cookies) {
            token = req.cookies['itp_token'];
          }
          return token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: secret || 'FALLBACK_PARA_DEV',
    });

    this.logger.log(`🛡️ JwtStrategy sincronizada com o cookie: itp_token`);
  }

  async validate(payload: any) {
    // Se o código chegou aqui, a assinatura da Secret no payload é válida
    if (!payload || !payload.sub) {
      this.logger.error('❌ Payload do JWT malformado ou vazio');
      throw new UnauthorizedException('Token inválido.');
    }

    // Injeta os dados no objeto req.user para o RolesGuard usar
    return { 
      userId: payload.sub, 
      email: payload.email, 
      role: payload.role 
    };
  }
}