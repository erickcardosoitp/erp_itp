import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards, Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModuloPermGuard } from '../auth/guards/modulo-perm.guard';
import { ModuloPerm } from '../auth/decorators/modulo-perm.decorator';
import { AcademicoService } from './academico.service';

@Controller('chamados')
@UseGuards(JwtAuthGuard, ModuloPermGuard)
export class ChamadosController {
  constructor(private readonly svc: AcademicoService) {}

  @Get('responsaveis')
  @ModuloPerm('chamados', 'visualizar')
  responsaveis() { return this.svc.listarResponsaveis(); }

  @Get('stats')
  @ModuloPerm('chamados', 'visualizar')
  stats() { return this.svc.statsChamados(); }

  @Get()
  @ModuloPerm('chamados', 'visualizar')
  listar(@Query() q: any) { return this.svc.listarChamados(q); }

  @Post()
  @ModuloPerm('chamados', 'incluir')
  criar(@Body() dto: any, @Req() req: any) {
    return this.svc.criarChamado(dto, req.user?.nome || req.user?.email);
  }

  @Patch(':id')
  @ModuloPerm('chamados', 'editar')
  editar(@Param('id') id: string, @Body() dto: any) {
    return this.svc.editarChamado(id, dto);
  }

  @Delete(':id')
  @ModuloPerm('chamados', 'excluir')
  deletar(@Param('id') id: string) { return this.svc.deletarChamado(id); }
}
