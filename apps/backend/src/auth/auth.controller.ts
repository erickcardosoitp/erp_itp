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
      const { email, matricula, password } = body;
      // Aceita e-mail ou matrícula como identificador
      const identifier = (matricula || email || '').toString();
      const result = await this.authService.login(identifier, password);

      const isProd = process.env.NODE_ENV === 'production';

      // ✅ MUDANÇA CRÍTICA: Renomeado de '@ITP:token' para 'itp_token'
      // Nomes com @ ou : podem causar o erro "argument name is invalid" em alguns sistemas
      res.cookie('itp_token', result.access_token, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        // Sem maxAge/expires → session cookie: apagado ao fechar o navegador
        path: '/',
      });

      this.logger.log(`✅ Login Sucesso: ${email} | Cargo: ${result.usuario.role}`);
      
      return { 
        access_token: result.access_token,
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

  @Public()
  @Post('esqueci-senha')
  @HttpCode(HttpStatus.OK)
  async esqueciSenha(@Body() body: { email: string }) {
    return this.authService.solicitarReset(body.email || '');
  }

  @Public()
  @Post('resetar-senha')
  @HttpCode(HttpStatus.OK)
  async resetarSenha(@Body() body: { token: string; senha: string }) {
    return this.authService.resetarSenha(body.token, body.senha);
  }
}