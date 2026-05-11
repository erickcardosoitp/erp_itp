import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class PublicoService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async getPrestacaoContas(ano?: string, mes?: string) {
    const anoFiltro = ano ?? new Date().getFullYear().toString();
    // mes no formato '04' ou '2026-04'
    const mesFiltro = mes ? mes.padStart(2, '0').slice(-2) : null;

    const [
      resumoFinanceiro,
      porMes,
      porCategoria,
      movimentacoes,
      alunos,
      cursos,
      voluntarios,
    ] = await Promise.all([
      // Totais do período
      this.ds.query<{ tipo: string; total: string }[]>(`
        SELECT
          COALESCE(tipo_movimentacao, 'Não classificado') AS tipo,
          SUM(valor)::numeric AS total
        FROM movimentacoes_financeiras
        WHERE EXTRACT(YEAR FROM data) = $1
          ${mesFiltro ? `AND EXTRACT(MONTH FROM data) = ${parseInt(mesFiltro)}` : ''}
          AND status NOT IN ('Cancelada', 'Cancelado')
        GROUP BY tipo_movimentacao
      `, [anoFiltro]),

      // Por mês (sempre do ano inteiro para mostrar evolução)
      this.ds.query<{ mes: string; tipo: string; total: string }[]>(`
        SELECT
          TO_CHAR(data, 'YYYY-MM') AS mes,
          COALESCE(tipo_movimentacao, 'Não classificado') AS tipo,
          SUM(valor)::numeric AS total
        FROM movimentacoes_financeiras
        WHERE EXTRACT(YEAR FROM data) = $1
          AND status NOT IN ('Cancelada', 'Cancelado')
        GROUP BY mes, tipo_movimentacao
        ORDER BY mes ASC
      `, [anoFiltro]),

      // Por categoria/plano de contas do período
      this.ds.query<{ categoria: string; tipo: string; total: string }[]>(`
        SELECT
          COALESCE(plano_contas, categoria, 'Outros') AS categoria,
          COALESCE(tipo_movimentacao, 'Não classificado') AS tipo,
          SUM(valor)::numeric AS total
        FROM movimentacoes_financeiras
        WHERE EXTRACT(YEAR FROM data) = $1
          ${mesFiltro ? `AND EXTRACT(MONTH FROM data) = ${parseInt(mesFiltro)}` : ''}
          AND status NOT IN ('Cancelada', 'Cancelado')
        GROUP BY categoria, plano_contas, tipo_movimentacao
        ORDER BY total DESC
        LIMIT 30
      `, [anoFiltro]),

      // Movimentações detalhadas do período
      this.ds.query<{ data: string; nome: string; descricao: string; tipo: string; valor: string; categoria: string; status: string }[]>(`
        SELECT
          TO_CHAR(data, 'YYYY-MM-DD') AS data,
          nome,
          descricao,
          COALESCE(tipo_movimentacao, 'Não classificado') AS tipo,
          valor::numeric AS valor,
          COALESCE(plano_contas, categoria, '') AS categoria,
          status
        FROM movimentacoes_financeiras
        WHERE EXTRACT(YEAR FROM data) = $1
          ${mesFiltro ? `AND EXTRACT(MONTH FROM data) = ${parseInt(mesFiltro)}` : ''}
          AND status NOT IN ('Cancelada', 'Cancelado')
        ORDER BY data DESC
        LIMIT 200
      `, [anoFiltro]),

      // Alunos ativos
      this.ds.query<{ total: string }[]>(`
        SELECT COUNT(*) AS total FROM alunos WHERE ativo = true
      `),

      // Cursos ativos
      this.ds.query<{ total: string; nomes: string }[]>(`
        SELECT COUNT(*) AS total, STRING_AGG(nome, ', ' ORDER BY nome) AS nomes
        FROM materias WHERE status = 'Ativo'
      `),

      // Voluntários ativos no módulo Gente
      this.ds.query<{ total: string }[]>(`
        SELECT COUNT(*) AS total FROM gente_colaboradores WHERE ativo = true
      `),
    ]);

    const totalReceitas = resumoFinanceiro
      .filter(r => r.tipo?.toUpperCase().includes('RECEITA'))
      .reduce((acc, r) => acc + parseFloat(r.total ?? '0'), 0);

    const totalDespesas = resumoFinanceiro
      .filter(r => r.tipo?.toUpperCase().includes('DESPESA'))
      .reduce((acc, r) => acc + parseFloat(r.total ?? '0'), 0);

    // Agrupa por mês em objeto { '2026-01': { receitas: X, despesas: Y } }
    const mesesMap: Record<string, { mes: string; receitas: number; despesas: number; saldo: number }> = {};
    for (const row of porMes) {
      if (!mesesMap[row.mes]) {
        mesesMap[row.mes] = { mes: row.mes, receitas: 0, despesas: 0, saldo: 0 };
      }
      const v = parseFloat(row.total ?? '0');
      if (row.tipo?.toUpperCase().includes('RECEITA')) mesesMap[row.mes].receitas += v;
      else mesesMap[row.mes].despesas += v;
    }
    const porMesAgrupado = Object.values(mesesMap).map(m => ({
      ...m,
      saldo: m.receitas - m.despesas,
    }));

    return {
      ano: anoFiltro,
      mes: mesFiltro,
      atualizadoEm: new Date().toISOString(),
      resumo: {
        alunosAtivos: parseInt(alunos[0]?.total ?? '0'),
        cursosAtivos: parseInt(cursos[0]?.total ?? '0'),
        nomesCursos: cursos[0]?.nomes ?? '',
        voluntarios: parseInt(voluntarios[0]?.total ?? '0'),
        totalReceitas,
        totalDespesas,
        saldo: totalReceitas - totalDespesas,
      },
      porMes: porMesAgrupado,
      porCategoria: porCategoria.map(r => ({
        categoria: r.categoria,
        tipo: r.tipo,
        valor: parseFloat(r.total ?? '0'),
      })),
      movimentacoes: movimentacoes.map(r => ({
        data: r.data,
        descricao: r.nome,
        detalhes: r.descricao ?? null,
        tipo: r.tipo,
        valor: parseFloat(r.valor ?? '0'),
        categoria: r.categoria,
        status: r.status,
      })),
    };
  }
}
