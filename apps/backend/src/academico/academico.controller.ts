import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards, Req, Logger,
  InternalServerErrorException, Headers, UnauthorizedException, BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModuloPermGuard } from '../auth/guards/modulo-perm.guard';
import { ModuloPerm } from '../auth/decorators/modulo-perm.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { AcademicoService } from './academico.service';

@Controller('academico')
@UseGuards(JwtAuthGuard, ModuloPermGuard)
export class AcademicoController {
  private readonly logger = new Logger(AcademicoController.name);
  constructor(private readonly svc: AcademicoService) {}

  // ── CHAMADA PÚBLICA (via link, sem autenticação JWT) ─────────────────────

  @Public()
  @Get('chamada/professor-turmas')
  async turmasPorCPFProfessor(@Query('cpf') cpf: string) {
    if (!cpf) throw new BadRequestException('CPF obrigatório');
    return this.svc.listarTurmasPorCPFProfessor(cpf);
  }

  @Public()
  @Get('chamada/alunos')
  async getAlunosChamada(
    @Query('token') token: string,
    @Query('turma_id') turmaId: string,
  ) {
    this.svc.validarTokenChamada(token);
    return this.svc.listarAlunosChamada(turmaId);
  }

  @Public()
  @Post('chamada')
  async salvarChamada(@Body() dto: any) {
    this.svc.validarTokenChamada(dto.token);
    return this.svc.criarSessaoComPresenca(
      {
        turma_id:          dto.turma_id,
        data:              dto.data,
        tema_aula:         dto.tema_aula,
        conteudo_abordado: dto.conteudo_abordado,
        registros:         dto.registros,
      },
      undefined,
      dto.professor_nome || 'Chamada via link',
    );
  }

  @Public()
  @Post('chamada/aluno-rapido')
  async criarAlunoRapidoChamada(@Body() dto: any) {
    this.svc.validarTokenChamada(dto.token);
    const { token: _token, ...alunoData } = dto;
    try {
      return await this.svc.criarAlunoViaChamada(alunoData);
    } catch (e) {
      this.logger.error('[chamada/aluno-rapido] Erro ao criar aluno:', (e as any)?.message, (e as any)?.stack);
      throw e;
    }
  }

  // ── CURSOS ────────────────────────────────────────────────────────────────

  @Get('cursos')
  @ModuloPerm('academico', 'visualizar')
  getCursos() { return this.svc.listarCursos(); }

  @Public()
  @Get('cursos/ativos')
  getCursosAtivos() { return this.svc.listarCursosAtivos(); }

  @Post('cursos')
  @ModuloPerm('academico', 'incluir')
  async criarCurso(@Body() dto: any) {
    try { return await this.svc.criarCurso(dto); }
    catch (e) { this.logger.error('criarCurso falhou', (e as any)?.stack); throw e; }
  }

  @Patch('cursos/:id')
  @ModuloPerm('academico', 'editar')
  async editarCurso(@Param('id') id: string, @Body() dto: any) {
    try { return await this.svc.editarCurso(id, dto); }
    catch (e) { this.logger.error('editarCurso falhou', (e as any)?.stack); throw e; }
  }

  @Delete('cursos/:id')
  @ModuloPerm('academico', 'excluir')
  async deletarCurso(@Param('id') id: string) {
    try { return await this.svc.deletarCurso(id); }
    catch (e) { this.logger.error('deletarCurso falhou', (e as any)?.stack); throw e; }
  }

  // ── PROFESSORES ───────────────────────────────────────────────────────────

  @Get('professores')
  @ModuloPerm('academico', 'visualizar')
  getProfessores() { return this.svc.listarProfessores(); }

  @Post('professores')
  @ModuloPerm('academico', 'incluir')
  criarProfessor(@Body() dto: any) { return this.svc.criarProfessor(dto); }

  @Patch('professores/:id')
  @ModuloPerm('academico', 'editar')
  editarProfessor(@Param('id') id: string, @Body() dto: any) { return this.svc.editarProfessor(id, dto); }

  @Delete('professores/:id')
  @ModuloPerm('academico', 'excluir')
  deletarProfessor(@Param('id') id: string) { return this.svc.deletarProfessor(id); }

  @Public()
  @Post('professores/webhook')
  async webhookGoogleForms(
    @Headers('x-itp-webhook-secret') secret: string,
    @Body() payload: any,
  ) {
    const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'itp-forms-2026';
    if (secret !== WEBHOOK_SECRET) throw new UnauthorizedException('Secret inválido.');
    const dto = {
      nome: payload.nome, email: payload.email, cpf: payload.cpf,
      data_nascimento: payload.data_nascimento, celular: payload.celular,
      sexo: payload.sexo, raca_cor: payload.raca_cor, escolaridade: payload.escolaridade,
      cep: payload.cep, numero_residencia: payload.numero_residencia,
      complemento: payload.complemento, estado: payload.estado,
      telefone_emergencia_1: payload.telefone_emergencia_1,
      telefone_emergencia_2: payload.telefone_emergencia_2,
      possui_deficiencia: payload.possui_deficiencia === true,
      deficiencia_descricao: payload.deficiencia_descricao,
      possui_alergias: payload.possui_alergias === true,
      alergias_descricao: payload.alergias_descricao,
      usa_medicamentos: payload.usa_medicamentos === true,
      medicamentos_descricao: payload.medicamentos_descricao,
      interesse_cursos: payload.interesse_cursos === true,
      ativo: true,
    };
    this.logger.log(`[Webhook Google Forms] Cadastrando professor: ${dto.nome}`);
    return this.svc.criarProfessor(dto);
  }

  // ── TURMAS ────────────────────────────────────────────────────────────────

  @Get('turmas')
  @ModuloPerm('academico', 'visualizar')
  getTurmas() { return this.svc.listarTurmas(); }

  @Post('turmas')
  @ModuloPerm('academico', 'incluir')
  criarTurma(@Body() dto: any) { return this.svc.criarTurma(dto); }

  @Patch('turmas/:id')
  @ModuloPerm('academico', 'editar')
  editarTurma(@Param('id') id: string, @Body() dto: any) { return this.svc.editarTurma(id, dto); }

  @Delete('turmas/:id')
  @ModuloPerm('academico', 'excluir')
  deletarTurma(@Param('id') id: string) { return this.svc.deletarTurma(id); }

  // ── GRADE HORÁRIA ─────────────────────────────────────────────────────────

  @Get('grade')
  @ModuloPerm('academico', 'visualizar')
  getGrade() { return this.svc.listarGrade(); }

  @Post('grade')
  @ModuloPerm('academico', 'incluir')
  criarCard(@Body() dto: any) { return this.svc.criarCardGrade(dto); }

  @Patch('grade/:id')
  @ModuloPerm('academico', 'editar')
  moverCard(@Param('id') id: string, @Body() dto: any) { return this.svc.moverCardGrade(id, dto); }

  @Delete('grade/:id')
  @ModuloPerm('academico', 'excluir')
  deletarCard(@Param('id') id: string) { return this.svc.deletarCardGrade(id); }

  // ── TURMA ALUNOS / BACKLOG ────────────────────────────────────────────────

  @Get('turma-alunos/backlog')
  @ModuloPerm('academico', 'visualizar')
  getBacklog() { return this.svc.listarBacklog(); }

  @Get('turma-alunos/:turmaId')
  @ModuloPerm('academico', 'visualizar')
  getAlunosDaTurma(@Param('turmaId') turmaId: string) { return this.svc.listarAlunosDaTurma(turmaId); }

  @Post('turma-alunos/incluir')
  @ModuloPerm('academico', 'incluir')
  incluirAluno(@Body() dto: { aluno_id: string; turma_id: string }) {
    return this.svc.incluirAlunoNaTurma(dto.aluno_id, dto.turma_id);
  }

  @Patch('turma-alunos/:id/remover')
  @ModuloPerm('academico', 'editar')
  removerAluno(@Param('id') id: string) { return this.svc.removerAlunoDaTurma(id); }

  // ── ALUNOS ────────────────────────────────────────────────────────────────

  @Get('alunos/stats')
  @ModuloPerm('academico', 'visualizar')
  getStatsAlunos() { return this.svc.statsAlunos(); }

  @Get('monitoramento')
  @ModuloPerm('academico', 'visualizar')
  getMonitoramento() { return this.svc.monitoramento(); }

  @Get('monitoramento/mapa')
  @ModuloPerm('academico', 'visualizar')
  getMapaAlunos() { return this.svc.mapaAlunos(); }

  @Get('alunos/kpis')
  @ModuloPerm('academico', 'visualizar')
  getKpisTurmas() { return this.svc.kpisTurmas(); }

  @Get('alunos/pendentes')
  @ModuloPerm('academico', 'visualizar')
  getPendentes() { return this.svc.listarAlunosPendentes(); }

  @Get('documentos/acervo')
  @ModuloPerm('academico', 'visualizar')
  acervoDocumentos() { return this.svc.acervoDocumentos(); }

  @Get('alunos')
  @ModuloPerm('academico', 'visualizar')
  getAlunos(@Query() q: any) { return this.svc.listarAlunos(q); }

  @Post('alunos')
  @ModuloPerm('academico', 'incluir')
  criarAluno(@Body() dto: any) { return this.svc.criarAluno(dto); }

  @Patch('alunos/:id')
  @ModuloPerm('academico', 'editar')
  editarAluno(@Param('id') id: string, @Body() dto: any) { return this.svc.editarAluno(id, dto); }

  @Delete('alunos/:id')
  @ModuloPerm('academico', 'excluir')
  deletarAluno(@Param('id') id: string) { return this.svc.deletarAluno(id); }

  @Delete('alunos/:id/permanente')
  @ModuloPerm('academico', 'excluir')
  excluirAlunoPermanente(@Param('id') id: string) { return this.svc.excluirAlunoPermanente(id); }

  @Get('alunos/:id/ficha')
  @ModuloPerm('academico', 'visualizar')
  fichaAluno(@Param('id') id: string) { return this.svc.fichaAluno(id); }

  // ── DIÁRIO ────────────────────────────────────────────────────────────────

  @Get('diario')
  @ModuloPerm('academico', 'visualizar')
  getDiario(@Query() q: any) { return this.svc.listarDiario(q); }

  @Post('diario')
  @ModuloPerm('academico', 'incluir')
  criarDiario(@Body() dto: any, @Req() req: any) {
    return this.svc.criarRegistroDiario({
      ...dto,
      usuario_id: req.user?.userId,
      usuario_nome: req.user?.email,
    });
  }

  @Delete('diario/:id')
  @ModuloPerm('academico', 'excluir')
  deletarDiario(@Param('id') id: string) { return this.svc.deletarRegistroDiario(id); }

  // ── PRESENÇA ──────────────────────────────────────────────────────────────

  @Get('presenca/sessoes')
  @ModuloPerm('academico', 'visualizar')
  getSessoes(@Query() q: any) { return this.svc.listarSessoes(q); }

  @Post('presenca/sessoes')
  @ModuloPerm('academico', 'incluir')
  criarSessao(@Body() dto: any, @Req() req: any) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.connection?.remoteAddress;
    return this.svc.criarSessaoComPresenca(dto, req.user?.userId, req.user?.email, ip);
  }

  @Patch('presenca/sessoes/:id')
  @ModuloPerm('academico', 'editar')
  editarSessao(@Param('id') id: string, @Body() dto: any) { return this.svc.editarSessao(id, dto); }

  @Delete('presenca/sessoes/:id')
  @ModuloPerm('academico', 'excluir')
  estornarSessao(@Param('id') id: string) { return this.svc.estornarSessao(id); }

  @Get('presenca/alertas-candidatos')
  @ModuloPerm('academico', 'visualizar')
  alertasCandidatos() { return this.svc.listarAlertasCandidatos(); }

  @Get('usuarios-professores')
  @ModuloPerm('academico', 'visualizar')
  listarUsuariosProfessores() { return this.svc.listarUsuariosProfessores(); }

  @Get('presenca/sessoes/:id/registros')
  @ModuloPerm('academico', 'visualizar')
  getRegistrosSessao(@Param('id') id: string) { return this.svc.listarRegistrosSessao(id); }

  @Get('presenca')
  @ModuloPerm('academico', 'visualizar')
  getPresenca(@Query() q: any) { return this.svc.listarPresenca(q); }

  @Post('presenca')
  @ModuloPerm('academico', 'incluir')
  registrarPresenca(@Body() dto: any, @Req() req: any) {
    return this.svc.registrarPresenca(dto, req.user?.userId, req.user?.email);
  }

  // ── FALTAS / TURMAS SEM SESSÃO ────────────────────────────────────────────

  @Get('presenca/faltas-recentes')
  @ModuloPerm('academico', 'visualizar')
  faltasRecentes(@Query('limite') limite?: string) {
    return this.svc.listarFaltasRecentes(limite ? parseInt(limite) : 8);
  }

  @Get('presenca/turmas-sem-sessao')
  @ModuloPerm('academico', 'visualizar')
  turmasSemSessao(@Query('dias') dias?: string) {
    return this.svc.turmasSemSessaoRecente(dias ? parseInt(dias) : 7);
  }

  // ── CHAMADOS ──────────────────────────────────────────────────────────────

  @Get('chamados/stats')
  @ModuloPerm('academico', 'visualizar')
  statsChamados() { return this.svc.statsChamados(); }

  @Get('chamados')
  @ModuloPerm('academico', 'visualizar')
  listarChamados(@Query() q: any) { return this.svc.listarChamados(q); }

  @Post('chamados')
  @ModuloPerm('academico', 'incluir')
  criarChamado(@Body() dto: any, @Req() req: any) {
    return this.svc.criarChamado(dto, req.user?.email);
  }

  @Patch('chamados/:id')
  @ModuloPerm('academico', 'editar')
  editarChamado(@Param('id') id: string, @Body() dto: any) {
    return this.svc.editarChamado(id, dto);
  }

  @Delete('chamados/:id')
  @ModuloPerm('academico', 'excluir')
  deletarChamado(@Param('id') id: string) { return this.svc.deletarChamado(id); }
}
