import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards, Req, Logger,
  InternalServerErrorException,
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
