import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards, Req, Logger,
  InternalServerErrorException, Headers, UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { AcademicoService } from './academico.service';

@Controller('academico')
@UseGuards(JwtAuthGuard)
export class AcademicoController {
  private readonly logger = new Logger(AcademicoController.name);
  constructor(private readonly svc: AcademicoService) {}

  // ── CURSOS ────────────────────────────────────────────────────────────────
  @Get('cursos')
  getCursos() { return this.svc.listarCursos(); }

  @Post('cursos')
  async criarCurso(@Body() dto: any) {
    try { return await this.svc.criarCurso(dto); }
    catch (e) { this.logger.error('criarCurso falhou', (e as any)?.stack); throw e; }
  }

  @Patch('cursos/:id')
  async editarCurso(@Param('id') id: string, @Body() dto: any) {
    try { return await this.svc.editarCurso(id, dto); }
    catch (e) { this.logger.error('editarCurso falhou', (e as any)?.stack); throw e; }
  }

  @Delete('cursos/:id')
  async deletarCurso(@Param('id') id: string) {
    try { return await this.svc.deletarCurso(id); }
    catch (e) { this.logger.error('deletarCurso falhou', (e as any)?.stack); throw e; }
  }

  // ── PROFESSORES ───────────────────────────────────────────────────────────
  @Get('professores')
  getProfessores() { return this.svc.listarProfessores(); }

  @Post('professores')
  criarProfessor(@Body() dto: any) { return this.svc.criarProfessor(dto); }

  @Patch('professores/:id')
  editarProfessor(@Param('id') id: string, @Body() dto: any) { return this.svc.editarProfessor(id, dto); }

  @Delete('professores/:id')
  deletarProfessor(@Param('id') id: string) { return this.svc.deletarProfessor(id); }

  // ── WEBHOOK: Google Forms → Cadastro de Funcionário (rota pública) ────────
  @Public()
  @Post('professores/webhook')
  async webhookGoogleForms(
    @Headers('x-itp-webhook-secret') secret: string,
    @Body() payload: any,
  ) {
    const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'itp-forms-2026';
    if (secret !== WEBHOOK_SECRET) {
      throw new UnauthorizedException('Secret inválido.');
    }
    // Mapeia campos do Google Forms → entidade Professor
    const dto = {
      nome:                  payload['Nome Completo']?.trim(),
      email:                 payload['E-mail (Obrigatório)']?.trim() || payload['E-mail']?.trim(),
      cpf:                   payload['CPF (Obrigatório)']?.trim() || payload['CPF']?.trim(),
      data_nascimento:       payload['Data de Nascimento (Obrigatório)']?.trim() || payload['Data de Nascimento']?.trim(),
      celular:               payload['Celular (Obrigatório)']?.trim() || payload['Celular']?.trim(),
      sexo:                  payload['Sexo (Obrigatório)']?.trim() || payload['Sexo']?.trim(),
      raca_cor:              payload['Raça/Cor']?.trim(),
      escolaridade:          payload['Escolaridade']?.trim(),
      cep:                   payload['CEP']?.trim(),
      numero_residencia:     payload['Número da Residência']?.trim(),
      complemento:           payload['Complemento (Ex: Apartamento, Bloco)']?.trim(),
      estado:                payload['Estado (Ex: RJ, SP)']?.trim(),
      telefone_emergencia_1: payload['Telefone de Emergência 1 (Obrigatório)']?.trim(),
      telefone_emergencia_2: payload['Telefone de Emergência 2 (Opcional)']?.trim(),
      possui_deficiencia:    payload['Possui algum tipo de deficiência?']?.toLowerCase().startsWith('sim'),
      deficiencia_descricao: payload['Se sim, qual(is) deficiência(s) possui? (Descreva)']?.trim(),
      possui_alergias:       payload['Possui Alergias?']?.toLowerCase().startsWith('sim'),
      alergias_descricao:    payload['Se sim, qual(is) tipo(s) de alergia possui? (Descreva)']?.trim(),
      usa_medicamentos:      payload['Faz uso contínuo de algum tipo de medicamento?']?.toLowerCase().startsWith('sim'),
      medicamentos_descricao:payload['Se sim, quais medicamentos utiliza? (Nome e dosagem, se souber)']?.trim(),
      interesse_cursos:      payload['Tem interesse em se matricular em algum curso do Instituto Tia Pretinha?']?.toLowerCase().startsWith('sim'),
      ativo:                 true,
    };
    this.logger.log(`[Webhook Google Forms] Cadastrando funcionário: ${dto.nome}`);
    return this.svc.criarProfessor(dto);
  }

  // ── TURMAS ────────────────────────────────────────────────────────────────
  @Get('turmas')
  getTurmas() { return this.svc.listarTurmas(); }

  @Post('turmas')
  criarTurma(@Body() dto: any) { return this.svc.criarTurma(dto); }

  @Patch('turmas/:id')
  editarTurma(@Param('id') id: string, @Body() dto: any) { return this.svc.editarTurma(id, dto); }

  @Delete('turmas/:id')
  deletarTurma(@Param('id') id: string) { return this.svc.deletarTurma(id); }

  // ── GRADE HORÁRIA ─────────────────────────────────────────────────────────
  @Get('grade')
  getGrade() { return this.svc.listarGrade(); }

  @Post('grade')
  criarCard(@Body() dto: any) { return this.svc.criarCardGrade(dto); }

  @Patch('grade/:id')
  moverCard(@Param('id') id: string, @Body() dto: any) { return this.svc.moverCardGrade(id, dto); }

  @Delete('grade/:id')
  deletarCard(@Param('id') id: string) { return this.svc.deletarCardGrade(id); }

  // ── TURMA ALUNOS / BACKLOG ─────────────────────────────────────────────────
  @Get('turma-alunos/backlog')
  getBacklog() { return this.svc.listarBacklog(); }

  @Get('turma-alunos/:turmaId')
  getAlunosDaTurma(@Param('turmaId') turmaId: string) { return this.svc.listarAlunosDaTurma(turmaId); }

  @Post('turma-alunos/incluir')
  incluirAluno(@Body() dto: { aluno_id: string; turma_id: string }) {
    return this.svc.incluirAlunoNaTurma(dto.aluno_id, dto.turma_id);
  }

  @Patch('turma-alunos/:id/remover')
  removerAluno(@Param('id') id: string) { return this.svc.removerAlunoDaTurma(id); }

  // ── ALUNOS ────────────────────────────────────────────────────────────────
  @Get('alunos')
  getAlunos(@Query() q: any) { return this.svc.listarAlunos(q); }

  @Post('alunos')
  criarAluno(@Body() dto: any) { return this.svc.criarAluno(dto); }

  @Patch('alunos/:id')
  editarAluno(@Param('id') id: string, @Body() dto: any) { return this.svc.editarAluno(id, dto); }

  @Delete('alunos/:id')
  deletarAluno(@Param('id') id: string) { return this.svc.deletarAluno(id); }

  @Get('alunos/:id/ficha')
  fichaAluno(@Param('id') id: string) { return this.svc.fichaAluno(id); }

  // ── DIÁRIO ────────────────────────────────────────────────────────────────
  @Get('diario')
  getDiario(@Query() q: any) { return this.svc.listarDiario(q); }

  @Post('diario')
  criarDiario(@Body() dto: any, @Req() req: any) {
    return this.svc.criarRegistroDiario({
      ...dto,
      usuario_id: req.user?.userId,
      usuario_nome: req.user?.email,
    });
  }

  @Delete('diario/:id')
  deletarDiario(@Param('id') id: string) { return this.svc.deletarRegistroDiario(id); }
}
