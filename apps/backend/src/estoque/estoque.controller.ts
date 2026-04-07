import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Req, Logger,
  UnauthorizedException, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role, ESTOQUE_READ_ROLES, ESTOQUE_WRITE_ROLES, ESTOQUE_BAIXA_ROLES, ESTOQUE_ENTRADA_ROLES } from '../auth/constants/roles.enum';
import { Public } from '../auth/decorators/public.decorator';
import { EstoqueService } from './estoque.service';

@Controller('estoque')
export class EstoqueController {
  private readonly logger = new Logger(EstoqueController.name);

  constructor(private readonly svc: EstoqueService) {}

  // ── Produtos ──────────────────────────────────────────────────────────────

  @Get('produtos')
  @Roles(...ESTOQUE_READ_ROLES)
  listar() {
    return this.svc.listarTodos();
  }

  @Post('produtos')
  @Roles(...ESTOQUE_WRITE_ROLES)
  criar(@Body() body: any) {
    return this.svc.criarProduto(body);
  }

  @Patch('produtos/:id')
  @Roles(...ESTOQUE_WRITE_ROLES)
  atualizar(@Param('id') id: string, @Body() body: any) {
    return this.svc.atualizarProduto(id, body);
  }

  @Delete('produtos/:id')
  @Roles(Role.ADMIN, Role.DRT)
  deletar(@Param('id') id: string) {
    return this.svc.deletarProduto(id);
  }

  @Get('alertas')
  @Roles(...ESTOQUE_BAIXA_ROLES)
  alertas() {
    return this.svc.listarAlertas();
  }

  // ── Movimentos autenticados ───────────────────────────────────────────────

  @Post('produtos/:id/entrada')
  @Roles(...ESTOQUE_ENTRADA_ROLES)
  entrada(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const nome = req.user?.nome || req.user?.email || 'Sistema';
    const preco = body.preco_pago != null ? Number(body.preco_pago) : undefined;
    return this.svc.registrarEntrada(id, Number(body.quantidade), body.observacao, nome, preco);
  }

  @Get('valor')
  @Roles(...ESTOQUE_READ_ROLES)
  valorEstoque() {
    return this.svc.relatorioValor();
  }

  @Post('produtos/:id/baixa')
  @Roles(...ESTOQUE_BAIXA_ROLES)
  baixa(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const nome = req.user?.nome || req.user?.email || 'Sistema';
    return this.svc.registrarBaixa(id, Number(body.quantidade), body.observacao, nome);
  }

  @Get('movimentos')
  @Roles(...ESTOQUE_ENTRADA_ROLES)
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
  @Roles(...ESTOQUE_READ_ROLES)
  listarCategorias() {
    return this.svc.listarCategorias();
  }

  @Post('categorias')
  @Roles(...ESTOQUE_WRITE_ROLES)
  criarCategoria(@Body() body: { nome: string; codigo?: string }) {
    return this.svc.criarCategoria(body.nome, body.codigo);
  }

  @Patch('categorias/:id')
  @Roles(...ESTOQUE_WRITE_ROLES)
  atualizarCategoria(@Param('id') id: string, @Body() body: { nome: string; codigo?: string }) {
    return this.svc.atualizarCategoria(id, body.nome, body.codigo);
  }

  @Delete('categorias/:id')
  @Roles(Role.ADMIN, Role.DRT)
  deletarCategoria(@Param('id') id: string) {
    return this.svc.deletarCategoria(id);
  }

  private validarTokenColetor(token?: string) {
    // Aceita o token do env var E o token padrão para evitar falha quando
    // COLETOR_TOKEN está definido com valor diferente em algum ambiente
    const tokens = new Set(
      [
        'itp-coletor-2026', // sempre aceito como fallback
        process.env.COLETOR_TOKEN,
        process.env.NEXT_PUBLIC_COLETOR_TOKEN,
      ].filter(Boolean) as string[],
    );
    if (!token || !tokens.has(token)) {
      throw new UnauthorizedException('Token de coletor inválido.');
    }
  }
}
