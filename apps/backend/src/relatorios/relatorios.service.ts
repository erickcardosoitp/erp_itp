import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EmailService } from '../email.service';

@Injectable()
export class RelatoriosService {
  private readonly logger = new Logger(RelatoriosService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly email: EmailService,
  ) {}

  // ── UTILITÁRIO ─────────────────────────────────────────────────────────────

  private num(v: unknown) { return Number(v) || 0; }

  // ══════════════════════════════════════════════════════════════════════════
  //  FINANCEIRO
  // ══════════════════════════════════════════════════════════════════════════

  /** Resumo de receitas × despesas × saldo no período */
  async resumoFinanceiro(data_ini: string, data_fim: string) {
    const rows: any[] = await this.db.query(`
      SELECT
        tipo_movimentacao,
        categoria,
        status,
        SUM(valor) AS total,
        COUNT(*) AS qtd
      FROM movimentacoes_financeiras
      WHERE data BETWEEN $1 AND $2
      GROUP BY tipo_movimentacao, categoria, status
      ORDER BY tipo_movimentacao, total DESC
    `, [data_ini, data_fim]);

    const receitas = rows.filter(r => r.tipo_movimentacao === 'Receita' || r.tipo_movimentacao === 'Entrada');
    const despesas = rows.filter(r => r.tipo_movimentacao === 'Despesa' || r.tipo_movimentacao === 'Saída');
    const totalReceitas = receitas.reduce((s, r) => s + this.num(r.total), 0);
    const totalDespesas = despesas.reduce((s, r) => s + this.num(r.total), 0);
    const saldo = totalReceitas - totalDespesas;

    // Breakdown por categoria
    const byCategoria = Object.create(null) as Record<string, { receita: number; despesa: number }>;
    for (const r of rows) {
      const cat = String(r.categoria ?? 'Sem categoria');
      if (!byCategoria[cat]) byCategoria[cat] = { receita: 0, despesa: 0 };
      const isReceita = r.tipo_movimentacao === 'Receita' || r.tipo_movimentacao === 'Entrada';
      if (isReceita) byCategoria[cat].receita += this.num(r.total);
      else            byCategoria[cat].despesa += this.num(r.total);
    }

    return {
      periodo: { data_ini, data_fim },
      total_receitas: totalReceitas,
      total_despesas: totalDespesas,
      saldo,
      lucratividade: totalReceitas > 0 ? ((saldo / totalReceitas) * 100).toFixed(1) : '0',
      categorias: Object.entries(byCategoria).map(([categoria, v]) => ({ categoria, ...v })),
      por_status: this.agruparPor(rows, 'status', 'total'),
    };
  }

  /** Fluxo de caixa mensal do ano */
  async fluxoCaixaMensal(ano: number) {
    const rows: any[] = await this.db.query(`
      SELECT
        EXTRACT(MONTH FROM data)::INT AS mes,
        tipo_movimentacao,
        SUM(valor) AS total
      FROM movimentacoes_financeiras
      WHERE EXTRACT(YEAR FROM data) = $1
        AND status IN ('Pago', 'Confirmado')
      GROUP BY mes, tipo_movimentacao
      ORDER BY mes
    `, [ano]);

    const meses = Array.from({ length: 12 }, (_, i) => {
      const mesNum = i + 1;
      const rec = rows.find(r => r.mes === mesNum && (r.tipo_movimentacao === 'Receita' || r.tipo_movimentacao === 'Entrada'));
      const desp = rows.find(r => r.mes === mesNum && (r.tipo_movimentacao === 'Despesa' || r.tipo_movimentacao === 'Saída'));
      const receita = this.num(rec?.total);
      const despesa = this.num(desp?.total);
      return { mes: mesNum, receita, despesa, saldo: receita - despesa };
    });
    return { ano, meses };
  }

  /** Relatório contábil agrupado por plano de contas */
  async relatorioContabil(mes: number, ano: number) {
    const rows: any[] = await this.db.query(`
      SELECT
        plano_contas,
        tipo_movimentacao,
        SUM(valor) AS total,
        COUNT(*) AS qtd
      FROM movimentacoes_financeiras
      WHERE EXTRACT(MONTH FROM data) = $1
        AND EXTRACT(YEAR FROM data) = $2
      GROUP BY plano_contas, tipo_movimentacao
      ORDER BY plano_contas, tipo_movimentacao
    `, [mes, ano]);

    const grouped = Object.create(null) as Record<string, any>;
    for (const r of rows) {
      const plano = String(r.plano_contas ?? 'Sem plano');
      if (!grouped[plano]) grouped[plano] = { plano_contas: plano, receita: 0, despesa: 0, qtd: 0 };
      const isReceita = r.tipo_movimentacao === 'Receita' || r.tipo_movimentacao === 'Entrada';
      if (isReceita) grouped[plano].receita += this.num(r.total);
      else grouped[plano].despesa += this.num(r.total);
      grouped[plano].qtd += this.num(r.qtd);
    }

    const itens = Object.values(grouped);
    return {
      mes, ano,
      lancamentos: itens.map(i => ({
        plano_contas: i.plano_contas,
        total_receitas: i.receita,
        total_despesas: i.despesa,
        num_lancamentos: i.qtd,
      })),
      totais: {
        receita: itens.reduce((s, i) => s + i.receita, 0),
        despesa: itens.reduce((s, i) => s + i.despesa, 0),
      },
    };
  }

  /** Top doadores e evolução de doações */
  async relatorioDoacoes(data_ini: string, data_fim: string) {
    const [resumo, mensal, contadoresDoadores]: [any[], any[], any[]] = await Promise.all([
      this.db.query(`
        SELECT
          nome,
          SUM(valor) AS total,
          COUNT(*) AS qtd,
          MAX(data) AS ultima_doacao
        FROM movimentacoes_financeiras
        WHERE categoria = 'Doação' AND data BETWEEN $1 AND $2
        GROUP BY nome
        ORDER BY total DESC
        LIMIT 20
      `, [data_ini, data_fim]),
      this.db.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', data), 'YYYY-MM') AS mes,
          SUM(valor) AS total,
          COUNT(*) AS qtd
        FROM movimentacoes_financeiras
        WHERE categoria = 'Doação' AND data BETWEEN $1 AND $2
        GROUP BY mes
        ORDER BY mes
      `, [data_ini, data_fim]),
      this.db.query(`
        SELECT COUNT(DISTINCT nome) AS total_doadores
        FROM movimentacoes_financeiras
        WHERE categoria = 'Doação' AND data BETWEEN $1 AND $2
      `, [data_ini, data_fim]),
    ]);

    return {
      periodo: { data_ini, data_fim },
      num_doadores: this.num(contadoresDoadores[0]?.total_doadores),
      total_doacoes: resumo.reduce((s, r) => s + this.num(r.total), 0),
      total_movimentos: resumo.reduce((s, r) => s + this.num(r.qtd), 0),
      maiores_doadores: resumo,
      evolucao_mensal: mensal,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  ACADÊMICO
  // ══════════════════════════════════════════════════════════════════════════

  /** Resumo geral de alunos, turmas e cursos */
  async relatorioAlunos() {
    const [totais, porCidade, porTurno, porCurso, ultimosMatriculados]: [any[], any[], any[], any[], any[]] = await Promise.all([
      this.db.query(`
        SELECT
          COUNT(*) FILTER (WHERE ativo = true)  AS total_ativos,
          COUNT(*) FILTER (WHERE ativo = false) AS total_inativos,
          COUNT(*) AS total_geral
        FROM alunos
      `),
      this.db.query(`
        SELECT cidade, COUNT(*) AS qtd
        FROM alunos WHERE ativo = true AND cidade IS NOT NULL
        GROUP BY cidade ORDER BY qtd DESC LIMIT 10
      `),
      this.db.query(`
        SELECT turno_escolar, COUNT(*) AS qtd
        FROM alunos WHERE ativo = true AND turno_escolar IS NOT NULL
        GROUP BY turno_escolar ORDER BY qtd DESC
      `),
      this.db.query(`
        SELECT cursos_matriculados, COUNT(*) AS qtd
        FROM alunos WHERE ativo = true AND cursos_matriculados IS NOT NULL
        GROUP BY cursos_matriculados ORDER BY qtd DESC LIMIT 15
      `),
      this.db.query(`
        SELECT nome_completo, numero_matricula, data_matricula, cidade
        FROM alunos WHERE ativo = true
        ORDER BY data_matricula DESC LIMIT 10
      `),
    ]);

    // Alunos por turma
    const porTurma: any[] = await this.db.query(`
      SELECT t.nome AS turma, COUNT(ta.aluno_id) AS qtd_alunos
      FROM turmas t
      LEFT JOIN turma_alunos ta ON ta.turma_id = t.id AND ta.status = 'ativo'
      GROUP BY t.nome ORDER BY qtd_alunos DESC
    `);

    return {
      total_ativos:  this.num(totais[0]?.total_ativos),
      total_inativos: this.num(totais[0]?.total_inativos),
      total_geral:   this.num(totais[0]?.total_geral),
      por_cidade: porCidade,
      turnos: porTurno.map((r: any) => ({ turno_escolar: r.turno_escolar, total: this.num(r.qtd) })),
      por_curso: porCurso.map((r: any) => ({ cursos_matriculados: r.cursos_matriculados, total: this.num(r.qtd) })),
      por_turma: porTurma,
      ultimos_matriculados: ultimosMatriculados,
    };
  }

  /** Frequência por turma e aluno */
  async relatorioFrequencia(filtros: { turma_id?: string; data_ini?: string; data_fim?: string }) {
    let where = `WHERE d.tipo = 'Presença'`;
    const params: any[] = [];
    if (filtros.turma_id) { params.push(filtros.turma_id); where += ` AND d.turma_id = $${params.length}`; }
    if (filtros.data_ini) { params.push(filtros.data_ini); where += ` AND d.data >= $${params.length}`; }
    if (filtros.data_fim) { params.push(filtros.data_fim); where += ` AND d.data <= $${params.length}`; }

    const [porAluno, porTurma, sessoes]: [any[], any[], any[]] = await Promise.all([
      this.db.query(`
        SELECT
          d.aluno_id,
          d.aluno_nome,
          d.turma_id,
          COUNT(*) FILTER (WHERE d.descricao = 'Presente') AS presencas,
          COUNT(*) FILTER (WHERE d.descricao = 'Falta')    AS faltas,
          COUNT(*) AS total
        FROM diario_academico d
        ${where}
        GROUP BY d.aluno_id, d.aluno_nome, d.turma_id
        ORDER BY presencas DESC
      `, params),
      this.db.query(`
        SELECT
          s.turma_nome,
          SUM(s.total_presentes) AS total_presentes,
          SUM(s.total_ausentes)  AS total_ausentes,
          COUNT(*) AS qtd_sessoes
        FROM presenca_sessoes s
        ${filtros.turma_id ? `WHERE s.turma_id = $1` : ''}
        GROUP BY s.turma_nome ORDER BY total_presentes DESC
      `, filtros.turma_id ? [filtros.turma_id] : []),
      this.db.query(`
        SELECT s.id, s.turma_nome, s.data, s.total_presentes, s.total_ausentes, s.tema_aula
        FROM presenca_sessoes s
        ${filtros.turma_id ? `WHERE s.turma_id = $1` : ''}
        ORDER BY s.data DESC LIMIT 20
      `, filtros.turma_id ? [filtros.turma_id] : []),
    ]);

    return { filtros, porAluno, porTurma, sessoes };
  }

  /** Resumo acadêmico geral: cursos, professores, turmas */
  async relatorioAcademico() {
    const [cursos, professores, turmas, grade]: [any[], any[], any[], any[]] = await Promise.all([
      this.db.query(`SELECT nome, sigla FROM cursos ORDER BY nome`),
      this.db.query(`SELECT nome, especialidade, ativo FROM professores ORDER BY nome`),
      this.db.query(`
        SELECT t.nome, t.codigo, c.nome AS curso,
          COUNT(ta.aluno_id) FILTER (WHERE ta.status = 'ativo') AS alunos_ativos
        FROM turmas t
        LEFT JOIN cursos c ON c.id = t.curso_id
        LEFT JOIN turma_alunos ta ON ta.turma_id = t.id
        GROUP BY t.nome, t.codigo, c.nome ORDER BY t.nome
      `),
      this.db.query(`SELECT dia_semana, COUNT(*) AS qtd_aulas FROM grade_horaria GROUP BY dia_semana ORDER BY dia_semana`),
    ]);

    return {
      cursos,
      professores,
      turmas,
      grade,
      total_cursos: cursos.length,
      total_professores: professores.length,
      turmas_ativas: turmas.reduce((s: number, t: any) => s + this.num(t.alunos_ativos), 0),
      cards_grade: grade.reduce((s: number, g: any) => s + this.num(g.qtd_aulas), 0),
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SOCIAL / IMPACTO
  // ══════════════════════════════════════════════════════════════════════════

  /** Dashboard de impacto social da instituição */
  async relatorioImpactoSocial() {
    const [alunos, financeiro, doacoes, estoque]: [any[], any[], any[], any[]] = await Promise.all([
      this.db.query(`
        SELECT
          COUNT(*) FILTER (WHERE ativo = true)  AS alunos_ativos,
          COUNT(*) FILTER (WHERE ativo = false) AS alunos_inativos,
          COUNT(DISTINCT cidade) AS cidades_atendidas
        FROM alunos
      `),
      this.db.query(`
        SELECT
          SUM(valor) FILTER (WHERE tipo_movimentacao IN ('Receita','Entrada')) AS total_receitas,
          SUM(valor) FILTER (WHERE categoria = 'Doação')                       AS total_doacoes,
          COUNT(*) FILTER (WHERE categoria = 'Doação')                         AS qtd_doacoes
        FROM movimentacoes_financeiras
        WHERE EXTRACT(YEAR FROM data) = EXTRACT(YEAR FROM CURRENT_DATE)
      `),
      this.db.query(`
        SELECT COUNT(*) AS total_doadores_ativos FROM doadores WHERE ativo = true
      `),
      this.db.query(`
        SELECT COUNT(*) FILTER (WHERE ativo = true)                              AS produtos_ativos,
          COUNT(*) FILTER (WHERE ativo = true AND quantidade_atual <= estoque_minimo AND estoque_minimo > 0) AS produtos_criticos
        FROM estoque_produtos
      `),
    ]);

    const [sessoesMes]: [any[]] = await Promise.all([
      this.db.query(`
        SELECT COUNT(*) AS sessoes, SUM(total_presentes) AS presencas
        FROM presenca_sessoes
        WHERE EXTRACT(MONTH FROM data) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND EXTRACT(YEAR FROM data)  = EXTRACT(YEAR FROM CURRENT_DATE)
      `),
    ]);

    return {
      total_alunos_ativos:  this.num(alunos[0]?.alunos_ativos),
      cidades_atendidas:    this.num(alunos[0]?.cidades_atendidas),
      doadores_ativos:      this.num(doacoes[0]?.total_doadores_ativos),
      receita_total:        this.num(financeiro[0]?.total_receitas),
      total_doacoes:        this.num(financeiro[0]?.total_doacoes),
      qtd_doacoes:          this.num(financeiro[0]?.qtd_doacoes),
      itens_estoque:        this.num(estoque[0]?.produtos_ativos),
      produtos_criticos:    this.num(estoque[0]?.produtos_criticos),
      sessoes_mes:          this.num(sessoesMes[0]?.sessoes),
      presencas_mes:        this.num(sessoesMes[0]?.presencas),
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  ESTOQUE
  // ══════════════════════════════════════════════════════════════════════════

  /** Posição atual do estoque com alertas */
  async relatorioEstoque() {
    const [produtos, movimentos, porCategoria]: [any[], any[], any[]] = await Promise.all([
      this.db.query(`
        SELECT
          p.codigo_interno, p.nome, p.categoria, p.unidade_medida,
          p.quantidade_atual, p.estoque_minimo, p.ativo,
          CASE WHEN p.estoque_minimo > 0 AND p.quantidade_atual <= p.estoque_minimo
            THEN true ELSE false END AS critico
        FROM estoque_produtos p
        WHERE p.ativo = true
        ORDER BY critico DESC, p.categoria, p.nome
      `),
      this.db.query(`
        SELECT
          m.tipo,
          DATE_TRUNC('month', m."createdAt") AS mes,
          SUM(m.quantidade) AS total
        FROM estoque_movimentos m
        WHERE m."createdAt" >= NOW() - INTERVAL '6 months'
        GROUP BY m.tipo, mes ORDER BY mes, m.tipo
      `),
      this.db.query(`
        SELECT
          p.categoria,
          COUNT(*) AS qtd_produtos,
          SUM(p.quantidade_atual) AS quantidade_total,
          COUNT(*) FILTER (WHERE p.quantidade_atual <= p.estoque_minimo AND p.estoque_minimo > 0) AS criticos
        FROM estoque_produtos p
        WHERE p.ativo = true
        GROUP BY p.categoria ORDER BY p.categoria
      `),
    ]);

    return {
      produtos,
      movimentos_recentes: movimentos,
      por_categoria: porCategoria,
      total_produtos:        produtos.length,
      total_criticos:        produtos.filter((p: any) => p.critico).length,
      valor_total_estoque:   0, // campo de preço não está no schema atual
    };
  }

  /** Movimentos de estoque no período */
  async relatorioMovimentoEstoque(data_ini: string, data_fim: string) {
    const rows: any[] = await this.db.query(`
      SELECT
        m.*,
        m."createdAt" AS data_movimento,
        p.nome,
        p.categoria,
        p.unidade_medida
      FROM estoque_movimentos m
      JOIN estoque_produtos p ON p.id = m.produto_id
      WHERE m."createdAt" BETWEEN $1 AND $2
      ORDER BY m."createdAt" DESC
    `, [data_ini, data_fim]);

    const entradas = rows.filter(r => r.tipo === 'entrada');
    const baixas   = rows.filter(r => r.tipo === 'baixa');

    return {
      periodo: { data_ini, data_fim },
      movimentos: rows,
      resumo: {
        totalEntradas: entradas.reduce((s, r) => s + this.num(r.quantidade), 0),
        totalBaixas:   baixas.reduce((s, r) => s + this.num(r.quantidade), 0),
        qtdEntradas:   entradas.length,
        qtdBaixas:     baixas.length,
      },
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  MATRÍCULAS
  // ══════════════════════════════════════════════════════════════════════════

  async relatorioMatriculas(data_ini?: string, data_fim?: string) {
    const hasDateFilter = Boolean(data_ini && data_fim);
    const filterParams = hasDateFilter ? [data_ini, data_fim] : [];
    // Parametrizado: nunca interpola entrada do usuário no SQL
    const whereData = hasDateFilter ? `AND DATE(i.created_at) BETWEEN $1 AND $2` : '';

    const [porStatus, porCurso, mensal, recentes]: [any[], any[], any[], any[]] = await Promise.all([
      this.db.query(`
        SELECT status, COUNT(*) AS qtd FROM inscricoes i
        WHERE 1=1 ${whereData} GROUP BY status ORDER BY qtd DESC
      `, filterParams),
      this.db.query(`
        SELECT curso_interesse, COUNT(*) AS qtd FROM inscricoes i
        WHERE 1=1 ${whereData} GROUP BY curso_interesse ORDER BY qtd DESC
      `, filterParams),
      this.db.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS mes,
          COUNT(*) AS qtd
        FROM inscricoes i WHERE 1=1 ${whereData}
        GROUP BY mes ORDER BY mes
      `, filterParams),
      this.db.query(`
        SELECT nome_completo, email, curso_interesse, status, created_at
        FROM inscricoes i WHERE 1=1 ${whereData}
        ORDER BY created_at DESC LIMIT 15
      `, filterParams),
    ]);

    return {
      por_status: porStatus.map((r: any) => ({ status_matricula: r.status, total: this.num(r.qtd) })),
      por_curso:  porCurso.map((r: any)  => ({ curso: r.curso_interesse, total: this.num(r.qtd) })),
      mensal,
      recentes,
    };
  }

  // ── UTILITÁRIO ─────────────────────────────────────────────────────────────

  private agruparPor(rows: any[], campo: string, soma: string) {
    // Object.create(null) evita prototype pollution (sem __proto__ herdado)
    const map = Object.create(null) as Record<string, number>;
    for (const r of rows) {
      const k = String(r[campo] ?? 'Outros');
      map[k] = (map[k] || 0) + this.num(r[soma]);
    }
    return Object.keys(map).map(k => ({ [campo]: k, total: map[k] }));
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  DRE — Demonstração de Resultado do Exercício
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * DRE completo no formato padrão de entidade sem fins lucrativos:
   * Receitas brutas → Deduções → Receita líquida → Despesas por grupo
   * → Resultado operacional → Resultado final
   */
  async dre(ano: number, mes_ini: number, mes_fim: number) {
    const rows: any[] = await this.db.query(`
      SELECT
        tipo_movimentacao,
        categoria,
        plano_contas,
        SUM(valor) AS total
      FROM movimentacoes_financeiras
      WHERE EXTRACT(YEAR FROM data) = $1
        AND EXTRACT(MONTH FROM data) BETWEEN $2 AND $3
        AND status IN ('Pago', 'Confirmado')
      GROUP BY tipo_movimentacao, categoria, plano_contas
      ORDER BY tipo_movimentacao, plano_contas, categoria
    `, [ano, mes_ini, mes_fim]);

    // Separação receitas x despesas
    const isReceita  = (r: any) => r.tipo_movimentacao === 'Receita' || r.tipo_movimentacao === 'Entrada';
    const isDespesa  = (r: any) => r.tipo_movimentacao === 'Despesa' || r.tipo_movimentacao === 'Saída';
    const isDeducao  = (r: any) => r.tipo_movimentacao === 'Dedução'  || r.categoria?.toLowerCase().includes('devolução') || r.categoria?.toLowerCase().includes('desconto');

    // ── GRUPO: Receitas Operacionais ──────────────────────────────────────
    const receitasAcc = Object.create(null) as Record<string, number>;
    for (const r of rows.filter(r => isReceita(r) && !isDeducao(r))) {
      const conta = r.plano_contas || r.categoria || 'Receitas';
      receitasAcc[conta] = (receitasAcc[conta] ?? 0) + this.num(r.total);
    }
    const receitasBrutas = Object.entries(receitasAcc).map(([conta, valor]) => ({ conta, valor }));

    const deducoesAcc = Object.create(null) as Record<string, number>;
    for (const r of rows.filter(r => isDeducao(r))) {
      const conta = r.plano_contas || r.categoria || 'Deduções';
      deducoesAcc[conta] = (deducoesAcc[conta] ?? 0) + this.num(r.total);
    }
    const deducoes = Object.entries(deducoesAcc).map(([conta, valor]) => ({ conta, valor }));

    const totalReceitasBrutas  = receitasBrutas.reduce((s, i) => s + i.valor, 0);
    const totalDeducoes        = deducoes.reduce((s, i) => s + i.valor, 0);
    const receitaLiquida       = totalReceitasBrutas - totalDeducoes;

    // ── GRUPO: Despesas (agrupadas por plano_contas ou categoria) ─────────
    const despesasMap = Object.create(null) as Record<string, { itens: { conta: string; valor: number }[]; itensAcc: Record<string, number>; subtotal: number }>;

    for (const r of rows.filter(r => isDespesa(r))) {
      const grupo = String(r.plano_contas ?? 'Outras Despesas');
      if (!despesasMap[grupo]) despesasMap[grupo] = { itens: [], subtotal: 0, itensAcc: Object.create(null) as Record<string, number> };
      const itemConta = r.categoria || grupo;
      despesasMap[grupo].itensAcc[itemConta] = (despesasMap[grupo].itensAcc[itemConta] ?? 0) + this.num(r.total);
      despesasMap[grupo].subtotal += this.num(r.total);
    }

    const gruposDespesas = Object.entries(despesasMap).map(([grupo, v]) => ({
      grupo,
      itens: Object.entries(v.itensAcc).map(([conta, valor]) => ({ conta, valor })),
      subtotal: v.subtotal,
    }));

    const totalDespesas = gruposDespesas.reduce((s, g) => s + g.subtotal, 0);

    // ── RESULTADO ─────────────────────────────────────────────────────────
    const resultadoOperacional = receitaLiquida - totalDespesas;

    // Receitas/Despesas financeiras (juros, rendimentos)
    const recFinanceiras  = rows.filter(r => isReceita(r) && (r.categoria?.toLowerCase().includes('juros') || r.categoria?.toLowerCase().includes('rendimento')));
    const despFinanceiras = rows.filter(r => isDespesa(r)  && (r.categoria?.toLowerCase().includes('juros') || r.categoria?.toLowerCase().includes('multa')));
    const resultadoFinanceiro = recFinanceiras.reduce((s, r) => s + this.num(r.total), 0)
                              - despFinanceiras.reduce((s, r) => s + this.num(r.total), 0);

    const resultadoExercicio = resultadoOperacional + resultadoFinanceiro;

    // ── MENSAL para gráfico ───────────────────────────────────────────────
    const mensal: any[] = await this.db.query(`
      SELECT
        EXTRACT(MONTH FROM data)::INT AS mes,
        SUM(valor) FILTER (WHERE tipo_movimentacao IN ('Receita','Entrada')) AS receita,
        SUM(valor) FILTER (WHERE tipo_movimentacao IN ('Despesa','Saída'))   AS despesa
      FROM movimentacoes_financeiras
      WHERE EXTRACT(YEAR FROM data) = $1
        AND EXTRACT(MONTH FROM data) BETWEEN $2 AND $3
        AND status IN ('Pago', 'Confirmado')
      GROUP BY mes ORDER BY mes
    `, [ano, mes_ini, mes_fim]);

    const meses = Array.from({ length: mes_fim - mes_ini + 1 }, (_, i) => {
      const m = mes_ini + i;
      const row = mensal.find(r => r.mes === m);
      const rec  = this.num(row?.receita);
      const desp = this.num(row?.despesa);
      return { mes: m, receita: rec, despesa: desp, resultado: rec - desp };
    });

    return {
      periodo: { ano, mes_ini, mes_fim },
      receitasBrutas,
      totalReceitasBrutas,
      deducoes,
      totalDeducoes,
      receitaLiquida,
      gruposDespesas,
      totalDespesas,
      resultadoOperacional,
      resultadoFinanceiro,
      resultadoExercicio,
      margem: receitaLiquida > 0
        ? ((resultadoExercicio / receitaLiquida) * 100).toFixed(2)
        : '0.00',
      evolucaoMensal: meses,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  NOVOS RELATÓRIOS — ONG / TERCEIRO SETOR
  // ══════════════════════════════════════════════════════════════════════════

  /** 1. Fluxo de Caixa Detalhado — transações com saldo acumulado */
  async fluxoCaixaDetalhado(data_ini: string, data_fim: string, projeto?: string, categoria?: string) {
    const params: any[] = [data_ini, data_fim];
    let extraWhere = '';
    if (projeto)   { params.push(`%${projeto}%`);   extraWhere += ` AND competencia ILIKE $${params.length}`; }
    if (categoria) { params.push(`%${categoria}%`); extraWhere += ` AND categoria   ILIKE $${params.length}`; }

    const rows: any[] = await this.db.query(`
      SELECT id, data, nome, descricao,
             tipo_movimentacao, categoria, plano_contas, competencia,
             forma_pagamento, valor, status
      FROM movimentacoes_financeiras
      WHERE data BETWEEN $1 AND $2 AND status IN ('Pago', 'Confirmado')${extraWhere}
      ORDER BY data ASC, created_at ASC
    `, params);

    let saldoAcumulado = 0;
    const transacoes = rows.map(r => {
      const isEntrada = r.tipo_movimentacao === 'Receita' || r.tipo_movimentacao === 'Entrada';
      saldoAcumulado += isEntrada ? this.num(r.valor) : -this.num(r.valor);
      return { ...r, valor: this.num(r.valor), saldo_acumulado: saldoAcumulado, tipo_fluxo: isEntrada ? 'entrada' : 'saida' };
    });

    const totalEntradas = transacoes.filter(t => t.tipo_fluxo === 'entrada').reduce((s, t) => s + t.valor, 0);
    const totalSaidas   = transacoes.filter(t => t.tipo_fluxo === 'saida').reduce((s, t) => s + t.valor, 0);
    return { periodo: { data_ini, data_fim }, total_entradas: totalEntradas, total_saidas: totalSaidas, saldo_periodo: totalEntradas - totalSaidas, qtd_transacoes: transacoes.length, transacoes };
  }

  /** 2. Demonstrativo de Receitas e Despesas — mensal */
  async demonstrativoReceitasDespesas(ano: number) {
    const rows: any[] = await this.db.query(`
      SELECT EXTRACT(MONTH FROM data)::INT AS mes, tipo_movimentacao, SUM(valor) AS total, COUNT(*) AS qtd
      FROM movimentacoes_financeiras
      WHERE EXTRACT(YEAR FROM data) = $1
      GROUP BY mes, tipo_movimentacao ORDER BY mes
    `, [ano]);

    const meses = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const rec  = rows.filter(r => r.mes === m && (r.tipo_movimentacao === 'Receita' || r.tipo_movimentacao === 'Entrada'));
      const desp = rows.filter(r => r.mes === m && (r.tipo_movimentacao === 'Despesa' || r.tipo_movimentacao === 'Saída'));
      const totalRec  = rec.reduce((s, r) => s + this.num(r.total), 0);
      const totalDesp = desp.reduce((s, r) => s + this.num(r.total), 0);
      return { mes: m, receitas: totalRec, despesas: totalDesp, saldo: totalRec - totalDesp };
    });

    return {
      ano, meses,
      totais: {
        receitas: meses.reduce((s, m) => s + m.receitas, 0),
        despesas: meses.reduce((s, m) => s + m.despesas, 0),
        saldo:    meses.reduce((s, m) => s + m.saldo, 0),
      },
    };
  }

  /** 3. Execução Orçamentária por Projeto (usa competencia como projeto) */
  async execucaoOrcamentaria(ano: number) {
    const rows: any[] = await this.db.query(`
      SELECT COALESCE(competencia,'Geral') AS projeto, tipo_movimentacao, SUM(valor) AS total, COUNT(*) AS qtd
      FROM movimentacoes_financeiras
      WHERE EXTRACT(YEAR FROM data) = $1
      GROUP BY projeto, tipo_movimentacao ORDER BY projeto
    `, [ano]);

    const map = Object.create(null) as Record<string, { projeto: string; receitas: number; despesas: number; qtd: number }>;
    for (const r of rows) {
      const proj = String(r.projeto ?? 'Geral');
      if (!map[proj]) map[proj] = { projeto: proj, receitas: 0, despesas: 0, qtd: 0 };
      const isRec = r.tipo_movimentacao === 'Receita' || r.tipo_movimentacao === 'Entrada';
      if (isRec) map[proj].receitas += this.num(r.total);
      else        map[proj].despesas += this.num(r.total);
      map[proj].qtd += this.num(r.qtd);
    }

    const projetos = Object.values(map).map(p => ({
      ...p,
      saldo: p.receitas - p.despesas,
      percentual_execucao: p.receitas > 0 ? ((p.despesas / p.receitas) * 100).toFixed(1) : '0',
    }));
    return { ano, projetos };
  }

  /** 4. Despesas por Categoria */
  async despesasPorCategoria(data_ini: string, data_fim: string) {
    const rows: any[] = await this.db.query(`
      SELECT COALESCE(plano_contas, categoria, 'Sem categoria') AS categoria, SUM(valor) AS total, COUNT(*) AS qtd
      FROM movimentacoes_financeiras
      WHERE data BETWEEN $1 AND $2
        AND tipo_movimentacao IN ('Despesa','Saída') AND status IN ('Pago', 'Confirmado')
      GROUP BY categoria ORDER BY total DESC
    `, [data_ini, data_fim]);

    const total_geral = rows.reduce((s, r) => s + this.num(r.total), 0);
    return {
      periodo: { data_ini, data_fim },
      total_despesas: total_geral,
      categorias: rows.map(r => ({
        categoria: r.categoria,
        total: this.num(r.total),
        qtd: this.num(r.qtd),
        percentual: total_geral > 0 ? ((this.num(r.total) / total_geral) * 100).toFixed(1) : '0',
      })),
    };
  }

  /** 5. Despesas por Projeto */
  async despesasPorProjeto(data_ini: string, data_fim: string) {
    const rows: any[] = await this.db.query(`
      SELECT COALESCE(competencia,'Sem projeto') AS projeto, COALESCE(categoria,'Sem categoria') AS categoria,
             SUM(valor) AS total, COUNT(*) AS qtd
      FROM movimentacoes_financeiras
      WHERE data BETWEEN $1 AND $2
        AND tipo_movimentacao IN ('Despesa','Saída') AND status IN ('Pago', 'Confirmado')
      GROUP BY projeto, categoria ORDER BY projeto, total DESC
    `, [data_ini, data_fim]);

    // Object.create(null) evita Prototype Pollution (CWE-1321) — nenhuma chave herdada do Object.prototype
    const map: Record<string, { projeto: string; total: number; categorias: {categoria:string;total:number;qtd:number}[] }> = Object.create(null);
    for (const r of rows) {
      const chave = String(r.projeto ?? 'Sem projeto');
      if (!Object.prototype.hasOwnProperty.call(map, chave)) {
        map[chave] = { projeto: chave, total: 0, categorias: [] };
      }
      map[chave].total += this.num(r.total);
      map[chave].categorias.push({ categoria: r.categoria, total: this.num(r.total), qtd: this.num(r.qtd) });
    }
    const total_geral = Object.values(map).reduce((s, p) => s + p.total, 0);
    return {
      periodo: { data_ini, data_fim },
      total_despesas: total_geral,
      projetos: Object.values(map).map(p => ({
        ...p,
        percentual: total_geral > 0 ? ((p.total / total_geral) * 100).toFixed(1) : '0',
      })),
    };
  }

  /** 6. Origem de Recursos */
  async origemRecursos(data_ini: string, data_fim: string) {
    const rows: any[] = await this.db.query(`
      SELECT COALESCE(categoria,'Outras Receitas') AS fonte, SUM(valor) AS total, COUNT(*) AS qtd
      FROM movimentacoes_financeiras
      WHERE data BETWEEN $1 AND $2
        AND tipo_movimentacao IN ('Receita','Entrada') AND status IN ('Pago', 'Confirmado')
      GROUP BY fonte ORDER BY total DESC
    `, [data_ini, data_fim]);

    const total = rows.reduce((s, r) => s + this.num(r.total), 0);
    return {
      periodo: { data_ini, data_fim },
      total_receitas: total,
      fontes: rows.map(r => ({
        fonte: r.fonte, total: this.num(r.total), qtd: this.num(r.qtd),
        percentual: total > 0 ? ((this.num(r.total) / total) * 100).toFixed(1) : '0',
      })),
    };
  }

  /** 7. Pagamentos a Fornecedores */
  async pagamentosFornecedores(data_ini: string, data_fim: string) {
    const rows: any[] = await this.db.query(`
      SELECT nome AS fornecedor, descricao AS servico_produto,
             COALESCE(competencia,'Geral') AS projeto,
             categoria, plano_contas, valor, data, forma_pagamento
      FROM movimentacoes_financeiras
      WHERE data BETWEEN $1 AND $2
        AND tipo_movimentacao IN ('Despesa','Saída') AND status IN ('Pago', 'Confirmado')
      ORDER BY data DESC
    `, [data_ini, data_fim]);

    const byForn = Object.create(null) as Record<string, { fornecedor: string; total: number; qtd: number }>;
    for (const r of rows) {
      const f = String(r.fornecedor ?? 'Sem identificação');
      if (!byForn[f]) byForn[f] = { fornecedor: f, total: 0, qtd: 0 };
      byForn[f].total += this.num(r.valor);
      byForn[f].qtd++;
    }
    return {
      periodo: { data_ini, data_fim },
      total_pago: rows.reduce((s, r) => s + this.num(r.valor), 0),
      qtd_pagamentos: rows.length,
      pagamentos: rows.map(r => ({ ...r, valor: this.num(r.valor) })),
      por_fornecedor: Object.values(byForn).sort((a, b) => b.total - a.total),
    };
  }

  /** 8. Relatório Financeiro Anual */
  async relatorioFinanceiroAnual(ano: number) {
    const [mensal, resumo]: [any[], any[]] = await Promise.all([
      this.db.query(`
        SELECT EXTRACT(MONTH FROM data)::INT AS mes,
          SUM(valor) FILTER (WHERE tipo_movimentacao IN ('Receita','Entrada')) AS receitas,
          SUM(valor) FILTER (WHERE tipo_movimentacao IN ('Despesa','Saída'))   AS despesas
        FROM movimentacoes_financeiras
        WHERE EXTRACT(YEAR FROM data) = $1
        GROUP BY mes ORDER BY mes
      `, [ano]),
      this.db.query(`
        SELECT
          SUM(valor) FILTER (WHERE tipo_movimentacao IN ('Receita','Entrada')) AS total_receitas,
          SUM(valor) FILTER (WHERE tipo_movimentacao IN ('Despesa','Saída'))   AS total_despesas,
          SUM(valor) FILTER (WHERE categoria = 'Doação')                       AS total_doacoes,
          COUNT(*) AS total_lancamentos
        FROM movimentacoes_financeiras WHERE EXTRACT(YEAR FROM data) = $1
      `, [ano]),
    ]);

    const meses = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const row = mensal.find(r => r.mes === m);
      const rec  = this.num(row?.receitas);
      const desp = this.num(row?.despesas);
      return { mes: m, receitas: rec, despesas: desp, saldo: rec - desp };
    });

    const r = resumo[0];
    return {
      ano,
      total_receitas:    this.num(r.total_receitas),
      total_despesas:    this.num(r.total_despesas),
      total_doacoes:     this.num(r.total_doacoes),
      total_lancamentos: this.num(r.total_lancamentos),
      saldo_final: this.num(r.total_receitas) - this.num(r.total_despesas),
      meses,
    };
  }

  /** 9. Prestação de Contas por Projeto */
  async prestacaoContas(projeto: string, data_ini: string, data_fim: string) {
    const params: any[] = [data_ini, data_fim];
    let projWhere = '';
    if (projeto) { params.push(`%${projeto}%`); projWhere = ` AND competencia ILIKE $${params.length}`; }

    const rows: any[] = await this.db.query(`
      SELECT tipo_movimentacao, categoria, plano_contas,
             nome, descricao, valor, data, forma_pagamento, status
      FROM movimentacoes_financeiras
      WHERE data BETWEEN $1 AND $2${projWhere}
      ORDER BY data ASC
    `, params);

    const receitas = rows.filter(r => r.tipo_movimentacao === 'Receita' || r.tipo_movimentacao === 'Entrada');
    const despesas = rows.filter(r => r.tipo_movimentacao === 'Despesa' || r.tipo_movimentacao === 'Saída');
    const totalReceitas = receitas.reduce((s, r) => s + this.num(r.valor), 0);
    const totalDespesas = despesas.reduce((s, r) => s + this.num(r.valor), 0);

    const byCat = Object.create(null) as Record<string, { categoria: string; receitas: number; despesas: number }>;
    for (const r of rows) {
      const cat = String(r.categoria ?? 'Sem categoria');
      if (!byCat[cat]) byCat[cat] = { categoria: cat, receitas: 0, despesas: 0 };
      const isRec = r.tipo_movimentacao === 'Receita' || r.tipo_movimentacao === 'Entrada';
      if (isRec) byCat[cat].receitas += this.num(r.valor);
      else        byCat[cat].despesas += this.num(r.valor);
    }

    return {
      projeto: projeto || 'Todos os projetos',
      periodo: { data_ini, data_fim },
      resumo: { total_receitas: totalReceitas, total_despesas: totalDespesas, saldo: totalReceitas - totalDespesas, qtd_lancamentos: rows.length },
      por_categoria: Object.values(byCat),
      lancamentos: rows.map(r => ({ ...r, valor: this.num(r.valor) })),
    };
  }

  /** 10. Custo por Beneficiário */
  async custoPorBeneficiario(data_ini: string, data_fim: string) {
    const [despesas, beneficiarios]: [any[], any[]] = await Promise.all([
      this.db.query(`
        SELECT COALESCE(competencia,'Geral') AS projeto, SUM(valor) AS total_despesas
        FROM movimentacoes_financeiras
        WHERE data BETWEEN $1 AND $2
          AND tipo_movimentacao IN ('Despesa','Saída') AND status IN ('Pago', 'Confirmado')
        GROUP BY projeto
      `, [data_ini, data_fim]),
      this.db.query(`SELECT COUNT(*) FILTER (WHERE ativo = true) AS total FROM alunos`),
    ]);

    const totalBenef  = Math.max(this.num(beneficiarios[0]?.total), 1);
    const totalDesp   = despesas.reduce((s, r) => s + this.num(r.total_despesas), 0);
    return {
      periodo: { data_ini, data_fim },
      total_investido: totalDesp,
      total_beneficiarios: totalBenef,
      custo_medio: (totalDesp / totalBenef).toFixed(2),
      por_projeto: despesas.map(d => ({
        projeto: d.projeto,
        total_despesas: this.num(d.total_despesas),
        custo_por_beneficiario: (this.num(d.total_despesas) / totalBenef).toFixed(2),
      })),
    };
  }

  /** 11. Impacto Financeiro do Projeto */
  async impactoFinanceiroProjeto(data_ini: string, data_fim: string) {
    const [financeiro, atividades, beneficiarios]: [any[], any[], any[]] = await Promise.all([
      this.db.query(`
        SELECT
          SUM(valor) FILTER (WHERE tipo_movimentacao IN ('Despesa','Saída'))   AS total_despesas,
          SUM(valor) FILTER (WHERE tipo_movimentacao IN ('Receita','Entrada')) AS total_receitas
        FROM movimentacoes_financeiras WHERE data BETWEEN $1 AND $2 AND status IN ('Pago', 'Confirmado')
      `, [data_ini, data_fim]),
      this.db.query(`
        SELECT COUNT(*) AS total_sessoes, COALESCE(SUM(total_presentes), 0) AS total_presencas
        FROM presenca_sessoes WHERE data BETWEEN $1 AND $2
      `, [data_ini, data_fim]),
      this.db.query(`SELECT COUNT(*) FILTER (WHERE ativo = true) AS total FROM alunos`),
    ]);

    const totalDesp    = this.num(financeiro[0]?.total_despesas);
    const totalSessoes = Math.max(this.num(atividades[0]?.total_sessoes), 1);
    const totalAlunos  = Math.max(this.num(beneficiarios[0]?.total), 1);
    return {
      periodo: { data_ini, data_fim },
      investimento_total:       totalDesp,
      total_beneficiarios:      totalAlunos,
      numero_atividades:        totalSessoes,
      total_presencas:          this.num(atividades[0]?.total_presencas),
      custo_medio_atividade:    (totalDesp / totalSessoes).toFixed(2),
      custo_medio_beneficiario: (totalDesp / totalAlunos).toFixed(2),
    };
  }

  /** 12. Diversificação de Receitas (com índice HHI) */
  async diversificacaoReceitas(data_ini: string, data_fim: string) {
    const rows: any[] = await this.db.query(`
      SELECT
        CASE
          WHEN categoria ILIKE '%doaç%' OR categoria ILIKE '%doac%' THEN 'Doações'
          WHEN categoria ILIKE '%edital%' OR categoria ILIKE '%fundo%'    THEN 'Editais/Fundos'
          WHEN categoria ILIKE '%conv%nio%'                               THEN 'Convênios'
          WHEN categoria ILIKE '%parceria%'                               THEN 'Parcerias'
          WHEN categoria ILIKE '%evento%'                                 THEN 'Eventos'
          ELSE COALESCE(categoria, 'Outras Receitas')
        END AS fonte,
        SUM(valor) AS total, COUNT(*) AS qtd
      FROM movimentacoes_financeiras
      WHERE data BETWEEN $1 AND $2
        AND tipo_movimentacao IN ('Receita','Entrada') AND status IN ('Pago', 'Confirmado')
      GROUP BY fonte ORDER BY total DESC
    `, [data_ini, data_fim]);

    const total = rows.reduce((s, r) => s + this.num(r.total), 0);
    const fontes = rows.map(r => ({
      fonte: r.fonte, total: this.num(r.total), qtd: this.num(r.qtd),
      percentual: total > 0 ? ((this.num(r.total) / total) * 100).toFixed(1) : '0',
    }));
    const hhi = fontes.reduce((s, f) => { const p = total > 0 ? (f.total / total) : 0; return s + p * p; }, 0);
    return {
      periodo: { data_ini, data_fim },
      total_receitas: total,
      fontes,
      hhi: (hhi * 100).toFixed(1),
      nivel_diversificacao: hhi < 0.25 ? 'Diversificado' : hhi < 0.6 ? 'Moderado' : 'Concentrado',
    };
  }

  /** 13. Sustentabilidade Financeira */
  async sustentabilidadeFinanceira() {
    const [saldoRes, despRes]: [any[], any[]] = await Promise.all([
      this.db.query(`
        SELECT COALESCE(SUM(CASE
          WHEN tipo_movimentacao IN ('Receita','Entrada') THEN valor ELSE -valor
        END), 0) AS saldo_atual
        FROM movimentacoes_financeiras WHERE status IN ('Pago', 'Confirmado')
      `),
      this.db.query(`
        SELECT COALESCE(AVG(mensal), 0) AS media_mensal FROM (
          SELECT DATE_TRUNC('month', data) AS mes, SUM(valor) AS mensal
          FROM movimentacoes_financeiras
          WHERE tipo_movimentacao IN ('Despesa','Saída') AND status IN ('Pago', 'Confirmado')
            AND data >= NOW() - INTERVAL '12 months'
          GROUP BY mes
        ) sub
      `),
    ]);

    const saldo       = this.num(saldoRes[0]?.saldo_atual);
    const mediaDesp   = this.num(despRes[0]?.media_mensal);
    const mesesOp     = mediaDesp > 0 ? saldo / mediaDesp : 0;
    return {
      saldo_atual:        saldo,
      media_desp_mensal:  mediaDesp,
      meses_operacao:     Math.max(0, mesesOp).toFixed(1),
      nivel:              mesesOp >= 6 ? 'Saudável' : mesesOp >= 3 ? 'Atenção' : 'Crítico',
      cor:                mesesOp >= 6 ? 'green'    : mesesOp >= 3 ? 'yellow'   : 'red',
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  ENVIO DE RELATÓRIOS POR E-MAIL
  // ══════════════════════════════════════════════════════════════════════════

  private moeda(v: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0);
  }

  private htmlWrapper(titulo: string, corpo: string, periodo?: string) {
    return `<!DOCTYPE html><html lang="pt-br"><head><meta charset="UTF-8">
<title>${titulo}</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 16px">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08)">
<tr><td style="background:#1e3a5f;padding:28px 36px">
  <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700">Instituto Tia Pretinha</h1>
  <p style="margin:4px 0 0;color:#93c5fd;font-size:13px">${titulo}</p>
  ${periodo ? `<p style="margin:4px 0 0;color:#bfdbfe;font-size:11px">Período: ${periodo}</p>` : ''}
</td></tr>
<tr><td style="padding:28px 36px">${corpo}</td></tr>
<tr><td style="padding:16px 36px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center">
  <p style="margin:0;color:#94a3b8;font-size:11px">Relatório gerado automaticamente pelo sistema ERP ITP</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
  }

  private kpiHtml(items: { label: string; value: string; color?: string }[]) {
    return `<table width="100%" cellspacing="8" style="margin-bottom:20px"><tr>
${items.map(i => `<td style="background:#f8fafc;border-radius:8px;padding:14px;text-align:center;width:${Math.floor(100/items.length)}%">
  <p style="margin:0;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">${i.label}</p>
  <p style="margin:4px 0 0;font-size:20px;font-weight:900;color:${i.color || '#1e3a5f'}">${i.value}</p>
</td>`).join('')}
</tr></table>`;
  }

  private tabelaHtml(headers: string[], rows: string[][]) {
    return `<table width="100%" cellspacing="0" style="border-collapse:collapse;font-size:12px;margin-top:12px">
<thead><tr>${headers.map(h => `<th style="background:#f1f5f9;padding:8px 10px;text-align:left;font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;border-bottom:1px solid #e2e8f0">${h}</th>`).join('')}</tr></thead>
<tbody>${rows.map((r, i) =>
  `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">${r.map(c => `<td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;color:#334155">${c}</td>`).join('')}</tr>`
).join('')}</tbody>
</table>`;
  }

  async enviarRelatorioEmail(
    tipo: string,
    params: Record<string, string>,
    destinatario: string,
  ): Promise<void> {
    const now  = new Date();
    const hoje = now.toLocaleDateString('pt-BR');
    const ini  = params.data_ini || `${now.getFullYear()}-01-01`;
    const fim  = params.data_fim || now.toISOString().slice(0, 10);
    const ano  = Number(params.ano) || now.getFullYear();
    const periodoFmt = `${new Date(ini + 'T12:00').toLocaleDateString('pt-BR')} a ${new Date(fim + 'T12:00').toLocaleDateString('pt-BR')}`;

    let titulo = 'Relatório ITP';
    let corpo  = '';

    if (tipo === 'resumo_financeiro') {
      titulo = 'Resumo Financeiro';
      const d = await this.resumoFinanceiro(ini, fim);
      corpo = this.kpiHtml([
        { label: 'Receitas',  value: this.moeda(d.total_receitas as number), color: '#16a34a' },
        { label: 'Despesas',  value: this.moeda(d.total_despesas as number), color: '#dc2626' },
        { label: 'Saldo',     value: this.moeda(d.saldo as number), color: (d.saldo as number) >= 0 ? '#16a34a' : '#dc2626' },
      ]);
      if (Array.isArray(d.categorias) && d.categorias.length > 0) {
        const cats = d.categorias as any[];
        corpo += this.tabelaHtml(
          ['Categoria', 'Receita', 'Despesa'],
          cats.map(c => [String(c.categoria || '–'), this.moeda(Number(c.receita)), this.moeda(Number(c.despesa))]),
        );
      }
    } else if (tipo === 'fluxo_caixa') {
      titulo = `Fluxo de Caixa — ${ano}`;
      const d = await this.fluxoCaixaMensal(ano);
      const meses = (d.meses || []) as any[];
      corpo = this.tabelaHtml(
        ['Mês', 'Receita', 'Despesa', 'Saldo'],
        meses.map(m => [String(m.mes), this.moeda(Number(m.receita)), this.moeda(Number(m.despesa)), this.moeda(Number(m.saldo))]),
      );
    } else if (tipo === 'doacoes') {
      titulo = 'Relatório de Doações';
      const d = await this.relatorioDoacoes(ini, fim);
      corpo = this.kpiHtml([
        { label: 'Total Doado', value: this.moeda(d.total_doacoes as number), color: '#db2777' },
        { label: 'Nº Doadores', value: String(d.num_doadores), color: '#7c3aed' },
      ]);
      if (Array.isArray(d.maiores_doadores) && (d.maiores_doadores as any[]).length > 0) {
        const doad = d.maiores_doadores as any[];
        corpo += '<p style="margin:16px 0 6px;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase">Maiores Doadores</p>';
        corpo += this.tabelaHtml(
          ['Doador', 'Total'],
          doad.slice(0, 10).map(d => [String(d.nome_doador || d.nome || '–'), this.moeda(Number(d.total))]),
        );
      }
    } else if (tipo === 'alunos') {
      titulo = 'Relatório Acadêmico — Alunos';
      const d = await this.relatorioAlunos();
      corpo = this.kpiHtml([
        { label: 'Ativos',   value: String(d.total_ativos),   color: '#2563eb' },
        { label: 'Inativos', value: String(d.total_inativos), color: '#64748b' },
      ]);
      if (Array.isArray(d.por_curso) && (d.por_curso as any[]).length > 0) {
        corpo += '<p style="margin:16px 0 6px;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase">Por Curso</p>';
        corpo += this.tabelaHtml(
          ['Curso', 'Alunos'],
          (d.por_curso as any[]).map(c => [String(c.cursos_matriculados || c.curso || '–'), String(c.total)]),
        );
      }
    } else if (tipo === 'estoque') {
      titulo = 'Posição de Estoque';
      const d = await this.relatorioEstoque();
      corpo = this.kpiHtml([
        { label: 'Total Produtos', value: String(d.total_produtos), color: '#ea580c' },
        { label: 'Críticos',       value: String(d.total_criticos),  color: '#dc2626' },
      ]);
      if (Array.isArray(d.produtos) && (d.produtos as any[]).length > 0) {
        const criticos = (d.produtos as any[]).filter(p => p.critico);
        if (criticos.length > 0) {
          corpo += '<p style="margin:16px 0 6px;font-size:11px;font-weight:700;color:#dc2626;text-transform:uppercase">Itens em Nível Crítico</p>';
          corpo += this.tabelaHtml(
            ['Produto', 'Qtd Atual', 'Estoque Mínimo'],
            criticos.map(p => [String(p.nome), String(p.quantidade_atual), String(p.estoque_minimo)]),
          );
        }
      }
    } else if (tipo === 'impacto_social') {
      titulo = 'Impacto Social — ITP';
      const d = await this.relatorioImpactoSocial();
      corpo = this.kpiHtml([
        { label: 'Alunos Beneficiados', value: String(d.total_alunos_ativos), color: '#2563eb' },
        { label: 'Doadores Ativos',     value: String(d.doadores_ativos),     color: '#db2777' },
        { label: 'Receita Total',        value: this.moeda(d.receita_total as number), color: '#16a34a' },
      ]);
    } else if (tipo === 'matriculas') {
      titulo = 'Pipeline de Matrículas';
      const d = await this.relatorioMatriculas(ini, fim);
      if (Array.isArray(d.por_status)) {
        corpo = this.tabelaHtml(
          ['Status', 'Total'],
          (d.por_status as any[]).map(s => [String(s.status_matricula), String(s.total)]),
        );
      }
    } else if (tipo === 'dre') {
      titulo = `DRE — ${ano}`;
      const mesIni = Number(params.mes_ini) || 1;
      const mesFim = Number(params.mes_fim) || 12;
      const d = await this.dre(ano, mesIni, mesFim);
      corpo = this.kpiHtml([
        { label: 'Receita Bruta',   value: this.moeda(d.totalReceitasBrutas as number), color: '#16a34a' },
        { label: 'Total Despesas',  value: this.moeda(d.totalDespesas as number),        color: '#dc2626' },
        { label: 'Resultado',       value: this.moeda(d.resultadoExercicio as number),   color: (d.resultadoExercicio as number) >= 0 ? '#16a34a' : '#dc2626' },
        { label: 'Margem',          value: `${d.margem}%`,                               color: '#7c3aed' },
      ]);
    } else {
      corpo = `<p style="color:#64748b;font-size:13px">Relatório <strong>${tipo}</strong> gerado em ${hoje}.</p>`;
    }

    const html = this.htmlWrapper(titulo, corpo, tipo !== 'alunos' && tipo !== 'impacto_social' && tipo !== 'estoque' ? periodoFmt : undefined);
    await this.email.enviarGenerico(destinatario, `[ITP] ${titulo} — ${hoje}`, html);
    this.logger.log(`📧 Relatório "${titulo}" enviado para ${destinatario}`);
  }
}

