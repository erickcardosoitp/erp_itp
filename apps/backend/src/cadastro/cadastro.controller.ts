import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { CadastroService } from './cadastro.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModuloPermGuard } from '../auth/guards/modulo-perm.guard';
import { ModuloPerm } from '../auth/decorators/modulo-perm.decorator';

@Controller('cadastro')
@UseGuards(JwtAuthGuard, ModuloPermGuard)
export class CadastroController {
  constructor(private readonly svc: CadastroService) {}

  // ── INSUMOS ───────────────────────────────────────────────────────────────

  @Get('insumos')
  @ModuloPerm('cadastro_basico', 'visualizar')
  listarInsumos() { return this.svc.listarInsumos(); }

  @Post('insumos')
  @ModuloPerm('cadastro_basico', 'incluir')
  criarInsumo(@Body() dto: any) { return this.svc.criarInsumo(dto); }

  @Patch('insumos/:id')
  @ModuloPerm('cadastro_basico', 'editar')
  editarInsumo(@Param('id') id: string, @Body() dto: any) { return this.svc.editarInsumo(id, dto); }

  @Delete('insumos/:id')
  @ModuloPerm('cadastro_basico', 'excluir')
  deletarInsumo(@Param('id') id: string) { return this.svc.deletarInsumo(id); }

  // ── DOADORES ──────────────────────────────────────────────────────────────

  @Get('doadores')
  @ModuloPerm('cadastro_basico', 'visualizar')
  listarDoadores() { return this.svc.listarDoadores(); }

  @Post('doadores')
  @ModuloPerm('cadastro_basico', 'incluir')
  criarDoador(@Body() dto: any) { return this.svc.criarDoador(dto); }

  @Patch('doadores/:id')
  @ModuloPerm('cadastro_basico', 'editar')
  editarDoador(@Param('id') id: string, @Body() dto: any) { return this.svc.editarDoador(id, dto); }

  @Delete('doadores/:id')
  @ModuloPerm('cadastro_basico', 'excluir')
  deletarDoador(@Param('id') id: string) { return this.svc.deletarDoador(id); }

  // ── CONTAS BANCÁRIAS ──────────────────────────────────────────────────────

  @Get('contas-bancarias')
  @ModuloPerm('cadastro_basico', 'visualizar')
  listarContas() { return this.svc.listarContas(); }

  @Post('contas-bancarias')
  @ModuloPerm('cadastro_basico', 'incluir')
  criarConta(@Body() dto: any) { return this.svc.criarConta(dto); }

  @Patch('contas-bancarias/:id')
  @ModuloPerm('cadastro_basico', 'editar')
  editarConta(@Param('id') id: string, @Body() dto: any) { return this.svc.editarConta(id, dto); }

  @Delete('contas-bancarias/:id')
  @ModuloPerm('cadastro_basico', 'excluir')
  deletarConta(@Param('id') id: string) { return this.svc.deletarConta(id); }
}
