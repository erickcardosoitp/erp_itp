import { Controller, Get, Post, Patch, Delete, Body, Param, Logger, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { EmailService } from '../../email.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ModuloPermGuard } from '../../auth/guards/modulo-perm.guard';
import { ModuloPerm } from '../../auth/decorators/modulo-perm.decorator';

@Controller('admin/usuarios')
@UseGuards(JwtAuthGuard, ModuloPermGuard)
@ModuloPerm('config', 'visualizar')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
  ) {}

  @Get()
  listar() {
    this.logger.log('Admin: listando usuários');
    return this.usersService.listarTodos();
  }

  @Post()
  @ModuloPerm('config', 'incluir')
  async criar(@Body() body: any) {
    this.logger.log(`Admin: criando usuário ${body.email}`);
    const usuario = await this.usersService.criar(body);
    if (usuario.matricula && body.email) {
      try {
        await this.emailService.enviarMatriculaFuncionario(body.email, body.nome || '', usuario.matricula);
      } catch (err: any) {
        this.logger.warn(`Não foi possível enviar e-mail de matrícula: ${err.message}`);
      }
    }
    return usuario;
  }

  @Patch(':id')
  @ModuloPerm('config', 'editar')
  atualizar(@Param('id') id: string, @Body() body: any) {
    this.logger.log(`Admin: atualizando usuário id=${id}`);
    return this.usersService.atualizar(id, body);
  }

  @Delete(':id')
  @ModuloPerm('config', 'excluir')
  deletar(@Param('id') id: string) {
    this.logger.warn(`Admin: deletando usuário id=${id}`);
    return this.usersService.deletar(id);
  }
}
