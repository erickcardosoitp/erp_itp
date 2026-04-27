import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { FinanceiroService } from './financeiro.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModuloPermGuard } from '../auth/guards/modulo-perm.guard';
import { ModuloPerm } from '../auth/decorators/modulo-perm.decorator';

@Controller('financeiro')
@UseGuards(JwtAuthGuard, ModuloPermGuard)
export class FinanceiroController {
  constructor(private readonly svc: FinanceiroService) {}

  // ── TABELAS DE APOIO (lookup) — exige visualizar no módulo financeiro ──────

  @Get('tipos-movimentacao')
  @ModuloPerm('financeiro', 'visualizar')
  listarTiposMovimentacao() { return this.svc.listarTiposMovimentacao(); }

  @Post('tipos-movimentacao')
  @ModuloPerm('financeiro', 'incluir')
  criarTipoMovimentacao(@Body() dto: any) { return this.svc.criarTipoMovimentacao(dto); }

  @Patch('tipos-movimentacao/:id')
  @ModuloPerm('financeiro', 'editar')
  editarTipoMovimentacao(@Param('id') id: string, @Body() dto: any) { return this.svc.editarTipoMovimentacao(id, dto); }

  @Delete('tipos-movimentacao/:id')
  @ModuloPerm('financeiro', 'excluir')
  deletarTipoMovimentacao(@Param('id') id: string) { return this.svc.deletarTipoMovimentacao(id); }

  // ── PLANOS DE CONTAS ──────────────────────────────────────────────────────

  @Get('planos-contas')
  @ModuloPerm('financeiro', 'visualizar')
  listarPlanosContas() { return this.svc.listarPlanosContas(); }

  @Post('planos-contas')
  @ModuloPerm('financeiro', 'incluir')
  criarPlanoContas(@Body() dto: any) { return this.svc.criarPlanoContas(dto); }

  @Patch('planos-contas/:id')
  @ModuloPerm('financeiro', 'editar')
  editarPlanoContas(@Param('id') id: string, @Body() dto: any) { return this.svc.editarPlanoContas(id, dto); }

  @Delete('planos-contas/:id')
  @ModuloPerm('financeiro', 'excluir')
  deletarPlanoContas(@Param('id') id: string) { return this.svc.deletarPlanoContas(id); }

  // ── CATEGORIAS ────────────────────────────────────────────────────────────

  @Get('categorias')
  @ModuloPerm('financeiro', 'visualizar')
  listarCategorias() { return this.svc.listarCategorias(); }

  @Post('categorias')
  @ModuloPerm('financeiro', 'incluir')
  criarCategoria(@Body() dto: any) { return this.svc.criarCategoria(dto); }

  @Patch('categorias/:id')
  @ModuloPerm('financeiro', 'editar')
  editarCategoria(@Param('id') id: string, @Body() dto: any) { return this.svc.editarCategoria(id, dto); }

  @Delete('categorias/:id')
  @ModuloPerm('financeiro', 'excluir')
  deletarCategoria(@Param('id') id: string) { return this.svc.deletarCategoria(id); }

  // ── TIPOS DE PESSOA ───────────────────────────────────────────────────────

  @Get('tipos-pessoa')
  @ModuloPerm('financeiro', 'visualizar')
  listarTiposPessoa() { return this.svc.listarTiposPessoa(); }

  @Post('tipos-pessoa')
  @ModuloPerm('financeiro', 'incluir')
  criarTipoPessoa(@Body() dto: any) { return this.svc.criarTipoPessoa(dto); }

  @Patch('tipos-pessoa/:id')
  @ModuloPerm('financeiro', 'editar')
  editarTipoPessoa(@Param('id') id: string, @Body() dto: any) { return this.svc.editarTipoPessoa(id, dto); }

  @Delete('tipos-pessoa/:id')
  @ModuloPerm('financeiro', 'excluir')
  deletarTipoPessoa(@Param('id') id: string) { return this.svc.deletarTipoPessoa(id); }

  // ── FORMAS DE PAGAMENTO ───────────────────────────────────────────────────

  @Get('formas-pagamento')
  @ModuloPerm('financeiro', 'visualizar')
  listarFormasPagamento() { return this.svc.listarFormasPagamento(); }

  @Post('formas-pagamento')
  @ModuloPerm('financeiro', 'incluir')
  criarFormaPagamento(@Body() dto: any) { return this.svc.criarFormaPagamento(dto); }

  @Patch('formas-pagamento/:id')
  @ModuloPerm('financeiro', 'editar')
  editarFormaPagamento(@Param('id') id: string, @Body() dto: any) { return this.svc.editarFormaPagamento(id, dto); }

  @Delete('formas-pagamento/:id')
  @ModuloPerm('financeiro', 'excluir')
  deletarFormaPagamento(@Param('id') id: string) { return this.svc.deletarFormaPagamento(id); }

  // ── RECORRÊNCIAS ──────────────────────────────────────────────────────────

  @Get('recorrencias')
  @ModuloPerm('financeiro', 'visualizar')
  listarRecorrencias() { return this.svc.listarRecorrencias(); }

  @Post('recorrencias')
  @ModuloPerm('financeiro', 'incluir')
  criarRecorrencia(@Body() dto: any) { return this.svc.criarRecorrencia(dto); }

  @Patch('recorrencias/:id')
  @ModuloPerm('financeiro', 'editar')
  editarRecorrencia(@Param('id') id: string, @Body() dto: any) { return this.svc.editarRecorrencia(id, dto); }

  @Delete('recorrencias/:id')
  @ModuloPerm('financeiro', 'excluir')
  deletarRecorrencia(@Param('id') id: string) { return this.svc.deletarRecorrencia(id); }

  // ── MOVIMENTAÇÕES FINANCEIRAS ─────────────────────────────────────────────

  @Get('movimentacoes')
  @ModuloPerm('financeiro', 'visualizar')
  listarMovimentacoes() { return this.svc.listarMovimentacoes(); }

  @Get('doacoes')
  @ModuloPerm('doacoes', 'visualizar')
  listarDoacoes() { return this.svc.listarDoacoes(); }

  @Post('movimentacoes')
  @ModuloPerm('financeiro', 'incluir')
  criarMovimentacao(@Body() dto: any, @Req() req: any) {
    const usuarioNome = req.user?.nome || req.user?.email || 'Sistema';
    return this.svc.criarMovimentacao({ ...dto, usuario_nome: usuarioNome });
  }

  @Patch('movimentacoes/:id')
  @ModuloPerm('financeiro', 'editar')
  editarMovimentacao(@Param('id') id: string, @Body() dto: any) { return this.svc.editarMovimentacao(id, dto); }

  @Delete('movimentacoes/:id')
  @ModuloPerm('financeiro', 'excluir')
  deletarMovimentacao(@Param('id') id: string) { return this.svc.deletarMovimentacao(id); }

  // ── BOLETOS A RECEBER ─────────────────────────────────────────────────────

  @Get('boletos')
  @ModuloPerm('financeiro', 'visualizar')
  listarBoletos() { return this.svc.listarBoletos(); }

  @Post('boletos')
  @ModuloPerm('financeiro', 'incluir')
  criarBoleto(@Body() dto: any) { return this.svc.criarBoleto(dto); }

  @Patch('boletos/:id')
  @ModuloPerm('financeiro', 'editar')
  atualizarBoleto(@Param('id') id: string, @Body() dto: any) { return this.svc.atualizarBoleto(id, dto); }

  @Patch('boletos/parcelas/:parcelaId/pagar')
  @ModuloPerm('financeiro', 'editar')
  marcarParcelaPaga(@Param('parcelaId') parcelaId: string, @Body() dto: any) {
    return this.svc.marcarParcelaPaga(parcelaId, dto);
  }

  @Delete('boletos/:id')
  @ModuloPerm('financeiro', 'excluir')
  deletarBoleto(@Param('id') id: string) { return this.svc.deletarBoleto(id); }
}
