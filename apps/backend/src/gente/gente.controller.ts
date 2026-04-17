import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards, Request,
} from '@nestjs/common';
import { GenteService } from './gente.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModuloPermGuard } from '../auth/guards/modulo-perm.guard';
import { ModuloPerm } from '../auth/decorators/modulo-perm.decorator';
import { Public } from '../auth/decorators/public.decorator';

@UseGuards(JwtAuthGuard, ModuloPermGuard)
@Controller('gente')
export class GenteController {
  constructor(private readonly svc: GenteService) {}

  // ── Colaboradores ──────────────────────────────────────────────────────────

  @Get('colaboradores')
  @ModuloPerm('gente', 'visualizar')
  listar() { return this.svc.listarColaboradores(); }

  @Get('colaboradores/funcionarios-disponiveis')
  @ModuloPerm('gente', 'visualizar')
  funcionariosDisponiveis() { return this.svc.funcionariosDisponiveis(); }

  @Get('colaboradores/:id')
  @ModuloPerm('gente', 'visualizar')
  buscar(@Param('id') id: string) { return this.svc.buscarColaborador(id); }

  @Get('colaboradores/:id/resumo')
  @ModuloPerm('gente', 'visualizar')
  resumo(@Param('id') id: string) { return this.svc.resumoColaborador(id); }

  @Post('colaboradores')
  @ModuloPerm('gente', 'incluir')
  criar(@Body() dto: any, @Request() req: any) {
    return this.svc.criarColaborador({ ...dto, criado_por_id: req.user?.userId });
  }

  @Patch('colaboradores/:id')
  @ModuloPerm('gente', 'editar')
  editar(@Param('id') id: string, @Body() dto: any) { return this.svc.editarColaborador(id, dto); }

  @Delete('colaboradores/:id')
  @ModuloPerm('gente', 'excluir')
  remover(@Param('id') id: string) { return this.svc.removerColaborador(id); }

  // ── Ponto ─────────────────────────────────────────────────────────────────

  @Get('ponto')
  @ModuloPerm('gente', 'visualizar')
  listarPonto(
    @Query('colaborador_id') colaborador_id?: string,
    @Query('data_inicio') data_inicio?: string,
    @Query('data_fim') data_fim?: string,
  ) { return this.svc.listarPonto(colaborador_id, data_inicio, data_fim); }

  @Post('ponto')
  @ModuloPerm('gente', 'incluir')
  registrarPonto(@Body() dto: any, @Request() req: any) {
    return this.svc.registrarPonto(dto, req.user?.nome ?? 'gestor');
  }

  @Delete('ponto/:id')
  @ModuloPerm('gente', 'excluir')
  deletarPonto(@Param('id') id: string) { return this.svc.deletarPonto(id); }

  // ── Ponto externo (público, token-based) ──────────────────────────────────

  @Public()
  @Get('ponto/externo/verificar')
  verificarExterno(
    @Query('token') token: string,
    @Query('identificador') identificador: string,
  ) { return this.svc.verificarColaboradorExterno(token, identificador); }

  @Public()
  @Post('ponto/externo')
  pontoExterno(@Body() body: any) {
    return this.svc.registrarPontoExterno(
      body.token,
      body.identificador,
      body.tipo,
      body.latitude,
      body.longitude,
      body.observacao,
    );
  }

  // ── Recibos ───────────────────────────────────────────────────────────────

  @Get('recibos')
  @ModuloPerm('gente', 'visualizar')
  listarRecibos(@Query('colaborador_id') colaborador_id?: string) {
    return this.svc.listarRecibos(colaborador_id);
  }

  @Post('recibos')
  @ModuloPerm('gente', 'incluir')
  criarRecibo(@Body() dto: any, @Request() req: any) {
    return this.svc.criarRecibo({ ...dto, criado_por_id: req.user?.userId, criado_por_nome: req.user?.nome });
  }

  @Patch('recibos/:id')
  @ModuloPerm('gente', 'editar')
  editarRecibo(@Param('id') id: string, @Body() dto: any) { return this.svc.editarRecibo(id, dto); }

  @Delete('recibos/:id')
  @ModuloPerm('gente', 'excluir')
  deletarRecibo(@Param('id') id: string) { return this.svc.deletarRecibo(id); }

  // ── Vales ─────────────────────────────────────────────────────────────────

  @Get('vales')
  @ModuloPerm('gente', 'visualizar')
  listarVales(@Query('colaborador_id') colaborador_id?: string) {
    return this.svc.listarVales(colaborador_id);
  }

  @Post('vales')
  @ModuloPerm('gente', 'incluir')
  criarVale(@Body() dto: any, @Request() req: any) {
    return this.svc.criarVale({ ...dto, criado_por_id: req.user?.userId, criado_por_nome: req.user?.nome });
  }

  @Patch('vales/:id')
  @ModuloPerm('gente', 'editar')
  editarVale(@Param('id') id: string, @Body() dto: any) { return this.svc.editarVale(id, dto); }

  @Delete('vales/:id')
  @ModuloPerm('gente', 'excluir')
  deletarVale(@Param('id') id: string) { return this.svc.deletarVale(id); }

  // ── Advertências ──────────────────────────────────────────────────────────

  @Get('advertencias')
  @ModuloPerm('gente', 'visualizar')
  listarAdvertencias(@Query('colaborador_id') colaborador_id?: string) {
    return this.svc.listarAdvertencias(colaborador_id);
  }

  @Post('advertencias')
  @ModuloPerm('gente', 'incluir')
  criarAdvertencia(@Body() dto: any, @Request() req: any) {
    return this.svc.criarAdvertencia({ ...dto, criado_por_id: req.user?.userId, criado_por_nome: req.user?.nome });
  }

  @Patch('advertencias/:id')
  @ModuloPerm('gente', 'editar')
  editarAdvertencia(@Param('id') id: string, @Body() dto: any) { return this.svc.editarAdvertencia(id, dto); }

  @Delete('advertencias/:id')
  @ModuloPerm('gente', 'excluir')
  deletarAdvertencia(@Param('id') id: string) { return this.svc.deletarAdvertencia(id); }

  // ── Suspensões ────────────────────────────────────────────────────────────

  @Get('suspensoes')
  @ModuloPerm('gente', 'visualizar')
  listarSuspensoes(@Query('colaborador_id') colaborador_id?: string) {
    return this.svc.listarSuspensoes(colaborador_id);
  }

  @Post('suspensoes')
  @ModuloPerm('gente', 'incluir')
  criarSuspensao(@Body() dto: any, @Request() req: any) {
    return this.svc.criarSuspensao({ ...dto, criado_por_id: req.user?.userId, criado_por_nome: req.user?.nome });
  }

  @Patch('suspensoes/:id')
  @ModuloPerm('gente', 'editar')
  editarSuspensao(@Param('id') id: string, @Body() dto: any) { return this.svc.editarSuspensao(id, dto); }

  @Delete('suspensoes/:id')
  @ModuloPerm('gente', 'excluir')
  deletarSuspensao(@Param('id') id: string) { return this.svc.deletarSuspensao(id); }

  // ── Faltas ────────────────────────────────────────────────────────────────

  @Get('faltas')
  @ModuloPerm('gente', 'visualizar')
  listarFaltas(@Query('colaborador_id') colaborador_id?: string) {
    return this.svc.listarFaltas(colaborador_id);
  }

  @Post('faltas')
  @ModuloPerm('gente', 'incluir')
  criarFalta(@Body() dto: any, @Request() req: any) {
    return this.svc.criarFalta({ ...dto, criado_por_id: req.user?.userId, criado_por_nome: req.user?.nome });
  }

  @Patch('faltas/:id')
  @ModuloPerm('gente', 'editar')
  editarFalta(@Param('id') id: string, @Body() dto: any) { return this.svc.editarFalta(id, dto); }

  @Delete('faltas/:id')
  @ModuloPerm('gente', 'excluir')
  deletarFalta(@Param('id') id: string) { return this.svc.deletarFalta(id); }
}
