import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class RelatoriosService {
  private readonly logger = new Logger(RelatoriosService.name);

  constructor(@InjectDataSource() private readonly db: DataSource) {}

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
    const byCategoria: Record<string, { receita: number; despesa: number }> = {};
    for (const r of rows) {
      const cat = r.categoria || 'Sem categoria';
      if (!byCategoria[cat]) byCategoria[cat] = { receita: 0, despesa: 0 };
      const isReceita = r.tipo_movimentacao === 'Receita' || r.tipo_movimentacao === 'Entrada';
      if (isReceita) byCategoria[cat].receita += this.num(r.total);
      else            byCategoria[cat].despesa += this.num(r.total);
    }

    return {
      periodo: { data_ini, data_fim },
      totalReceitas,
      totalDespesas,
      saldo,
      lucratividade: totalReceitas > 0 ? ((saldo / totalReceitas) * 100).toFixed(1) : '0',
      porCategoria: Object.entries(byCategoria).map(([categoria, v]) => ({ categoria, ...v })),
      porStatus: this.agruparPor(rows, 'status', 'total'),
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
        AND status = 'Pago'
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

    const grouped: Record<string, any> = {};
    for (const r of rows) {
      const plano = r.plano_contas || 'Sem plano';
      if (!grouped[plano]) grouped[plano] = { plano_contas: plano, receita: 0, despesa: 0, qtd: 0 };
      const isReceita = r.tipo_movimentacao === 'Receita' || r.tipo_movimentacao === 'Entrada';
      if (isReceita) grouped[plano].receita += this.num(r.total);
      else grouped[plano].despesa += this.num(r.total);
      grouped[plano].qtd += this.num(r.qtd);
    }

    const itens = Object.values(grouped);
    return {
      mes, ano,
      itens,
      totais: {
        receita: itens.reduce((s, i) => s + i.receita, 0),
        despesa: itens.reduce((s, i) => s + i.despesa, 0),
      },
    };
  }

  /** Top doadores e evolução de doações */
  async relatorioDoacoes(data_ini: string, data_fim: string) {
    const [resumo, mensal]: [any[], any[]] = await Promise.all([
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
    ]);

    const [contadoresDoadores]: [any[]] = await Promise.all([
      this.db.query(`
        SELECT COUNT(*) AS total_doadores FROM doadores WHERE ativo = true
      `),
    ]);

    return {
      periodo: { data_ini, data_fim },
      totalDoadores: this.num(contadoresDoadores[0]?.total_doadores),
      totalArrecadado: resumo.reduce((s, r) => s + this.num(r.total), 0),
      totalDoacoes: resumo.reduce((s, r) => s + this.num(r.qtd), 0),
      topDoadores: resumo,
      evolucaoMensal: mensal,
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
      totais: totais[0],
      porCidade,
      porTurno,
      porCurso,
      porTurma,
      ultimosMatriculados,
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
      this.db.query(`SELECT nome, especialidade, status FROM professores ORDER BY nome`),
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

    return { cursos, professores, turmas, grade };
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
      alunos: alunos[0],
      financeiro: financeiro[0],
      doadores: doacoes[0],
      estoque: estoque[0],
      presencasMes: sessoesMes[0],
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
      movimentosRecentes: movimentos,
      porCategoria,
      resumo: {
        total: produtos.length,
        criticos: produtos.filter((p: any) => p.critico).length,
        ok: produtos.filter((p: any) => !p.critico).length,
      },
    };
  }

  /** Movimentos de estoque no período */
  async relatorioMovimentoEstoque(data_ini: string, data_fim: string) {
    const rows: any[] = await this.db.query(`
      SELECT
        m.*,
        p.nome AS produto_nome,
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
    const whereData = data_ini && data_fim
      ? `AND DATE(i.created_at) BETWEEN '${data_ini}' AND '${data_fim}'`
      : '';

    const [porStatus, porCurso, mensal, recentes]: [any[], any[], any[], any[]] = await Promise.all([
      this.db.query(`
        SELECT status, COUNT(*) AS qtd FROM inscricoes
        WHERE 1=1 ${whereData} GROUP BY status ORDER BY qtd DESC
      `),
      this.db.query(`
        SELECT curso_interesse, COUNT(*) AS qtd FROM inscricoes i
        WHERE 1=1 ${whereData} GROUP BY curso_interesse ORDER BY qtd DESC
      `),
      this.db.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS mes,
          COUNT(*) AS qtd
        FROM inscricoes i WHERE 1=1 ${whereData}
        GROUP BY mes ORDER BY mes
      `),
      this.db.query(`
        SELECT nome_completo, email, curso_interesse, status, created_at
        FROM inscricoes i WHERE 1=1 ${whereData}
        ORDER BY created_at DESC LIMIT 15
      `),
    ]);

    return { porStatus, porCurso, mensal, recentes };
  }

  // ── UTILITÁRIO ─────────────────────────────────────────────────────────────

  private agruparPor(rows: any[], campo: string, soma: string) {
    const map: Record<string, number> = {};
    for (const r of rows) {
      const k = r[campo] || 'Outros';
      map[k] = (map[k] || 0) + this.num(r[soma]);
    }
    return Object.entries(map).map(([k, v]) => ({ [campo]: k, total: v }));
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
        AND status = 'Pago'
      GROUP BY tipo_movimentacao, categoria, plano_contas
      ORDER BY tipo_movimentacao, plano_contas, categoria
    `, [ano, mes_ini, mes_fim]);

    // Separação receitas x despesas
    const isReceita  = (r: any) => r.tipo_movimentacao === 'Receita' || r.tipo_movimentacao === 'Entrada';
    const isDespesa  = (r: any) => r.tipo_movimentacao === 'Despesa' || r.tipo_movimentacao === 'Saída';
    const isDeducao  = (r: any) => r.tipo_movimentacao === 'Dedução'  || r.categoria?.toLowerCase().includes('devolução') || r.categoria?.toLowerCase().includes('desconto');

    // ── GRUPO: Receitas Operacionais ──────────────────────────────────────
    const receitasBrutas = rows
      .filter(r => isReceita(r) && !isDeducao(r))
      .map(r => ({ conta: r.plano_contas || r.categoria || 'Receitas', valor: this.num(r.total) }));

    const deducoes = rows
      .filter(r => isDeducao(r))
      .map(r => ({ conta: r.plano_contas || r.categoria || 'Deduções', valor: this.num(r.total) }));

    const totalReceitasBrutas  = receitasBrutas.reduce((s, i) => s + i.valor, 0);
    const totalDeducoes        = deducoes.reduce((s, i) => s + i.valor, 0);
    const receitaLiquida       = totalReceitasBrutas - totalDeducoes;

    // ── GRUPO: Despesas (agrupadas por plano_contas ou categoria) ─────────
    const despesasMap: Record<string, { itens: { conta: string; valor: number }[]; subtotal: number }> = {};

    for (const r of rows.filter(r => isDespesa(r))) {
      const grupo = r.plano_contas || 'Outras Despesas';
      if (!despesasMap[grupo]) despesasMap[grupo] = { itens: [], subtotal: 0 };
      despesasMap[grupo].itens.push({ conta: r.categoria || grupo, valor: this.num(r.total) });
      despesasMap[grupo].subtotal += this.num(r.total);
    }

    const gruposDespesas = Object.entries(despesasMap).map(([grupo, v]) => ({
      grupo,
      itens: v.itens,
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
        AND status = 'Pago'
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
}
