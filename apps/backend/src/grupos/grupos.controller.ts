import { Controller, Post, Get, Body, Param, Delete, Patch, UseGuards } from '@nestjs/common';
import { GruposService } from './grupos.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModuloPermGuard } from '../auth/guards/modulo-perm.guard';
import { ModuloPerm } from '../auth/decorators/modulo-perm.decorator';

@Controller('grupos')
@UseGuards(JwtAuthGuard, ModuloPermGuard)
export class GruposController {
  constructor(private readonly gruposService: GruposService) {}

  @Post()
  @ModuloPerm('config', 'incluir')
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

  @Patch(':id')
  @ModuloPerm('config', 'editar')
  async atualizar(@Param('id') id: string, @Body() body: Partial<{ nome: string; grupo_permissoes: any }>) {
    return await this.gruposService.atualizar(id, body);
  }

  @Delete(':id')
  @ModuloPerm('config', 'excluir')
  async deletar(@Param('id') id: string) {
    return await this.gruposService.deletar(id);
  }
}
