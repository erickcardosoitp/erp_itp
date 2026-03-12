import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Req, Logger,
  UnauthorizedException, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants/roles.enum';
import { Public } from '../auth/decorators/public.decorator';
import { EstoqueService } from './estoque.service';

@Controller('estoque')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EstoqueController {
  private readonly logger = new Logger(EstoqueController.name);

  constructor(private readonly svc: EstoqueService) {}

  // ── Produtos ──────────────────────────────────────────────────────────────

  @Get('produtos')
  @Roles(Role.ADMIN, Role.VP, Role.DRT, Role.DRT_ADJ, Role.ASSIST, Role.CZNH, Role.MNT, Role.PROF)
  listar() {
    return this.svc.listarTodos();
  }

  @Post('produtos')
  @Roles(Role.ADMIN, Role.VP, Role.DRT, Role.DRT_ADJ)
  criar(@Body() body: any) {
    return this.svc.criarProduto(body);
  }

  @Patch('produtos/:id')
  @Roles(Role.ADMIN, Role.VP, Role.DRT, Role.DRT_ADJ)
  atualizar(@Param('id') id: string, @Body() body: any) {
    return this.svc.atualizarProduto(id, body);
  }

  @Delete('produtos/:id')
  @Roles(Role.ADMIN, Role.DRT)
  deletar(@Param('id') id: string) {
    return this.svc.deletarProduto(id);
  }

  @Get('alertas')
  @Roles(Role.ADMIN, Role.VP, Role.DRT, Role.DRT_ADJ, Role.ASSIST, Role.CZNH)
  alertas() {
    return this.svc.listarAlertas();
  }

  // ── Movimentos autenticados ───────────────────────────────────────────────

  @Post('produtos/:id/entrada')
  @Roles(Role.ADMIN, Role.VP, Role.DRT, Role.DRT_ADJ, Role.ASSIST)
  entrada(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const nome = req.user?.nome || req.user?.email || 'Sistema';
    return this.svc.registrarEntrada(id, Number(body.quantidade), body.observacao, nome);
  }

  @Post('produtos/:id/baixa')
  @Roles(Role.ADMIN, Role.VP, Role.DRT, Role.DRT_ADJ, Role.ASSIST, Role.CZNH)
  baixa(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const nome = req.user?.nome || req.user?.email || 'Sistema';
    return this.svc.registrarBaixa(id, Number(body.quantidade), body.observacao, nome);
  }

  @Get('movimentos')
  @Roles(Role.ADMIN, Role.VP, Role.DRT, Role.DRT_ADJ, Role.ASSIST)
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
  @Roles(Role.ADMIN, Role.VP, Role.DRT, Role.DRT_ADJ, Role.ASSIST, Role.CZNH, Role.MNT, Role.PROF)
  listarCategorias() {
    return this.svc.listarCategorias();
  }

  @Post('categorias')
  @Roles(Role.ADMIN, Role.VP, Role.DRT, Role.DRT_ADJ)
  criarCategoria(@Body() body: { nome: string }) {
    return this.svc.criarCategoria(body.nome);
  }

  @Patch('categorias/:id')
  @Roles(Role.ADMIN, Role.VP, Role.DRT, Role.DRT_ADJ)
  atualizarCategoria(@Param('id') id: string, @Body() body: { nome: string }) {
    return this.svc.atualizarCategoria(id, body.nome);
  }

  @Delete('categorias/:id')
  @Roles(Role.ADMIN, Role.DRT)
  deletarCategoria(@Param('id') id: string) {
    return this.svc.deletarCategoria(id);
  }

  private validarTokenColetor(token?: string) {
    const esperado = process.env.COLETOR_TOKEN;
    if (!esperado) {
      this.logger.warn('⚠️  COLETOR_TOKEN não definido — acesso ao coletor bloqueado.');
      throw new UnauthorizedException('Coletor não configurado. Contate o administrador.');
    }
    if (token !== esperado) {
      throw new UnauthorizedException('Token de coletor inválido.');
    }
  }
}
