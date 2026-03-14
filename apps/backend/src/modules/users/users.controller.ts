import { Controller, Get, Post, Patch, Delete, Body, Param, Logger } from '@nestjs/common';
import { UsersService } from './users.service';
import { EmailService } from '../../email.service';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/constants/roles.enum';

@Controller('admin/usuarios')
@Roles(Role.DRT) // Mínimo: Diretor (nível 8). RolesGuard global aplica a hierarquia.
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
  async criar(@Body() body: any) {
    this.logger.log(`Admin: criando usuário ${body.email}`);
    const usuario = await this.usersService.criar(body);
    // Envia e-mail com a matrícula se o funcionário tiver e-mail e matrícula
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
  atualizar(@Param('id') id: string, @Body() body: any) {
    this.logger.log(`Admin: atualizando usuário id=${id}`);
    return this.usersService.atualizar(id, body);
  }

  @Delete(':id')
  deletar(@Param('id') id: string) {
    this.logger.warn(`Admin: deletando usuário id=${id}`);
    return this.usersService.deletar(id);
  }
}
