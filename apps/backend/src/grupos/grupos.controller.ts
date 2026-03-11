import { Controller, Post, Get, Body, Param, Delete, Patch, UseGuards } from '@nestjs/common';
import { GruposService } from './grupos.service';

@Controller('grupos')
export class GruposController {
  constructor(private readonly gruposService: GruposService) {}

  @Post()
  async criarGrupo(@Body() body: { nome: string; permissoes: any }) {
    return await this.gruposService.criar(body.nome, body.permissoes);
  }

  @Get()
  async listar() {
    return await this.gruposService.listarTodos();
  }

  @Get(':id')
  async buscar(@Param('id') id: string) {
    return await this.gruposService.buscarPorId(id);
  }

  @Patch(':id')
  async atualizar(@Param('id') id: string, @Body() body: Partial<{ nome: string; grupo_permissoes: any }>) {
    return await this.gruposService.atualizar(id, body);
  }

  @Delete(':id')
  async deletar(@Param('id') id: string) {
    return await this.gruposService.deletar(id);
  }
}