import { Controller, Post, Body, Res, Logger, HttpStatus, HttpCode, UnauthorizedException, Patch, Req, Headers, Get } from '@nestjs/common';
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
      const { email, matricula, password, lembrar } = body;
      // Aceita e-mail ou matrícula como identificador
      const identifier = (matricula || email || '').toString();
      const result = await this.authService.login(identifier, password, !!lembrar);

      const isProd = process.env.NODE_ENV === 'production';
      const cookieOpts: Record<string, any> = {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        path: '/',
        maxAge: lembrar
          ? 30 * 24 * 60 * 60 * 1000  // 30 dias em ms
          : 8 * 60 * 60 * 1000,        // 8h em ms
      };

      res.cookie('itp_token', result.access_token, cookieOpts);

      this.logger.log(`✅ Login Sucesso: ${identifier} | Cargo: ${result.usuario.role} | Lembrar: ${!!lembrar}`);

      return {
        access_token: result.access_token,
        usuario: result.usuario,
        deve_trocar_senha: result.deve_trocar_senha,
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

  /** Trocar senha obrigatória (requer login; valida critérios MFA) */
  @Patch('trocar-senha')
  @HttpCode(HttpStatus.OK)
  async trocarSenha(
    @Req() req: any,
    @Body() body: { nova_senha: string; senha_atual?: string },
  ) {
    return this.authService.trocarSenha(req.user.userId, body.nova_senha, body.senha_atual);
  }

  /** Criar usuário de sistema para um funcionário cadastrado via formulário */
  @Post('criar-usuario-funcionario')
  @HttpCode(HttpStatus.CREATED)
  async criarUsuarioFuncionario(@Body() body: { funcionario_id: string; role?: string }) {
    return this.authService.criarUsuarioParaFuncionario(body);
  }

  /** 
   * Endpoint de Cron Job — envia lembretes diários de troca de senha.
   * Protegido pelo header x-cron-secret (local) ou Authorization Bearer (Vercel Cron).
   */
  @Public()
  @Get('cron/verificar-senhas')
  @HttpCode(HttpStatus.OK)
  async cronVerificarSenhas(
    @Headers('x-cron-secret') cronSecret: string,
    @Headers('authorization') authHeader: string,
  ) {
    const expected = process.env.CRON_SECRET || 'itp-cron-2026';
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (cronSecret !== expected && bearerToken !== expected) {
      throw new UnauthorizedException('Cron secret inválido.');
    }
    return this.authService.enviarLembretesSenhaFraca();
  }
}
