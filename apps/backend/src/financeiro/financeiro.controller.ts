import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { FinanceiroService } from './financeiro.service';

@Controller('financeiro')
export class FinanceiroController {
  constructor(private readonly svc: FinanceiroService) {}

  // ── TIPOS DE MOVIMENTAÇÃO ─────────────────────────────────────────────────

  @Get('tipos-movimentacao')
  listarTiposMovimentacao() { return this.svc.listarTiposMovimentacao(); }

  @Post('tipos-movimentacao')
  criarTipoMovimentacao(@Body() dto: any) { return this.svc.criarTipoMovimentacao(dto); }

  @Patch('tipos-movimentacao/:id')
  editarTipoMovimentacao(@Param('id') id: string, @Body() dto: any) { return this.svc.editarTipoMovimentacao(id, dto); }

  @Delete('tipos-movimentacao/:id')
  deletarTipoMovimentacao(@Param('id') id: string) { return this.svc.deletarTipoMovimentacao(id); }

  // ── PLANOS DE CONTAS ──────────────────────────────────────────────────────

  @Get('planos-contas')
  listarPlanosContas() { return this.svc.listarPlanosContas(); }

  @Post('planos-contas')
  criarPlanoContas(@Body() dto: any) { return this.svc.criarPlanoContas(dto); }

  @Patch('planos-contas/:id')
  editarPlanoContas(@Param('id') id: string, @Body() dto: any) { return this.svc.editarPlanoContas(id, dto); }

  @Delete('planos-contas/:id')
  deletarPlanoContas(@Param('id') id: string) { return this.svc.deletarPlanoContas(id); }

  // ── CATEGORIAS ────────────────────────────────────────────────────────────

  @Get('categorias')
  listarCategorias() { return this.svc.listarCategorias(); }

  @Post('categorias')
  criarCategoria(@Body() dto: any) { return this.svc.criarCategoria(dto); }

  @Patch('categorias/:id')
  editarCategoria(@Param('id') id: string, @Body() dto: any) { return this.svc.editarCategoria(id, dto); }

  @Delete('categorias/:id')
  deletarCategoria(@Param('id') id: string) { return this.svc.deletarCategoria(id); }

  // ── TIPOS DE PESSOA ───────────────────────────────────────────────────────

  @Get('tipos-pessoa')
  listarTiposPessoa() { return this.svc.listarTiposPessoa(); }

  @Post('tipos-pessoa')
  criarTipoPessoa(@Body() dto: any) { return this.svc.criarTipoPessoa(dto); }

  @Patch('tipos-pessoa/:id')
  editarTipoPessoa(@Param('id') id: string, @Body() dto: any) { return this.svc.editarTipoPessoa(id, dto); }

  @Delete('tipos-pessoa/:id')
  deletarTipoPessoa(@Param('id') id: string) { return this.svc.deletarTipoPessoa(id); }

  // ── FORMAS DE PAGAMENTO ───────────────────────────────────────────────────

  @Get('formas-pagamento')
  listarFormasPagamento() { return this.svc.listarFormasPagamento(); }

  @Post('formas-pagamento')
  criarFormaPagamento(@Body() dto: any) { return this.svc.criarFormaPagamento(dto); }

  @Patch('formas-pagamento/:id')
  editarFormaPagamento(@Param('id') id: string, @Body() dto: any) { return this.svc.editarFormaPagamento(id, dto); }

  @Delete('formas-pagamento/:id')
  deletarFormaPagamento(@Param('id') id: string) { return this.svc.deletarFormaPagamento(id); }

  // ── RECORRÊNCIAS ──────────────────────────────────────────────────────────

  @Get('recorrencias')
  listarRecorrencias() { return this.svc.listarRecorrencias(); }

  @Post('recorrencias')
  criarRecorrencia(@Body() dto: any) { return this.svc.criarRecorrencia(dto); }

  @Patch('recorrencias/:id')
  editarRecorrencia(@Param('id') id: string, @Body() dto: any) { return this.svc.editarRecorrencia(id, dto); }

  @Delete('recorrencias/:id')
  deletarRecorrencia(@Param('id') id: string) { return this.svc.deletarRecorrencia(id); }

  // ── MOVIMENTAÇÕES FINANCEIRAS ─────────────────────────────────────────────

  @Get('movimentacoes')
  listarMovimentacoes() { return this.svc.listarMovimentacoes(); }

  @Get('doacoes')
  listarDoacoes() { return this.svc.listarDoacoes(); }

  @Post('movimentacoes')
  criarMovimentacao(@Body() dto: any) { return this.svc.criarMovimentacao(dto); }

  @Patch('movimentacoes/:id')
  editarMovimentacao(@Param('id') id: string, @Body() dto: any) { return this.svc.editarMovimentacao(id, dto); }

  @Delete('movimentacoes/:id')
  deletarMovimentacao(@Param('id') id: string) { return this.svc.deletarMovimentacao(id); }
}
