import { Module } from '@nestjs/common';
import { UsuariosController } from './usuarios.controller';
import { AuthModule } from '../auth/auth.module';

// Sem .service.ts próprio de propósito: o controller usa AuthService
// (perfil do usuário logado vive em auth.service.ts, não duplicado aqui).
@Module({
  imports: [AuthModule],
  controllers: [UsuariosController],
})
export class UsuariosModule {}
