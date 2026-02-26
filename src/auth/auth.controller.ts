import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth') // Isso define o prefixo /auth
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('registro') // Caminho final: /auth/registro
  async registrar(@Body() dados: any) {
    return await this.authService.registrar(dados);
  }

  @Post('login') // Caminho final: /auth/login
  async login(@Body() body: any) {
    return await this.authService.login(body.email, body.password);
  }
}