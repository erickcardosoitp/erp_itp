import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards, Request,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
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

  @Get('colaboradores/:id/codigos')
  @ModuloPerm('gente', 'visualizar')
  codigosColaborador(@Param('id') id: string) { return this.svc.listarCodigosColaborador(id); }

  @Post('colaboradores')
  @ModuloPerm('gente', 'incluir')
  criar(@Body() dto: any, @Request() req: any) {
    return this.svc.criarColaborador({ ...dto, criado_por_id: req.user?.userId });
  }

  /** Cria funcionário + colaborador em um único passo */
  @Post('colaboradores/novo-funcionario')
  @ModuloPerm('gente', 'incluir')
  criarFuncionario(@Body() body: any, @Request() req: any) {
    const { funcionario, colaborador } = body;
    return this.svc.criarFuncionarioEColaborador(funcionario, colaborador ?? {}, req.user?.userId, );
  }

  @Post('colaboradores/:id/codigos')
  @ModuloPerm('gente', 'incluir')
  atribuirCodigo(@Param('id') id: string, @Body() body: any) {
    return this.svc.atribuirCodigoColaborador(id, body.codigo_id, body.valor_personalizado);
  }

  @Delete('colaborador-codigos/:id')
  @ModuloPerm('gente', 'editar')
  removerCodigoColaborador(@Param('id') id: string) { return this.svc.removerCodigoColaborador(id); }

  @Patch('colaboradores/:id')
  @ModuloPerm('gente', 'editar')
  editar(@Param('id') id: string, @Body() dto: any) { return this.svc.editarColaborador(id, dto); }

  @Patch('colaboradores/:id/funcionario')
  @ModuloPerm('gente', 'editar')
  editarFuncionario(@Param('id') id: string, @Body() dto: any) { return this.svc.editarFuncionarioViaGente(id, dto); }

  @Patch('colaboradores/:id/foto')
  @ModuloPerm('gente', 'editar')
  @UseInterceptors(FileInterceptor('foto', { storage: memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } }))
  async uploadFotoColaborador(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado.');
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) throw new BadRequestException('Formato inválido.');
    const foto = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    // Atualiza foto no funcionário vinculado
    const col = await this.svc.buscarColaborador(id);
    if (col?.funcionario?.id) {
      await require('typeorm').getRepository ? null : null; // handled in service
    }
    return this.svc.editarColaborador(id, { foto_override: foto });
  }

  @Delete('colaboradores/:id')
  @ModuloPerm('gente', 'excluir')
  remover(@Param('id') id: string) { return this.svc.removerColaborador(id); }

  // ── Locais permitidos por colaborador ─────────────────────────────────────

  @Get('colaboradores/:id/locais')
  @ModuloPerm('gente', 'visualizar')
  listarLocais(@Param('id') id: string) { return this.svc.listarLocais(id); }

  @Post('colaboradores/:id/locais')
  @ModuloPerm('gente', 'editar')
  criarLocal(@Param('id') id: string, @Body() dto: any) {
    return this.svc.criarLocal({ ...dto, colaborador_id: id });
  }

  @Patch('locais/:id')
  @ModuloPerm('gente', 'editar')
  editarLocal(@Param('id') id: string, @Body() dto: any) { return this.svc.editarLocal(id, dto); }

  @Delete('locais/:id')
  @ModuloPerm('gente', 'excluir')
  deletarLocal(@Param('id') id: string) { return this.svc.deletarLocal(id); }

  // ── Códigos de Ajuda de Custo (VRX) ──────────────────────────────────────

  @Get('codigos-ajuda')
  @ModuloPerm('gente', 'visualizar')
  listarCodigos() { return this.svc.listarCodigos(); }

  @Post('codigos-ajuda')
  @ModuloPerm('gente', 'incluir')
  criarCodigo(@Body() dto: any) { return this.svc.criarCodigo(dto); }

  @Patch('codigos-ajuda/:id')
  @ModuloPerm('gente', 'editar')
  editarCodigo(@Param('id') id: string, @Body() dto: any) { return this.svc.editarCodigo(id, dto); }

  @Delete('codigos-ajuda/:id')
  @ModuloPerm('gente', 'excluir')
  deletarCodigo(@Param('id') id: string) { return this.svc.deletarCodigo(id); }

  // ── Financeiro ────────────────────────────────────────────────────────────

  @Get('financeiro/resumo')
  @ModuloPerm('gente', 'visualizar')
  resumoFinanceiro(@Query('mes') mes?: string) {
    const m = mes || new Date().toISOString().slice(0, 7);
    return this.svc.resumoFinanceiro(m);
  }

  // ── Folha / Recibos ────────────────────────────────────────────────────────

  @Post('folha/calcular')
  @ModuloPerm('gente', 'incluir')
  calcularFolha(@Body() body: any, @Request() req: any) {
    return this.svc.calcularFolha(body.mes_referencia, req.user?.userId, req.user?.nome ?? 'sistema');
  }

  @Get('recibos')
  @ModuloPerm('gente', 'visualizar')
  listarRecibos(@Query('colaborador_id') colaborador_id?: string) { return this.svc.listarRecibos(colaborador_id); }

  @Get('recibos/:id/completo')
  @ModuloPerm('gente', 'visualizar')
  reciboCompleto(@Param('id') id: string) { return this.svc.buscarReciboCompleto(id); }

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

  // ── Ponto ─────────────────────────────────────────────────────────────────

  @Get('ponto')
  @ModuloPerm('gente', 'visualizar')
  listarPonto(@Query('colaborador_id') c?: string, @Query('data_inicio') i?: string, @Query('data_fim') f?: string) {
    return this.svc.listarPonto(c, i, f);
  }

  @Post('ponto')
  @ModuloPerm('gente', 'incluir')
  registrarPonto(@Body() dto: any, @Request() req: any) { return this.svc.registrarPonto(dto, req.user?.nome ?? 'gestor'); }

  @Get('ponto/alertas')
  @ModuloPerm('gente', 'visualizar')
  alertasAusencia() { return this.svc.alertasAusencia(); }

  @Get('ponto/relatorio')
  @ModuloPerm('gente', 'visualizar')
  relatorioPonto(@Query('data_inicio') data_inicio: string, @Query('data_fim') data_fim: string) {
    const inicio = data_inicio || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const fim = data_fim || new Date().toISOString().split('T')[0];
    return this.svc.relatorioPonto(inicio, fim);
  }

  @Delete('ponto/:id')
  @ModuloPerm('gente', 'excluir')
  deletarPonto(@Param('id') id: string) { return this.svc.deletarPonto(id); }

  @Public()
  @Get('ponto/externo/verificar')
  verificarExterno(@Query('token') token: string, @Query('identificador') identificador: string) {
    return this.svc.verificarColaboradorExterno(token, identificador);
  }

  @Public()
  @Post('ponto/externo')
  pontoExterno(@Body() body: any) {
    return this.svc.registrarPontoExterno(body.token, body.identificador, body.tipo, body.latitude, body.longitude, body.observacao, body.assinatura);
  }

  @Public()
  @Get('ponto/externo/historico')
  historicoExterno(@Query('token') token: string, @Query('colaborador_id') colaborador_id: string) {
    return this.svc.historicoExterno(colaborador_id, 60);
  }

  @Public()
  @Get('ponto/externo/banco-horas')
  bancoHorasExterno(@Query('colaborador_id') colaborador_id: string, @Query('mes') mes?: string) {
    return this.svc.bancoHoras(colaborador_id, mes);
  }

  // ── Folgas ────────────────────────────────────────────────────────────────

  @Get('folgas')
  @ModuloPerm('gente', 'visualizar')
  listarFolgas(@Query('colaborador_id') c?: string) { return this.svc.listarFolgas(c); }

  @Public()
  @Get('folgas/disponibilidade')
  consultarDisponibilidade(@Query('colaborador_id') colaborador_id: string) {
    return this.svc.consultarDisponibilidadeFolgas(colaborador_id);
  }

  @Public()
  @Post('folgas/solicitar')
  solicitarFolga(@Body() body: any) {
    return this.svc.solicitarFolga(body.colaborador_id, body.data);
  }

  @Post('folgas/admin')
  @ModuloPerm('gente', 'editar')
  criarFolgaAdmin(@Body() body: any, @Request() req: any) {
    return this.svc.criarFolgaAdmin(body.colaborador_id, body.data, req.user?.nome ?? 'admin');
  }

  @Public()
  @Get('folgas/pendentes-confirmacao')
  folgasPendentesConfirmacao(@Query('colaborador_id') colaborador_id: string) {
    return this.svc.folgasPendentesConfirmacao(colaborador_id);
  }

  @Public()
  @Post('folgas/:id/confirmar')
  confirmarRealizacaoFolga(@Param('id') id: string, @Body() body: { realizada: boolean }) {
    return this.svc.confirmarRealizacaoFolga(id, body.realizada);
  }

  @Patch('folgas/:id/responder')
  @ModuloPerm('gente', 'editar')
  responderFolga(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.svc.responderFolga(id, body.status, req.user?.nome ?? 'admin');
  }

  // ── Trabalho externo ──────────────────────────────────────────────────────

  @Get('trabalho-externo')
  @ModuloPerm('gente', 'visualizar')
  listarTrabalhoExterno(@Query('colaborador_id') c?: string) { return this.svc.listarTrabalhoExterno(c); }

  @Post('trabalho-externo')
  @ModuloPerm('gente', 'editar')
  habilitarTrabalhoExterno(@Body() body: any, @Request() req: any) {
    return this.svc.habilitarTrabalhoExterno(body.colaborador_id, body.data, req.user?.nome ?? 'admin', req.user?.userId);
  }

  @Delete('trabalho-externo/:id')
  @ModuloPerm('gente', 'editar')
  revogarTrabalhoExterno(@Param('id') id: string) { return this.svc.revogarTrabalhoExterno(id); }

  // ── Vales ─────────────────────────────────────────────────────────────────

  @Get('vales')
  @ModuloPerm('gente', 'visualizar')
  listarVales(@Query('colaborador_id') c?: string) { return this.svc.listarVales(c); }

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
  listarAdvertencias(@Query('colaborador_id') c?: string) { return this.svc.listarAdvertencias(c); }

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
  listarSuspensoes(@Query('colaborador_id') c?: string) { return this.svc.listarSuspensoes(c); }

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
  listarFaltas(@Query('colaborador_id') c?: string) { return this.svc.listarFaltas(c); }

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
