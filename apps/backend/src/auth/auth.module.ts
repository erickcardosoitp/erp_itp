import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../usuarios/usuario.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';

// EmailService (EmailModule) e SupabaseService (SupabaseModule) não
// precisam ser importados aqui — ambos são @Global(), já disponíveis
// via import único no AppModule.
@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario]),
    NotificacoesModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
