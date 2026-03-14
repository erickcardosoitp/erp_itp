import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Funcionario } from '../academico/entities/funcionario.entity';
import { Usuario } from '../usuarios/usuario.entity';
import { FuncionariosService } from './funcionarios.service';
import { FuncionariosController } from './funcionarios.controller';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { EmailService } from '../email.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Funcionario, Usuario]),
    NotificacoesModule,
  ],
  controllers: [FuncionariosController],
  providers: [FuncionariosService, EmailService],
  exports: [FuncionariosService],
})
export class FuncionariosModule {}
