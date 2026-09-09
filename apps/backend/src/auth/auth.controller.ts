import { Controller, Post, Body, Res, Logger, HttpStatus, HttpCode, UnauthorizedException, Patch, Req, Headers, Get, Query } from '@nestjs/common';
import { AuthService, SsoSemContaException } from './auth.service';
import { Response, Request } from 'express';
import { Public } from './decorators/public.decorator';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import jwksClient = require('jwks-rsa');

const MS_TENANT_ID = process.env.MS_TENANT_ID || '';
const MS_CLIENT_ID = process.env.MS_CLIENT_ID || '';
const MS_CLIENT_SECRET = process.env.MS_CLIENT_SECRET || '';
// Passa pelo proxy do frontend (/backend-api) de proposito: o Set-Cookie da
// resposta precisa vir do dominio itp.institutotiapretinha.org (onde o
// middleware le o cookie), nao de api.itp.* (dominio diferente, cookie
// host-only nao seria visto pelo frontend).
const MS_REDIRECT_URI = process.env.MS_REDIRECT_URI || 'https://itp.institutotiapretinha.org/backend-api/auth/microsoft/callback';
const MS_FRONTEND_URL = process.env.APP_URL || 'https://itp.institutotiapretinha.org';

const msJwks = MS_TENANT_ID
  ? jwksClient({ jwksUri: `https://login.microsoftonline.com/${MS_TENANT_ID}/discovery/v2.0/keys` })
  : null;

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
        sameSite: 'strict',
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
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie('itp_token', {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      path: '/',
    });
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
   * Inicia o login via SSO Microsoft (Entra ID). Redireciona pro consent
   * screen da Microsoft; state em cookie httpOnly protege contra CSRF.
   */
  @Public()
  @Get('microsoft')
  async iniciarLoginMicrosoft(@Res() res: Response) {
    if (!MS_TENANT_ID || !MS_CLIENT_ID) {
      throw new UnauthorizedException('SSO Microsoft não configurado.');
    }
    const state = crypto.randomBytes(16).toString('hex');
    // path '/' porque o navegador ve /backend-api/... (proxy do Next), nao
    // /api/... (rota interna do backend) — restringir o path quebraria o
    // envio do cookie de volta no callback.
    res.cookie('ms_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 5 * 60 * 1000,
    });

    const params = new URLSearchParams({
      client_id: MS_CLIENT_ID,
      response_type: 'code',
      redirect_uri: MS_REDIRECT_URI,
      response_mode: 'query',
      scope: 'openid email profile',
      state,
      // Sempre mostra o seletor de conta — sem isso a Microsoft reloga
      // silenciosamente na ultima conta usada no navegador, sem deixar
      // trocar.
      prompt: 'select_account',
    });
    return res.redirect(
      `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/authorize?${params.toString()}`,
    );
  }

  /**
   * Callback do SSO Microsoft: troca o code por token, valida a assinatura
   * do id_token (JWKS da Microsoft), casa/cria usuário por e-mail, emite o
   * mesmo cookie de sessão do login normal.
   */
  @Public()
  @Get('microsoft/callback')
  async callbackMicrosoft(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const stateCookie = (req as any).cookies?.ms_oauth_state;
      res.clearCookie('ms_oauth_state', { path: '/' });
      if (!code || !state || !stateCookie || state !== stateCookie) {
        throw new UnauthorizedException('Requisição SSO inválida (state divergente).');
      }

      const tokenResp = await fetch(
        `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: MS_CLIENT_ID,
            client_secret: MS_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code,
            redirect_uri: MS_REDIRECT_URI,
            scope: 'openid email profile',
          }),
        },
      );
      const tokenBody: any = await tokenResp.json();
      if (!tokenResp.ok || !tokenBody.id_token) {
        this.logger.error(`Falha ao trocar code por token SSO: ${JSON.stringify(tokenBody)}`);
        throw new UnauthorizedException('Falha na autenticação com a Microsoft.');
      }

      const claims: any = await new Promise((resolve, reject) => {
        jwt.verify(
          tokenBody.id_token,
          (header, callback) => {
            msJwks!.getSigningKey(header.kid, (err: Error | null, key?: jwksClient.SigningKey) => {
              if (err) return callback(err);
              callback(null, key!.getPublicKey());
            });
          },
          {
            audience: MS_CLIENT_ID,
            issuer: `https://login.microsoftonline.com/${MS_TENANT_ID}/v2.0`,
          },
          (err, decoded) => (err ? reject(err) : resolve(decoded)),
        );
      });

      const email = claims.email || claims.preferred_username;
      if (!email) throw new UnauthorizedException('Conta Microsoft sem e-mail disponível.');

      const result = await this.authService.loginComSSO(email, claims.name);

      // sameSite 'lax' (nao 'strict' como o login normal): esta requisicao
      // ainda faz parte da cadeia de redirect iniciada pela Microsoft
      // (cross-site). Cookie 'Strict' setado aqui nao seria enviado no
      // request seguinte (redirect pra '/'), so num reload manual novo -
      // e exatamente o bug visto (login "nao pega" ate recarregar a pagina).
      // 'Lax' permite envio em navegacao GET top-level mesmo vindo de
      // redirect cross-site, mantendo protecao contra CSRF via POST/AJAX.
      res.cookie('itp_token', result.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 8 * 60 * 60 * 1000,
      });

      return res.redirect(MS_FRONTEND_URL);
    } catch (error: any) {
      if (error instanceof SsoSemContaException) {
        this.logger.warn(`🔒 SSO sem conta correspondente: ${error.message}`);
        return res.redirect(`${MS_FRONTEND_URL}/login?erro=sso-sem-conta`);
      }
      this.logger.error(`❌ Falha no login SSO Microsoft: ${error.message}`);
      return res.redirect(`${MS_FRONTEND_URL}/login?erro=sso`);
    }
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
    const expected = process.env.CRON_SECRET;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!expected || (cronSecret !== expected && bearerToken !== expected)) {
      throw new UnauthorizedException('Cron secret inválido.');
    }
    return this.authService.enviarLembretesSenhaFraca();
  }
}
