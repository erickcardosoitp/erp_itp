import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
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
}