import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Req, Logger,
  UnauthorizedException, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModuloPermGuard } from '../auth/guards/modulo-perm.guard';
import { ModuloPerm } from '../auth/decorators/modulo-perm.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { EstoqueService } from './estoque.service';

@Controller('estoque')
@UseGuards(JwtAuthGuard, ModuloPermGuard)
export class EstoqueController {
  private readonly logger = new Logger(EstoqueController.name);

  constructor(private readonly svc: EstoqueService) {}

  // ── Produtos ──────────────────────────────────────────────────────────────

  @Get('produtos')
  @ModuloPerm('estoque', 'visualizar')
  listar() {
    return this.svc.listarTodos();
  }

  @Post('produtos')
  @ModuloPerm('estoque', 'incluir')
  criar(@Body() body: any) {
    return this.svc.criarProduto(body);
  }

  @Patch('produtos/:id')
  @ModuloPerm('estoque', 'editar')
  atualizar(@Param('id') id: string, @Body() body: any) {
    return this.svc.atualizarProduto(id, body);
  }

  @Delete('produtos/:id')
  @ModuloPerm('estoque', 'excluir')
  deletar(@Param('id') id: string) {
    return this.svc.deletarProduto(id);
  }

  @Get('alertas')
  @ModuloPerm('estoque', 'visualizar')
  alertas() {
    return this.svc.listarAlertas();
  }

  // ── Movimentos autenticados ───────────────────────────────────────────────

  @Post('produtos/:id/entrada')
  @ModuloPerm('estoque', 'incluir')
  entrada(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const nome = req.user?.nome || req.user?.email || 'Sistema';
    const preco = body.preco_pago != null ? Number(body.preco_pago) : undefined;
    return this.svc.registrarEntrada(id, Number(body.quantidade), body.observacao, nome, preco);
  }

  @Get('valor')
  @ModuloPerm('estoque', 'visualizar')
  valorEstoque() {
    return this.svc.relatorioValor();
  }

  @Post('produtos/:id/baixa')
  @ModuloPerm('estoque', 'incluir')
  baixa(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const nome = req.user?.nome || req.user?.email || 'Sistema';
    return this.svc.registrarBaixa(id, Number(body.quantidade), body.observacao, nome);
  }

  @Get('movimentos')
  @ModuloPerm('estoque', 'visualizar')
  movimentos(
    @Query('produto_id') produtoId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.listarMovimentos(produtoId, limit ? Number(limit) : 100);
  }

  // ── Coletor (rotas públicas protegidas por token estático) ────────────────

  @Public()
  @Get('coletor/produtos')
  coletorProdutos(@Query('token') token: string) {
    this.validarTokenColetor(token);
    return this.svc.listarColetorPublico();
  }

  @Public()
  @Post('coletor/baixa')
  async coletorBaixa(@Body() body: any) {
    this.validarTokenColetor(body.token);
    return this.svc.registrarBaixa(
      body.produto_id,
      Number(body.quantidade),
      body.observacao || 'Baixa via coletor',
      body.operador || 'Coletor',
    );
  }

  // ── Categorias ────────────────────────────────────────────────────────────

  @Get('categorias')
  @ModuloPerm('estoque', 'visualizar')
  listarCategorias() {
    return this.svc.listarCategorias();
  }

  @Post('categorias')
  @ModuloPerm('estoque', 'incluir')
  criarCategoria(@Body() body: { nome: string; codigo?: string }) {
    return this.svc.criarCategoria(body.nome, body.codigo);
  }

  @Patch('categorias/:id')
  @ModuloPerm('estoque', 'editar')
  atualizarCategoria(@Param('id') id: string, @Body() body: { nome: string; codigo?: string }) {
    return this.svc.atualizarCategoria(id, body.nome, body.codigo);
  }

  @Delete('categorias/:id')
  @ModuloPerm('estoque', 'excluir')
  deletarCategoria(@Param('id') id: string) {
    return this.svc.deletarCategoria(id);
  }

  private validarTokenColetor(token?: string) {
    const tokens = new Set(
      [
        'itp-coletor-2026',
        process.env.COLETOR_TOKEN,
        process.env.NEXT_PUBLIC_COLETOR_TOKEN,
      ].filter(Boolean) as string[],
    );
    if (!token || !tokens.has(token)) {
      throw new UnauthorizedException('Token de coletor inválido.');
    }
  }
}
