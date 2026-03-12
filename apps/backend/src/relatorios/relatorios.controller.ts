import { Controller, Get, Query } from '@nestjs/common';
import { RelatoriosService } from './relatorios.service';

@Controller('relatorios')
export class RelatoriosController {
  constructor(private readonly svc: RelatoriosService) {}

  // ── FINANCEIRO ─────────────────────────────────────────────────────────────

  @Get('financeiro/resumo')
  resumoFinanceiro(
    @Query('data_ini') data_ini: string,
    @Query('data_fim') data_fim: string,
  ) {
    const ini = data_ini || new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
    const fim = data_fim || new Date().toISOString().slice(0, 10);
    return this.svc.resumoFinanceiro(ini, fim);
  }

  @Get('financeiro/fluxo-caixa')
  fluxoCaixaMensal(@Query('ano') ano?: string) {
    return this.svc.fluxoCaixaMensal(Number(ano) || new Date().getFullYear());
  }

  @Get('financeiro/contabil')
  relatorioContabil(
    @Query('mes') mes?: string,
    @Query('ano') ano?: string,
  ) {
    const now = new Date();
    return this.svc.relatorioContabil(
      Number(mes) || now.getMonth() + 1,
      Number(ano) || now.getFullYear(),
    );
  }

  @Get('financeiro/doacoes')
  relatorioDoacoes(
    @Query('data_ini') data_ini: string,
    @Query('data_fim') data_fim: string,
  ) {
    const ini = data_ini || new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
    const fim = data_fim || new Date().toISOString().slice(0, 10);
    return this.svc.relatorioDoacoes(ini, fim);
  }

  // ── ACADÊMICO ──────────────────────────────────────────────────────────────

  @Get('academico/alunos')
  relatorioAlunos() {
    return this.svc.relatorioAlunos();
  }

  @Get('academico/frequencia')
  relatorioFrequencia(
    @Query('turma_id') turma_id?: string,
    @Query('data_ini') data_ini?: string,
    @Query('data_fim') data_fim?: string,
  ) {
    return this.svc.relatorioFrequencia({ turma_id, data_ini, data_fim });
  }

  @Get('academico/geral')
  relatorioAcademico() {
    return this.svc.relatorioAcademico();
  }

  @Get('academico/matriculas')
  relatorioMatriculas(
    @Query('data_ini') data_ini?: string,
    @Query('data_fim') data_fim?: string,
  ) {
    return this.svc.relatorioMatriculas(data_ini, data_fim);
  }

  // ── SOCIAL ─────────────────────────────────────────────────────────────────

  @Get('social/impacto')
  relatorioImpactoSocial() {
    return this.svc.relatorioImpactoSocial();
  }

  // ── ESTOQUE ────────────────────────────────────────────────────────────────

  @Get('estoque/posicao')
  relatorioEstoque() {
    return this.svc.relatorioEstoque();
  }

  @Get('estoque/movimentos')
  relatorioMovimentos(
    @Query('data_ini') data_ini: string,
    @Query('data_fim') data_fim: string,
  ) {
    const ini = data_ini || new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
    const fim = data_fim || new Date().toISOString().slice(0, 10);
    return this.svc.relatorioMovimentoEstoque(ini, fim);
  }
}
