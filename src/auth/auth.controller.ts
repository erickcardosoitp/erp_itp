import { Controller, Post, Body, Res, Logger, HttpStatus, HttpCode, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Response } from 'express';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const { email, password } = body;
      const result = await this.authService.login(email, password);

      const isProd = process.env.NODE_ENV === 'production';

      // ✅ MUDANÇA CRÍTICA: Renomeado de '@ITP:token' para 'itp_token'
      // Nomes com @ ou : podem causar o erro "argument name is invalid" em alguns sistemas
      res.cookie('itp_token', result.access_token, {
        httpOnly: false, 
        secure: isProd,
        sameSite: 'lax',
        maxAge: 8 * 60 * 60 * 1000, // 8 horas
        path: '/',
      });

      this.logger.log(`✅ Login Sucesso: ${email} | Cargo: ${result.usuario.role}`);
      
      return { 
        usuario: result.usuario, 
        message: 'Login realizado com sucesso' 
      };

    } catch (error: any) {
      this.logger.error(`❌ Falha no Login: ${error.message}`);
      throw new UnauthorizedException(error.message);
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    // ✅ Mantendo a consistência no nome ao remover
    res.clearCookie('itp_token');
    return { message: 'Sessão encerrada' };
  }
}