import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('registro')
  async registrar(@Body() dados: any) {
    // Recomendo que 'dados' contenha: nome, email, senha, role
    return await this.authService.registrar(dados);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK) // Login bem-sucedido deve retornar 200, não 201
  async login(@Body() body: any) {
    // Ajustado para aceitar 'senha' ou 'password', dando preferência ao que seu banco usa
    const email = body.email;
    const senha = body.senha || body.password; 
    
    return await this.authService.login(email, senha);
  }
}