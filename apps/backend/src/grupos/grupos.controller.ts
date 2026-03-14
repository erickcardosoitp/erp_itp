import { Controller, Post, Get, Body, Param, Delete, Patch, UseGuards } from '@nestjs/common';
import { GruposService } from './grupos.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants/roles.enum';

@Controller('grupos')
export class GruposController {
  constructor(private readonly gruposService: GruposService) {}

  // Criação e exclusão de grupos: somente DRT ou superior
  @Post()
  @Roles(Role.DRT)
  async criarGrupo(@Body() body: { nome: string; permissoes: any }) {
    return await this.gruposService.criar(body.nome, body.permissoes);
  }

  // Leitura: qualquer usuário autenticado (necessário para selects no frontend)
  @Get()
  async listar() {
    return await this.gruposService.listarTodos();
  }

  @Get(':id')
  async buscar(@Param('id') id: string) {
    return await this.gruposService.buscarPorId(id);
  }

  // Edição e exclusão: somente DRT ou superior
  @Patch(':id')
  @Roles(Role.DRT)
  async atualizar(@Param('id') id: string, @Body() body: Partial<{ nome: string; grupo_permissoes: any }>) {
    return await this.gruposService.atualizar(id, body);
  }

  @Delete(':id')
  @Roles(Role.DRT)
  async deletar(@Param('id') id: string) {
    return await this.gruposService.deletar(id);
  }
}