import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { CadastroService } from './cadastro.service';

@Controller('cadastro')
export class CadastroController {
  constructor(private readonly svc: CadastroService) {}

  // ── INSUMOS ───────────────────────────────────────────────────────────────

  @Get('insumos')
  listarInsumos() { return this.svc.listarInsumos(); }

  @Post('insumos')
  criarInsumo(@Body() dto: any) { return this.svc.criarInsumo(dto); }

  @Patch('insumos/:id')
  editarInsumo(@Param('id') id: string, @Body() dto: any) { return this.svc.editarInsumo(id, dto); }

  @Delete('insumos/:id')
  deletarInsumo(@Param('id') id: string) { return this.svc.deletarInsumo(id); }

  // ── DOADORES ──────────────────────────────────────────────────────────────

  @Get('doadores')
  listarDoadores() { return this.svc.listarDoadores(); }

  @Post('doadores')
  criarDoador(@Body() dto: any) { return this.svc.criarDoador(dto); }

  @Patch('doadores/:id')
  editarDoador(@Param('id') id: string, @Body() dto: any) { return this.svc.editarDoador(id, dto); }

  @Delete('doadores/:id')
  deletarDoador(@Param('id') id: string) { return this.svc.deletarDoador(id); }

  // ── CONTAS BANCÁRIAS ──────────────────────────────────────────────────────

  @Get('contas-bancarias')
  listarContas() { return this.svc.listarContas(); }

  @Post('contas-bancarias')
  criarConta(@Body() dto: any) { return this.svc.criarConta(dto); }

  @Patch('contas-bancarias/:id')
  editarConta(@Param('id') id: string, @Body() dto: any) { return this.svc.editarConta(id, dto); }

  @Delete('contas-bancarias/:id')
  deletarConta(@Param('id') id: string) { return this.svc.deletarConta(id); }
}
