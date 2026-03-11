import { Controller, Get, Post, Patch, Delete, Body, Param, Logger } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('admin/usuarios')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  @Get()
  listar() {
    this.logger.log('Admin: listando usuários');
    return this.usersService.listarTodos();
  }

  @Post()
  criar(@Body() body: any) {
    this.logger.log(`Admin: criando usuário ${body.email}`);
    return this.usersService.criar(body);
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
