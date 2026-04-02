import { Controller, Get, Post, Body, Query, BadRequestException } from '@nestjs/common';
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

  // ── DRE ────────────────────────────────────────────────────────────────────

  @Get('financeiro/dre')
  dre(
    @Query('ano')     ano?: string,
    @Query('mes_ini') mes_ini?: string,
    @Query('mes_fim') mes_fim?: string,
  ) {
    const now = new Date();
    return this.svc.dre(
      Number(ano)     || now.getFullYear(),
      Number(mes_ini) || 1,
      Number(mes_fim) || 12,
    );
  }

  // ── RELATÓRIOS ONG / TERCEIRO SETOR ────────────────────────────────────────

  private _ini() { return `${new Date().getFullYear()}-01-01`; }
  private _fim() { return new Date().toISOString().slice(0, 10); }
  private _ano() { return new Date().getFullYear(); }

  @Get('financeiro/fluxo-caixa-detalhado')
  fluxoCaixaDetalhado(
    @Query('data_ini') data_ini?: string,
    @Query('data_fim') data_fim?: string,
    @Query('projeto')  projeto?: string,
    @Query('categoria') categoria?: string,
  ) {
    return this.svc.fluxoCaixaDetalhado(data_ini || this._ini(), data_fim || this._fim(), projeto, categoria);
  }

  @Get('financeiro/demonstrativo')
  demonstrativoReceitasDespesas(@Query('ano') ano?: string) {
    return this.svc.demonstrativoReceitasDespesas(Number(ano) || this._ano());
  }

  @Get('financeiro/execucao-orcamentaria')
  execucaoOrcamentaria(@Query('ano') ano?: string) {
    return this.svc.execucaoOrcamentaria(Number(ano) || this._ano());
  }

  @Get('financeiro/despesas-categoria')
  despesasPorCategoria(
    @Query('data_ini') data_ini?: string,
    @Query('data_fim') data_fim?: string,
  ) {
    return this.svc.despesasPorCategoria(data_ini || this._ini(), data_fim || this._fim());
  }

  @Get('financeiro/despesas-projeto')
  despesasPorProjeto(
    @Query('data_ini') data_ini?: string,
    @Query('data_fim') data_fim?: string,
  ) {
    return this.svc.despesasPorProjeto(data_ini || this._ini(), data_fim || this._fim());
  }

  @Get('financeiro/origem-recursos')
  origemRecursos(
    @Query('data_ini') data_ini?: string,
    @Query('data_fim') data_fim?: string,
  ) {
    return this.svc.origemRecursos(data_ini || this._ini(), data_fim || this._fim());
  }

  @Get('financeiro/fornecedores')
  pagamentosFornecedores(
    @Query('data_ini') data_ini?: string,
    @Query('data_fim') data_fim?: string,
  ) {
    return this.svc.pagamentosFornecedores(data_ini || this._ini(), data_fim || this._fim());
  }

  @Get('financeiro/anual')
  relatorioFinanceiroAnual(@Query('ano') ano?: string) {
    return this.svc.relatorioFinanceiroAnual(Number(ano) || this._ano());
  }

  @Get('financeiro/prestacao-contas')
  prestacaoContas(
    @Query('projeto')  projeto?: string,
    @Query('data_ini') data_ini?: string,
    @Query('data_fim') data_fim?: string,
  ) {
    return this.svc.prestacaoContas(projeto || '', data_ini || this._ini(), data_fim || this._fim());
  }

  @Get('financeiro/diversificacao-receitas')
  diversificacaoReceitas(
    @Query('data_ini') data_ini?: string,
    @Query('data_fim') data_fim?: string,
  ) {
    return this.svc.diversificacaoReceitas(data_ini || this._ini(), data_fim || this._fim());
  }

  @Get('financeiro/sustentabilidade')
  sustentabilidadeFinanceira() {
    return this.svc.sustentabilidadeFinanceira();
  }

  @Get('social/custo-beneficiario')
  custoPorBeneficiario(
    @Query('data_ini') data_ini?: string,
    @Query('data_fim') data_fim?: string,
  ) {
    return this.svc.custoPorBeneficiario(data_ini || this._ini(), data_fim || this._fim());
  }

  @Get('social/impacto-financeiro')
  impactoFinanceiroProjeto(
    @Query('data_ini') data_ini?: string,
    @Query('data_fim') data_fim?: string,
  ) {
    return this.svc.impactoFinanceiroProjeto(data_ini || this._ini(), data_fim || this._fim());
  }

  // ── ENVIO POR E-MAIL ───────────────────────────────────────────────────────

  @Post('enviar-email')
  async enviarEmail(
    @Body() body: { tipo: string; destinatario: string; params?: Record<string, string> },
  ) {
    if (!body?.destinatario?.includes('@')) throw new BadRequestException('E-mail inválido.');
    if (!body?.tipo) throw new BadRequestException('Tipo de relatório obrigatório.');
    await this.svc.enviarRelatorioEmail(body.tipo, body.params ?? {}, body.destinatario);
    return { ok: true, mensagem: `Relatório "${body.tipo}" enviado para ${body.destinatario}.` };
  }
}

