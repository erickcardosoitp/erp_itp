import { Injectable, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { GenteColaborador } from './entities/gente-colaborador.entity';
import { GentePonto } from './entities/gente-ponto.entity';
import { GenteRecibo } from './entities/gente-recibo.entity';
import { GenteVale } from './entities/gente-vale.entity';
import { GenteAdvertencia } from './entities/gente-advertencia.entity';
import { GenteSuspensao } from './entities/gente-suspensao.entity';
import { GenteFalta } from './entities/gente-falta.entity';
import { GenteCodigoAjuda } from './entities/gente-codigo-ajuda.entity';
import { GenteColaboradorCodigo } from './entities/gente-colaborador-codigo.entity';
import { GenteColaboradorLocal } from './entities/gente-colaborador-local.entity';
import { GenteFolgaSolicitacao } from './entities/gente-folga-solicitacao.entity';
import { GenteTrabalhoExterno } from './entities/gente-trabalho-externo.entity';
import { GenteColaboradorDocumento } from './entities/gente-colaborador-documento.entity';
import { GenteFeriado } from './entities/gente-feriado.entity';
import { MovimentacaoFinanceira } from '../financeiro/entities/movimentacao-financeira.entity';

const PONTO_TOKEN = 'itp-ponto-2026';

function calcDistancia(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

@Injectable()
export class GenteService {
  constructor(
    @InjectRepository(GenteColaborador) private colaboradorRepo: Repository<GenteColaborador>,
    @InjectRepository(GentePonto) private pontoRepo: Repository<GentePonto>,
    @InjectRepository(GenteRecibo) private reciboRepo: Repository<GenteRecibo>,
    @InjectRepository(GenteVale) private valeRepo: Repository<GenteVale>,
    @InjectRepository(GenteAdvertencia) private advertenciaRepo: Repository<GenteAdvertencia>,
    @InjectRepository(GenteSuspensao) private suspensaoRepo: Repository<GenteSuspensao>,
    @InjectRepository(GenteFalta) private faltaRepo: Repository<GenteFalta>,
    @InjectRepository(GenteCodigoAjuda) private codigoRepo: Repository<GenteCodigoAjuda>,
    @InjectRepository(GenteColaboradorCodigo) private colCodigoRepo: Repository<GenteColaboradorCodigo>,
    @InjectRepository(GenteColaboradorLocal) private localRepo: Repository<GenteColaboradorLocal>,
    @InjectRepository(GenteFolgaSolicitacao) private folgaRepo: Repository<GenteFolgaSolicitacao>,
    @InjectRepository(GenteTrabalhoExterno) private trabalhoExternoRepo: Repository<GenteTrabalhoExterno>,
    @InjectRepository(GenteColaboradorDocumento) private documentoRepo: Repository<GenteColaboradorDocumento>,
    @InjectRepository(GenteFeriado) private feriadoRepo: Repository<GenteFeriado>,
    @InjectRepository(MovimentacaoFinanceira) private movimentacaoRepo: Repository<MovimentacaoFinanceira>,
    private dataSource: DataSource,
  ) {}

  async onModuleInit() {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS gente_colaborador_documentos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        colaborador_id UUID NOT NULL,
        nome TEXT NOT NULL,
        url TEXT,
        vencimento DATE,
        observacao TEXT,
        criado_por_id TEXT,
        criado_por_nome TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      ALTER TABLE gente_colaborador_documentos ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'pessoal';
      ALTER TABLE gente_vales ADD COLUMN IF NOT EXISTS ficha_url TEXT;
      CREATE TABLE IF NOT EXISTS gente_feriados (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data DATE NOT NULL UNIQUE,
        descricao TEXT NOT NULL,
        tipo TEXT NOT NULL DEFAULT 'institucional',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  }

  // ── Feriados ──────────────────────────────────────────────────────────────

  async listarFeriados(ano?: number) {
    const rows = await this.feriadoRepo.find({ order: { data: 'ASC' } });
    if (!ano) return rows;
    return rows.filter(f => f.data.startsWith(String(ano)));
  }

  async criarFeriado(dto: { data: string; descricao: string; tipo?: string }) {
    const existing = await this.feriadoRepo.findOneBy({ data: dto.data });
    if (existing) {
      await this.feriadoRepo.update(existing.id, { descricao: dto.descricao, tipo: dto.tipo ?? 'institucional' });
      return this.feriadoRepo.findOneBy({ id: existing.id });
    }
    return this.feriadoRepo.save(this.feriadoRepo.create({ ...dto, tipo: dto.tipo ?? 'institucional' }));
  }

  async deletarFeriado(id: string) { await this.feriadoRepo.delete(id); return { ok: true }; }

  /** Retorna Set de datas (YYYY-MM-DD) de feriados no intervalo [inicioISO, fimISO] */
  private async _feriadosNoIntervalo(inicioISO: string, fimISO: string): Promise<Set<string>> {
    const rows: Array<{ data: string }> = await this.dataSource.query(
      `SELECT data::text FROM gente_feriados WHERE data >= $1::date AND data <= $2::date`,
      [inicioISO, fimISO],
    );
    return new Set(rows.map(r => String(r.data).slice(0, 10)));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async enrichColaborador(col: GenteColaborador) {
    const [func] = await this.dataSource.query(
      `SELECT id, nome, cargo, email, cpf, celular, rg, orgao_emissor_rg,
              TO_CHAR(data_emissao_rg, 'YYYY-MM-DD') AS data_emissao_rg,
              estado_civil, pais,
              TO_CHAR(data_nascimento, 'YYYY-MM-DD') AS data_nascimento,
              cep, logradouro, numero_residencia,
              complemento, bairro, cidade, estado, telefone_emergencia_1, telefone_emergencia_2,
              sexo, raca_cor, escolaridade,
              possui_deficiencia, deficiencia_descricao,
              possui_alergias, alergias_descricao,
              usa_medicamentos, medicamentos_descricao,
              possui_plano_saude, plano_saude, numero_sus,
              interesse_cursos, genero,
              pertence_comunidade_tradicional, comunidade_tradicional,
              possui_cad_unico, baixo_idh,
              matricula, ativo, foto FROM funcionarios WHERE id = $1`,
      [col.funcionario_id],
    );
    return { ...col, funcionario: func ?? null };
  }

  // ── Colaboradores ──────────────────────────────────────────────────────────

  async listarColaboradores() {
    const colaboradores = await this.colaboradorRepo.find({ where: { ativo: true }, order: { createdAt: 'DESC' } });
    if (!colaboradores.length) return [];
    const ids = colaboradores.map(c => c.funcionario_id);
    const funcionarios: any[] = await this.dataSource.query(
      `SELECT id, nome, cargo, email, cpf, celular, rg, orgao_emissor_rg,
              TO_CHAR(data_emissao_rg, 'YYYY-MM-DD') AS data_emissao_rg,
              estado_civil, pais,
              TO_CHAR(data_nascimento, 'YYYY-MM-DD') AS data_nascimento,
              cep, logradouro, numero_residencia,
              complemento, bairro, cidade, estado, telefone_emergencia_1, telefone_emergencia_2,
              sexo, raca_cor, escolaridade,
              possui_deficiencia, deficiencia_descricao,
              possui_alergias, alergias_descricao,
              usa_medicamentos, medicamentos_descricao,
              possui_plano_saude, plano_saude, numero_sus,
              interesse_cursos, genero,
              pertence_comunidade_tradicional, comunidade_tradicional,
              possui_cad_unico, baixo_idh,
              matricula, ativo, foto FROM funcionarios WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    const funcMap: Record<string, any> = {};
    funcionarios.forEach(f => (funcMap[f.id] = f));
    return colaboradores.map(c => ({ ...c, funcionario: funcMap[c.funcionario_id] ?? null }));
  }

  async buscarColaborador(id: string) {
    const col = await this.colaboradorRepo.findOne({ where: { id } });
    if (!col) throw new NotFoundException('Colaborador não encontrado.');
    return this.enrichColaborador(col);
  }

  async criarColaborador(dto: any) {
    const existe = await this.colaboradorRepo.findOne({ where: { funcionario_id: dto.funcionario_id } });
    if (existe) throw new BadRequestException('Este funcionário já está cadastrado no módulo Gente.');
    const col = this.colaboradorRepo.create(dto);
    return this.colaboradorRepo.save(col);
  }

  /** Cria funcionário + colaborador em um único passo (sem precisar ir ao Cadastro Básico) */
  async criarFuncionarioEColaborador(funcDto: any, colDto: any, criadoPorId: string) {
    let func: any;

    // 1. Se CPF fornecido, verifica se já existe para reutilizar em vez de duplicar
    if (funcDto.cpf) {
      const cpfNorm = String(funcDto.cpf).replace(/\D/g, '');
      const [existente] = await this.dataSource.query(
        `SELECT id, nome, cargo, matricula FROM funcionarios
         WHERE REGEXP_REPLACE(cpf, '[^0-9]', '', 'g') = $1 LIMIT 1`,
        [cpfNorm],
      );
      if (existente) {
        // Verifica se já tem colaborador
        const jaCol = await this.colaboradorRepo.findOne({ where: { funcionario_id: existente.id } });
        if (jaCol) throw new BadRequestException(`${existente.nome} já está cadastrado no módulo Gente (CPF duplicado).`);
        func = existente;
      }
    }

    // 2. Cria funcionário se não encontrou pelo CPF
    if (!func) {
      const now = new Date();
      const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const rows: any[] = await this.dataSource.query(
        `SELECT COUNT(*) as total FROM funcionarios WHERE matricula LIKE $1`,
        [`ITP-FUNC-${yyyymm}-%`],
      );
      const seq = String(Number(rows[0]?.total ?? 0) + 1).padStart(3, '0');
      const matricula = `ITP-FUNC-${yyyymm}-${seq}`;

      const [inserted] = await this.dataSource.query(
        `INSERT INTO funcionarios (
          nome, cargo, email, cpf, celular, data_nascimento, sexo, genero, raca_cor, escolaridade,
          cep, logradouro, numero_residencia, complemento, bairro, cidade, estado, pais,
          estado_civil, rg, orgao_emissor_rg, data_emissao_rg,
          telefone_emergencia_1, telefone_emergencia_2,
          possui_deficiencia, deficiencia_descricao,
          possui_alergias, alergias_descricao,
          usa_medicamentos, medicamentos_descricao,
          possui_plano_saude, plano_saude, numero_sus,
          interesse_cursos, pertence_comunidade_tradicional, comunidade_tradicional,
          possui_cad_unico, baixo_idh,
          matricula, ativo
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
          $19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,true
        ) RETURNING id, nome, cargo, matricula`,
        [
          funcDto.nome, funcDto.cargo || null, funcDto.email || null, funcDto.cpf || null,
          funcDto.celular || null, funcDto.data_nascimento || null, funcDto.sexo || null,
          funcDto.genero || null, funcDto.raca_cor || null, funcDto.escolaridade || null,
          funcDto.cep || null, funcDto.logradouro || null, funcDto.numero_residencia || null,
          funcDto.complemento || null, funcDto.bairro || null, funcDto.cidade || null,
          funcDto.estado || null, funcDto.pais || 'Brasil',
          funcDto.estado_civil || null, funcDto.rg || null,
          funcDto.orgao_emissor_rg || null, funcDto.data_emissao_rg || null,
          funcDto.telefone_emergencia_1 || null, funcDto.telefone_emergencia_2 || null,
          funcDto.possui_deficiencia ?? false, funcDto.deficiencia_descricao || null,
          funcDto.possui_alergias ?? false, funcDto.alergias_descricao || null,
          funcDto.usa_medicamentos ?? false, funcDto.medicamentos_descricao || null,
          funcDto.possui_plano_saude ?? false, funcDto.plano_saude || null, funcDto.numero_sus || null,
          funcDto.interesse_cursos ?? false, funcDto.pertence_comunidade_tradicional ?? false,
          funcDto.comunidade_tradicional || null,
          funcDto.possui_cad_unico ?? false, funcDto.baixo_idh ?? false,
          matricula,
        ],
      );
      func = inserted;
    }

    // 3. Cria colaborador vinculado
    const col = this.colaboradorRepo.create({
      funcionario_id: func.id,
      tipo: colDto.tipo ?? 'voluntario',
      horario_entrada: colDto.horario_entrada ?? '08:00',
      horario_saida: colDto.horario_saida ?? '17:00',
      dias_trabalho: colDto.dias_trabalho ?? ['seg', 'ter', 'qua', 'qui', 'sex'],
      raio_metros: colDto.raio_metros ?? 100,
      latitude_permitida: colDto.latitude_permitida ?? -22.8597901,
      longitude_permitida: colDto.longitude_permitida ?? -43.3308139,
      jornada_flexivel: colDto.jornada_flexivel ?? false,
      horas_dia_flex: colDto.horas_dia_flex ?? null,
      horario_flexivel_semana: colDto.horario_flexivel_semana ?? null,
    });
    const saved = await this.colaboradorRepo.save(col);
    return { ...saved, funcionario: func };
  }

  async editarColaborador(id: string, dto: any) {
    const colunas = ['tipo','horario_entrada','horario_saida','dias_trabalho',
      'latitude_permitida','longitude_permitida','raio_metros','ativo',
      'jornada_flexivel','horas_dia_flex','horario_flexivel_semana','valor_passagem'];
    const payload: any = {};
    colunas.forEach(k => { if (dto[k] !== undefined) payload[k] = dto[k]; });
    if (Object.keys(payload).length) await this.colaboradorRepo.update(id, payload);
    return this.buscarColaborador(id);
  }

  async uploadFotoColaborador(colaboradorId: string, foto: string) {
    const col = await this.colaboradorRepo.findOne({ where: { id: colaboradorId } });
    if (!col) throw new NotFoundException('Colaborador não encontrado.');
    await this.dataSource.query(`UPDATE funcionarios SET foto = $1 WHERE id = $2`, [foto, col.funcionario_id]);
    return this.buscarColaborador(colaboradorId);
  }

  async editarFuncionarioViaGente(colaboradorId: string, dto: any) {
    const col = await this.colaboradorRepo.findOne({ where: { id: colaboradorId } });
    if (!col) throw new NotFoundException('Colaborador não encontrado.');
    if (!col.funcionario_id) throw new BadRequestException('Colaborador sem funcionário vinculado — não é possível atualizar dados cadastrais.');
    const campos = ['nome','cargo','email','cpf','celular','rg','orgao_emissor_rg','data_emissao_rg',
      'estado_civil','pais','data_nascimento','cep','logradouro','numero_residencia',
      'complemento','bairro','cidade','estado','telefone_emergencia_1','telefone_emergencia_2',
      'sexo','raca_cor','escolaridade',
      'possui_deficiencia','deficiencia_descricao',
      'possui_alergias','alergias_descricao',
      'usa_medicamentos','medicamentos_descricao',
      'possui_plano_saude','plano_saude','numero_sus',
      'interesse_cursos','genero',
      'pertence_comunidade_tradicional','comunidade_tradicional',
      'possui_cad_unico','baixo_idh'];
    // Sanitiza: string vazia → null (evita erro em colunas DATE/NUMERIC)
    // Normaliza timestamps ISO → YYYY-MM-DD para colunas DATE
    const dateFields = new Set(['data_nascimento', 'data_emissao_rg']);
    const sanitizado: any = {};
    campos.forEach(c => {
      if (dto[c] === undefined) return;
      let val = dto[c] === '' ? null : dto[c];
      if (val && typeof val === 'string' && dateFields.has(c) && val.length > 10) val = val.slice(0, 10);
      sanitizado[c] = val;
    });
    const keys = Object.keys(sanitizado);
    if (!keys.length) return this.buscarColaborador(colaboradorId);
    const sets = keys.map((c, i) => `${c} = $${i + 2}`);
    const vals = keys.map(c => sanitizado[c]);
    const updated = await this.dataSource.query(
      `UPDATE funcionarios SET ${sets.join(', ')} WHERE id = $1 RETURNING id`,
      [col.funcionario_id, ...vals],
    );
    if (!updated?.length) throw new NotFoundException('Funcionário não encontrado na base de dados — dado pode ter sido excluído.');
    return this.buscarColaborador(colaboradorId);
  }

  // ── Resumo Financeiro ─────────────────────────────────────────────────────

  async resumoFinanceiro(mes: string) {
    const colaboradores = await this.colaboradorRepo.find({ where: { ativo: true } });
    const mesInicio = `${mes}-01`;
    const mesFim = new Date(Number(mes.split('-')[0]), Number(mes.split('-')[1]), 0).toISOString().split('T')[0];
    const feriadosMes = await this._feriadosNoIntervalo(mesInicio, mesFim);

    const rows = await Promise.all(colaboradores.map(async col => {
      const [func] = await this.dataSource.query(
        `SELECT id, nome, cargo, foto FROM funcionarios WHERE id = $1`, [col.funcionario_id]);
      if (!func) return null;

      const codigosCol = await this.listarCodigosColaborador(col.id);
      const totalVR = codigosCol.reduce((s, cc) => s + Number(cc.valor_efetivo ?? 0), 0);
      const totalProventos = totalVR;

      // Vales pendentes (não descontados, do mês corrente ou acumulados)
      const valesPendentes: any[] = await this.dataSource.query(
        `SELECT COALESCE(SUM(valor),0) AS total, COUNT(*) AS qtd FROM gente_vales
         WHERE colaborador_id = $1 AND descontado = false AND data <= $2`,
        [col.id, mesFim],
      );
      const totalVales = Number(valesPendentes[0]?.total ?? 0);
      const qtdVales = Number(valesPendentes[0]?.qtd ?? 0);

      // Outros descontos: advertências com valor_desconto e faltas com desconto no mês
      const advertenciasRows: any[] = await this.dataSource.query(
        `SELECT COALESCE(SUM(valor_desconto),0) AS total, COUNT(*) AS qtd
         FROM gente_advertencias
         WHERE colaborador_id = $1 AND valor_desconto > 0 AND data >= $2 AND data <= $3`,
        [col.id, mesInicio, mesFim],
      );
      const totalAdv = Number(advertenciasRows[0]?.total ?? 0);
      const qtdAdv = Number(advertenciasRows[0]?.qtd ?? 0);

      const faltasRows: any[] = await this.dataSource.query(
        `SELECT percentual_desconto FROM gente_faltas
         WHERE colaborador_id = $1 AND com_desconto = true AND tipo = 'falta' AND data >= $2 AND data <= $3`,
        [col.id, mesInicio, mesFim],
      );
      const totalFaltas = faltasRows.reduce((s, f) => {
        const pct = Number(f.percentual_desconto ?? 100) / 100;
        return s + Math.round((totalProventos / 30) * pct * 100) / 100;
      }, 0);
      const qtdFaltas = faltasRows.length;

      const suspensoesRows: any[] = await this.dataSource.query(
        `SELECT data_inicio::text, data_fim::text FROM gente_suspensoes
         WHERE colaborador_id = $1 AND com_desconto = true AND data_inicio <= $2 AND data_fim >= $3`,
        [col.id, mesFim, mesInicio],
      );
      const totalSuspensoes = suspensoesRows.reduce((s, sus) => {
        const ini = new Date(sus.data_inicio > mesInicio ? sus.data_inicio : mesInicio);
        const fim = new Date(sus.data_fim < mesFim ? sus.data_fim : mesFim);
        const dias = Math.max(0, Math.round((fim.getTime() - ini.getTime()) / 86400000) + 1);
        return s + Math.round((totalProventos / 30) * dias * 100) / 100;
      }, 0);
      const qtdSuspensoes = suspensoesRows.length;

      const totalOutrosDescontos = totalAdv + totalFaltas + totalSuspensoes;
      const qtdOutrosDescontos = qtdAdv + qtdFaltas + qtdSuspensoes;

      // Recibo do mês
      const recibo: any[] = await this.dataSource.query(
        `SELECT id, status, valor FROM gente_recibos WHERE colaborador_id = $1 AND mes_referencia = $2 LIMIT 1`,
        [col.id, mes],
      );

      return {
        colaborador_id: col.id,
        nome: func.nome,
        cargo: func.cargo,
        foto: func.foto,
        total_vr: totalVR,
        total_proventos: totalProventos,
        vales_pendentes: totalVales,
        qtd_vales_pendentes: qtdVales,
        outros_descontos: totalOutrosDescontos,
        qtd_outros_descontos: qtdOutrosDescontos,
        total_descontos: totalVales + totalOutrosDescontos,
        liquido: totalProventos - totalVales - totalOutrosDescontos,
        recibo_id: recibo[0]?.id ?? null,
        recibo_status: recibo[0]?.status ?? null,
      };
    }));

    const lista = rows.filter(Boolean);
    return {
      mes,
      colaboradores: lista,
      totais: {
        total_folha: lista.reduce((s, r) => s + r!.total_proventos, 0),
        total_vales: lista.reduce((s, r) => s + r!.vales_pendentes, 0),
        total_outros_descontos: lista.reduce((s, r) => s + r!.outros_descontos, 0),
        total_liquido: lista.reduce((s, r) => s + r!.liquido, 0),
      },
    };
  }

  async removerColaborador(id: string) {
    await this.colaboradorRepo.update(id, { ativo: false });
    return { ok: true };
  }

  async funcionariosDisponiveis() {
    const vinculados = await this.colaboradorRepo.find({ select: ['funcionario_id'] });
    const ids = vinculados.map(c => c.funcionario_id);
    if (!ids.length) {
      return this.dataSource.query(`SELECT id, nome, cargo, cpf, matricula FROM funcionarios WHERE ativo = true ORDER BY nome`);
    }
    return this.dataSource.query(
      `SELECT id, nome, cargo, cpf, matricula FROM funcionarios WHERE ativo = true AND id <> ALL($1::uuid[]) ORDER BY nome`,
      [ids],
    );
  }

  // ── Códigos de Ajuda de Custo (VRX) ──────────────────────────────────────

  async listarCodigos() {
    return this.codigoRepo.find({ order: { codigo: 'ASC' } });
  }

  async criarCodigo(dto: any) {
    // Auto-gera código VRxxx
    const ultimo: any[] = await this.dataSource.query(
      `SELECT codigo FROM gente_codigos_ajuda ORDER BY codigo DESC LIMIT 1`,
    );
    let proximo = 1;
    if (ultimo.length && ultimo[0].codigo?.match(/^VR(\d+)$/)) {
      proximo = parseInt(ultimo[0].codigo.replace('VR', ''), 10) + 1;
    }
    const codigo = `VR${String(proximo).padStart(3, '0')}`;
    return this.codigoRepo.save(this.codigoRepo.create({ ...dto, codigo }));
  }

  async editarCodigo(id: string, dto: any) {
    await this.codigoRepo.update(id, dto);
    return this.codigoRepo.findOneBy({ id });
  }

  async deletarCodigo(id: string) {
    await this.codigoRepo.delete(id);
    return { ok: true };
  }

  // ── Códigos por colaborador ───────────────────────────────────────────────

  async listarCodigosColaborador(colaborador_id: string) {
    const links = await this.colCodigoRepo.find({ where: { colaborador_id, ativo: true } });
    if (!links.length) return [];
    const codigoIds = links.map(l => l.codigo_id);
    const codigos = await this.codigoRepo.find({ where: codigoIds.map(id => ({ id })) as any });
    const codigoMap: Record<string, any> = {};
    codigos.forEach(c => (codigoMap[c.id] = c));
    return links.map(l => ({
      ...l,
      codigo: codigoMap[l.codigo_id] ?? null,
      valor_efetivo: l.valor_personalizado ?? codigoMap[l.codigo_id]?.valor_base ?? 0,
    }));
  }

  async atribuirCodigoColaborador(colaborador_id: string, codigo_id: string, valor_personalizado?: number) {
    const existente = await this.colCodigoRepo.findOne({ where: { colaborador_id, codigo_id } });
    if (existente) {
      await this.colCodigoRepo.update(existente.id, { ativo: true, valor_personalizado: valor_personalizado ?? undefined });
      return this.colCodigoRepo.findOneBy({ id: existente.id });
    }
    return this.colCodigoRepo.save(this.colCodigoRepo.create({ colaborador_id, codigo_id, valor_personalizado: valor_personalizado ?? undefined }));
  }

  async removerCodigoColaborador(id: string) {
    await this.colCodigoRepo.update(id, { ativo: false });
    return { ok: true };
  }

  // ── Cálculo de Folha ──────────────────────────────────────────────────────

  async calcularFolha(mes_referencia: string, criado_por_id: string, criado_por_nome: string) {
    // mes_referencia: YYYY-MM
    const colaboradores = await this.colaboradorRepo.find({ where: { ativo: true } });
    const resultados: any[] = [];

    for (const col of colaboradores) {
      const [func] = await this.dataSource.query(
        `SELECT id, nome, cargo, matricula FROM funcionarios WHERE id = $1`,
        [col.funcionario_id],
      );
      if (!func) continue;

      const mesRef = mes_referencia.slice(2).replace('-', '/').toUpperCase();
      const proventos: any[] = [];
      const codigosCol = await this.listarCodigosColaborador(col.id);
      codigosCol.forEach(cc => proventos.push({
        codigo: cc.codigo?.codigo ?? '',
        descricao: cc.codigo?.descricao ?? '',
        referencia: mesRef,
        valor: Number(cc.valor_efetivo),
      }));
      if (col.valor_passagem && Number(col.valor_passagem) > 0) {
        const [ano, mes] = mes_referencia.split('-').map(Number);
        const mesInicioVT = `${mes_referencia}-01`;
        const mesFimVT = new Date(ano, mes, 0).toISOString().split('T')[0];
        const feriadosMesVT = await this._feriadosNoIntervalo(mesInicioVT, mesFimVT);
        const diasTrab = this._contarDiasTrabalho(col.dias_trabalho ?? [], ano, mes, feriadosMesVT);
        const vtMensal = Number(col.valor_passagem) * diasTrab;
        if (vtMensal > 0) {
          proventos.push({ codigo: 'VT', descricao: `VALE TRANSPORTE (${diasTrab}x)`, referencia: mesRef, valor: vtMensal });
        }
      }
      const totalProventos = proventos.reduce((s, p) => s + p.valor, 0);

      // Descontos: vales não descontados do mês + advertências graves
      const mesInicio = `${mes_referencia}-01`;
      const mesFim = new Date(Number(mes_referencia.split('-')[0]), Number(mes_referencia.split('-')[1]), 0)
        .toISOString().split('T')[0];

      // Resetar vales do recibo anterior ao regenerar
      const recAnterior = await this.reciboRepo.findOne({ where: { colaborador_id: col.id, mes_referencia } });
      if (recAnterior?.observacao) {
        try {
          const obs = JSON.parse(recAnterior.observacao);
          const valeIds: string[] = (obs.descontos ?? []).filter((d: any) => d.vale_id).map((d: any) => d.vale_id);
          for (const vid of valeIds) {
            await this.valeRepo.update(vid, { descontado: false });
          }
        } catch { /* ignorar JSON inválido */ }
      }

      // Vales pendentes até o fim do mês (inclui meses anteriores não descontados)
      const valesDoMes = await this.valeRepo
        .createQueryBuilder('v')
        .where('v.colaborador_id = :id', { id: col.id })
        .andWhere('v.descontado = false')
        .andWhere('v.data <= :fim', { fim: mesFim })
        .getMany();

      const descontos: any[] = valesDoMes.map(v => ({
        codigo: 'VALE',
        descricao: `Vale ${v.tipo.toUpperCase()}${v.descricao ? ' — ' + v.descricao : ''}`,
        referencia: mes_referencia.slice(2).replace('-', '/').toUpperCase(),
        valor: Number(v.valor),
        vale_id: v.id,
      }));

      // Advertências com valor_desconto no mês
      const advertenciasDoMes = await this.advertenciaRepo
        .createQueryBuilder('a')
        .where('a.colaborador_id = :id', { id: col.id })
        .andWhere('a.valor_desconto IS NOT NULL')
        .andWhere('a.valor_desconto > 0')
        .andWhere('a.data >= :inicio', { inicio: mesInicio })
        .andWhere('a.data <= :fim', { fim: mesFim })
        .getMany();

      for (const a of advertenciasDoMes) {
        descontos.push({
          codigo: 'ADV',
          descricao: `Advertência ${a.nivel.toUpperCase()} — ${a.motivo.substring(0, 40)}`,
          referencia: mes_referencia.slice(2).replace('-', '/').toUpperCase(),
          valor: Math.round(Number(a.valor_desconto) * 100) / 100,
        });
      }

      // Faltas com desconto no mês
      const faltasDoMes = await this.faltaRepo
        .createQueryBuilder('f')
        .where('f.colaborador_id = :id', { id: col.id })
        .andWhere('f.com_desconto = true')
        .andWhere('f.tipo = :tipo', { tipo: 'falta' })
        .andWhere('f.data >= :inicio', { inicio: mesInicio })
        .andWhere('f.data <= :fim', { fim: mesFim })
        .getMany();

      for (const f of faltasDoMes) {
        const pct = Number(f.percentual_desconto ?? 100) / 100;
        const valorDesc = Math.round((totalProventos / 30) * pct * 100) / 100;
        if (valorDesc > 0) {
          descontos.push({
            codigo: 'FALTA',
            descricao: `Falta ${f.data}${f.motivo ? ' — ' + f.motivo.substring(0, 30) : ''}`,
            referencia: mes_referencia.slice(2).replace('-', '/').toUpperCase(),
            valor: valorDesc,
          });
        }
      }

      // Suspensões com desconto que se sobrepõem ao mês
      const suspensoesDoMes = await this.suspensaoRepo
        .createQueryBuilder('s')
        .where('s.colaborador_id = :id', { id: col.id })
        .andWhere('s.com_desconto = true')
        .andWhere('s.data_inicio <= :fim', { fim: mesFim })
        .andWhere('s.data_fim >= :inicio', { inicio: mesInicio })
        .getMany();

      for (const s of suspensoesDoMes) {
        const ini = new Date(s.data_inicio > mesInicio ? s.data_inicio : mesInicio);
        const fim2 = new Date(s.data_fim < mesFim ? s.data_fim : mesFim);
        const dias = Math.max(0, Math.round((fim2.getTime() - ini.getTime()) / 86400000) + 1);
        if (dias > 0) {
          descontos.push({
            codigo: 'SUSP',
            descricao: `Suspensão ${dias}d — ${s.motivo.substring(0, 30)}`,
            referencia: mes_referencia.slice(2).replace('-', '/').toUpperCase(),
            valor: Math.round((totalProventos / 30) * dias * 100) / 100,
          });
        }
      }

      const totalDescontos = descontos.reduce((s, d) => s + d.valor, 0);
      const liquido = totalProventos - totalDescontos;

      // Marca vales como descontados e gera Entrada financeira de recuperação
      for (const v of valesDoMes) {
        await this.valeRepo.update(v.id, { descontado: true });
        try {
          const tipoLabel: Record<string, string> = {
            alimentacao: 'Alimentação', transporte: 'Transporte', adiantamento: 'Adiantamento', outro: 'Vale',
          };
          const movEntrada = await this.movimentacaoRepo.save(this.movimentacaoRepo.create({
            nome: `Recuperação ${tipoLabel[v.tipo] ?? 'Vale'} — ${func.nome}`,
            tipo_movimentacao: 'Receita',
            plano_contas: 'Funcionários 2026',
            categoria: 'Pessoal',
            forma_pagamento: 'Desconto em Folha',
            valor: Number(v.valor),
            data: mes_referencia + '-01',
            status: 'Concluído',
            descricao: `Desconto folha ${mes_referencia} — ${func.nome}`,
            usuario_nome: criado_por_nome ?? null,
          }));
          await this.valeRepo.update(v.id, { movimentacao_entrada_id: movEntrada.id });
        } catch { /* não bloqueia o cálculo */ }
      }

      // Gera recibo
      const reciboExistente = await this.reciboRepo.findOne({
        where: { colaborador_id: col.id, mes_referencia },
      });

      const reciboData = {
        colaborador_id: col.id,
        mes_referencia,
        valor: liquido,
        descricao: `Folha ${mes_referencia}`,
        status: 'pendente',
        observacao: JSON.stringify({ proventos, descontos, totalProventos, totalDescontos }),
        criado_por_id,
        criado_por_nome,
      };

      let recibo: any;
      if (reciboExistente) {
        await this.reciboRepo.update(reciboExistente.id, reciboData);
        recibo = { ...reciboExistente, ...reciboData };
      } else {
        recibo = await this.reciboRepo.save(this.reciboRepo.create(reciboData));
      }

      resultados.push({
        colaborador_id: col.id,
        funcionario_nome: func.nome,
        funcionario_cargo: func.cargo,
        matricula: func.matricula,
        proventos,
        descontos,
        totalProventos,
        totalDescontos,
        liquido,
        recibo_id: recibo.id,
      });
    }

    return { mes_referencia, total_colaboradores: resultados.length, resultados };
  }

  private _contarDiasTrabalho(diasSemana: string[], ano: number, mes: number, feriados: Set<string> = new Set()): number {
    const mapa: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };
    const alvos = new Set((diasSemana ?? []).map(d => mapa[d]).filter(n => n !== undefined));
    const totalDias = new Date(ano, mes, 0).getDate();
    let count = 0;
    for (let d = 1; d <= totalDias; d++) {
      const date = new Date(ano, mes - 1, d);
      const iso = `${ano}-${String(mes).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      if (alvos.has(date.getDay()) && !feriados.has(iso)) count++;
    }
    return count;
  }

  private async _computarFolhaColaborador(col: any, mes_referencia: string) {
    const [func] = await this.dataSource.query(
      `SELECT id, nome, cargo, matricula FROM funcionarios WHERE id = $1`,
      [col.funcionario_id],
    );
    if (!func) return null;

    const mesRef = mes_referencia.slice(2).replace('-', '/').toUpperCase();
    const proventos: any[] = [];
    const codigosCol = await this.listarCodigosColaborador(col.id);
    codigosCol.forEach(cc => proventos.push({
      codigo: cc.codigo?.codigo ?? '',
      descricao: cc.codigo?.descricao ?? '',
      referencia: mesRef,
      valor: Number(cc.valor_efetivo),
    }));
    const mesInicio = `${mes_referencia}-01`;
    const mesFim = new Date(Number(mes_referencia.split('-')[0]), Number(mes_referencia.split('-')[1]), 0)
      .toISOString().split('T')[0];

    // Vales pendentes até o fim do mês (inclui meses anteriores não descontados)
    const valesDoMes = await this.valeRepo
      .createQueryBuilder('v')
      .where('v.colaborador_id = :id', { id: col.id })
      .andWhere('v.descontado = false')
      .andWhere('v.data <= :fim', { fim: mesFim })
      .getMany();

    const descontos: any[] = valesDoMes.map(v => ({
      codigo: 'VALE',
      descricao: `Vale ${v.tipo.toUpperCase()}${v.descricao ? ' — ' + v.descricao : ''}`,
      referencia: mesRef,
      valor: Number(v.valor),
      vale_id: v.id,
    }));

    // Advertências com valor_desconto no mês
    const advertenciasDoMes = await this.advertenciaRepo
      .createQueryBuilder('a')
      .where('a.colaborador_id = :id', { id: col.id })
      .andWhere('a.valor_desconto IS NOT NULL')
      .andWhere('a.valor_desconto > 0')
      .andWhere('a.data >= :inicio', { inicio: mesInicio })
      .andWhere('a.data <= :fim', { fim: mesFim })
      .getMany();

    for (const a of advertenciasDoMes) {
      descontos.push({
        codigo: 'ADV',
        descricao: `Advertência ${a.nivel.toUpperCase()} — ${a.motivo.substring(0, 40)}`,
        referencia: mesRef,
        valor: Math.round(Number(a.valor_desconto) * 100) / 100,
      });
    }

    const totalProventos = proventos.reduce((s, p) => s + p.valor, 0);

    // Faltas com desconto no mês (calculado sobre totalProventos / 30 por dia)
    const faltasDoMes = await this.faltaRepo
      .createQueryBuilder('f')
      .where('f.colaborador_id = :id', { id: col.id })
      .andWhere('f.com_desconto = true')
      .andWhere('f.tipo = :tipo', { tipo: 'falta' })
      .andWhere('f.data >= :inicio', { inicio: mesInicio })
      .andWhere('f.data <= :fim', { fim: mesFim })
      .getMany();

    for (const f of faltasDoMes) {
      const pct = Number(f.percentual_desconto ?? 100) / 100;
      const valorDesc = Math.round((totalProventos / 30) * pct * 100) / 100;
      if (valorDesc > 0) {
        descontos.push({
          codigo: 'FALTA',
          descricao: `Falta ${f.data}${f.motivo ? ' — ' + f.motivo.substring(0, 30) : ''}`,
          referencia: mesRef,
          valor: valorDesc,
        });
      }
    }

    // Suspensões com desconto que se sobrepõem ao mês
    const suspensoesDoMes = await this.suspensaoRepo
      .createQueryBuilder('s')
      .where('s.colaborador_id = :id', { id: col.id })
      .andWhere('s.com_desconto = true')
      .andWhere('s.data_inicio <= :fim', { fim: mesFim })
      .andWhere('s.data_fim >= :inicio', { inicio: mesInicio })
      .getMany();

    for (const s of suspensoesDoMes) {
      const ini = new Date(s.data_inicio > mesInicio ? s.data_inicio : mesInicio);
      const fim = new Date(s.data_fim < mesFim ? s.data_fim : mesFim);
      const dias = Math.max(0, Math.round((fim.getTime() - ini.getTime()) / 86400000) + 1);
      if (dias > 0) {
        const valorDesc = Math.round((totalProventos / 30) * dias * 100) / 100;
        descontos.push({
          codigo: 'SUSP',
          descricao: `Suspensão ${dias}d — ${s.motivo.substring(0, 30)}`,
          referencia: mesRef,
          valor: valorDesc,
        });
      }
    }

    const totalDescontos = descontos.reduce((s, d) => s + d.valor, 0);
    const liquido = totalProventos - totalDescontos;

    return { col, func, proventos, descontos, valesDoMes, totalProventos, totalDescontos, liquido, mesRef };
  }

  async previewFolhaColaborador(colaborador_id: string, mes_referencia: string) {
    const col = await this.colaboradorRepo.findOne({ where: { id: colaborador_id, ativo: true } });
    if (!col) throw new NotFoundException('Colaborador não encontrado.');
    const r = await this._computarFolhaColaborador(col, mes_referencia);
    if (!r) throw new NotFoundException('Funcionário não encontrado.');
    const reciboExistente = await this.reciboRepo.findOne({ where: { colaborador_id, mes_referencia } });
    return {
      colaborador_id,
      mes_referencia,
      funcionario: { nome: r.func.nome, cargo: r.func.cargo, matricula: r.func.matricula },
      proventos: r.proventos,
      descontos: r.descontos,
      totalProventos: r.totalProventos,
      totalDescontos: r.totalDescontos,
      liquido: r.liquido,
      recibo_existente: reciboExistente ? { id: reciboExistente.id, status: reciboExistente.status } : null,
    };
  }

  async calcularFolhaColaborador(colaborador_id: string, mes_referencia: string, criado_por_id: string, criado_por_nome: string) {
    const col = await this.colaboradorRepo.findOne({ where: { id: colaborador_id, ativo: true } });
    if (!col) throw new NotFoundException('Colaborador não encontrado.');

    // Ao regenerar, resetar vales do recibo anterior para que sejam re-incluídos
    const reciboAnterior = await this.reciboRepo.findOne({ where: { colaborador_id, mes_referencia } });
    if (reciboAnterior?.observacao) {
      try {
        const obs = JSON.parse(reciboAnterior.observacao);
        const valeIds: string[] = (obs.descontos ?? []).filter((d: any) => d.vale_id).map((d: any) => d.vale_id);
        for (const vid of valeIds) {
          await this.valeRepo.update(vid, { descontado: false });
        }
      } catch { /* ignorar JSON inválido */ }
    }

    const r = await this._computarFolhaColaborador(col, mes_referencia);
    if (!r) throw new NotFoundException('Funcionário não encontrado.');

    for (const v of r.valesDoMes) {
      await this.valeRepo.update(v.id, { descontado: true });
      try {
        const tipoLabel: Record<string, string> = {
          alimentacao: 'Alimentação', transporte: 'Transporte', adiantamento: 'Adiantamento', outro: 'Vale',
        };
        const movEntrada = await this.movimentacaoRepo.save(this.movimentacaoRepo.create({
          nome: `Recuperação ${tipoLabel[v.tipo] ?? 'Vale'} — ${r.func.nome}`,
          tipo_movimentacao: 'Receita',
          plano_contas: 'Funcionários 2026',
          categoria: 'Pessoal',
          forma_pagamento: 'Desconto em Folha',
          valor: Number(v.valor),
          data: mes_referencia + '-01',
          status: 'Concluído',
          descricao: `Desconto folha ${mes_referencia} — ${r.func.nome}`,
          usuario_nome: criado_por_nome ?? null,
        }));
        await this.valeRepo.update(v.id, { movimentacao_entrada_id: movEntrada.id });
      } catch { /* não bloqueia o cálculo */ }
    }

    const reciboExistente = await this.reciboRepo.findOne({ where: { colaborador_id, mes_referencia } });
    const reciboData = {
      colaborador_id,
      mes_referencia,
      valor: r.liquido,
      descricao: `Folha ${mes_referencia}`,
      status: 'pendente',
      observacao: JSON.stringify({ proventos: r.proventos, descontos: r.descontos, totalProventos: r.totalProventos, totalDescontos: r.totalDescontos }),
      criado_por_id,
      criado_por_nome,
    };

    let recibo: any;
    if (reciboExistente) {
      await this.reciboRepo.update(reciboExistente.id, reciboData);
      recibo = { ...reciboExistente, ...reciboData };
    } else {
      recibo = await this.reciboRepo.save(this.reciboRepo.create(reciboData));
    }

    return {
      funcionario_nome: r.func.nome,
      proventos: r.proventos,
      descontos: r.descontos,
      totalProventos: r.totalProventos,
      totalDescontos: r.totalDescontos,
      liquido: r.liquido,
      recibo_id: recibo.id,
    };
  }

  async buscarReciboCompleto(recibo_id: string) {
    const recibo = await this.reciboRepo.findOneBy({ id: recibo_id });
    if (!recibo) throw new NotFoundException('Recibo não encontrado.');
    const col = await this.colaboradorRepo.findOneBy({ id: recibo.colaborador_id });
    const [func] = col
      ? await this.dataSource.query(
          `SELECT id, nome, cargo, matricula, cpf, foto FROM funcionarios WHERE id = $1`,
          [col.funcionario_id],
        )
      : [null];

    let detalhes: any = {};
    try { detalhes = JSON.parse(recibo.observacao ?? '{}'); } catch {}

    // Gera número de código do colaborador (baseado na sequência da matrícula)
    const codigoNum = func?.matricula?.split('-').pop()?.padStart(5, '0') ?? '00001';

    return {
      ...recibo,
      colaborador: col,
      funcionario: func,
      codigo_colaborador: codigoNum,
      ...detalhes,
    };
  }

  // ── Ponto ─────────────────────────────────────────────────────────────────

  async listarPonto(colaborador_id?: string, data_inicio?: string, data_fim?: string) {
    let qb = this.pontoRepo.createQueryBuilder('p').orderBy('p.data_hora', 'DESC');
    if (colaborador_id) qb = qb.andWhere('p.colaborador_id = :colaborador_id', { colaborador_id });
    if (data_inicio) qb = qb.andWhere('p.data_hora >= :data_inicio', { data_inicio });
    if (data_fim) qb = qb.andWhere('p.data_hora <= :data_fim', { data_fim: data_fim + 'T23:59:59' });
    const registros = await qb.limit(500).getMany();

    const colIds = [...new Set(registros.map(r => r.colaborador_id))];
    if (!colIds.length) return [];
    const colaboradores = await this.colaboradorRepo.find({ where: colIds.map(id => ({ id })) as any });
    const funcIds = colaboradores.map(c => c.funcionario_id);
    const funcionarios: any[] = funcIds.length
      ? await this.dataSource.query(`SELECT id, nome, matricula FROM funcionarios WHERE id = ANY($1::uuid[])`, [funcIds])
      : [];
    const funcMap: Record<string, string> = {};
    funcionarios.forEach(f => (funcMap[f.id] = f.nome));
    const colMap: Record<string, string> = {};
    colaboradores.forEach(c => (colMap[c.id] = funcMap[c.funcionario_id] ?? ''));
    return registros.map(r => ({ ...r, colaborador_nome: colMap[r.colaborador_id] ?? '' }));
  }

  async registrarPonto(dto: any, registrado_por = 'gestor') {
    let distancia_metros: number | null = null;
    let dentro_area: boolean | null = null;
    if (dto.latitude && dto.longitude) {
      const col = await this.colaboradorRepo.findOne({ where: { id: dto.colaborador_id } });
      if (col) {
        // Trabalho externo autorizado para hoje → ignora geofence
        const hoje = new Date().toISOString().split('T')[0];
        const externo = await this.trabalhoExternoRepo.findOne({
          where: { colaborador_id: col.id, data: hoje, ativo: true },
        });
        if (externo) {
          dentro_area = true;
          distancia_metros = 0;
        } else {
          const locais = await this.localRepo.find({ where: { colaborador_id: col.id } });
          if (locais.length > 0) {
            let menorDist = Infinity;
            for (const local of locais) {
              const dist = Math.round(calcDistancia(dto.latitude, dto.longitude, Number(local.latitude), Number(local.longitude)));
              if (dist < menorDist) menorDist = dist;
              if (dist <= (local.raio_metros ?? 100)) { dentro_area = true; break; }
            }
            distancia_metros = menorDist === Infinity ? null : menorDist;
            if (dentro_area === null) dentro_area = false;
          } else if (col.latitude_permitida && col.longitude_permitida) {
            distancia_metros = Math.round(calcDistancia(dto.latitude, dto.longitude, Number(col.latitude_permitida), Number(col.longitude_permitida)));
            dentro_area = distancia_metros <= (col.raio_metros ?? 100);
          }
        }
      }
    }
    const reg = this.pontoRepo.create({ ...dto, data_hora: dto.data_hora ?? new Date(), distancia_metros, dentro_area, registrado_por });
    return this.pontoRepo.save(reg);
  }

  async registrarPontoExterno(token: string, cpf_ou_matricula: string, tipo: string, latitude?: number, longitude?: number, observacao?: string, assinatura?: string) {
    const tokens = new Set([PONTO_TOKEN, process.env.PONTO_TOKEN].filter(Boolean) as string[]);
    if (!token || !tokens.has(token)) throw new UnauthorizedException('Token inválido.');
    const [func] = await this.dataSource.query(
      `SELECT f.id as func_id, f.nome, f.cpf, f.matricula FROM funcionarios f
       WHERE REGEXP_REPLACE(f.cpf, '[^0-9]', '', 'g') = REGEXP_REPLACE($1, '[^0-9]', '', 'g')
          OR f.matricula = $1 LIMIT 1`,
      [cpf_ou_matricula],
    );
    if (!func) throw new NotFoundException('Funcionário não encontrado.');
    const col = await this.colaboradorRepo.findOne({ where: { funcionario_id: func.func_id } });
    if (!col) throw new NotFoundException('Funcionário não cadastrado no módulo Gente.');

    // ── Validação de geofence obrigatória para registros externos ─────────────
    const hoje = new Date().toISOString().split('T')[0];
    const externo = await this.trabalhoExternoRepo.findOne({ where: { colaborador_id: col.id, data: hoje, ativo: true } });

    if (!externo) {
      const locais = await this.localRepo.find({ where: { colaborador_id: col.id } });
      const temGeofence = locais.length > 0 || (col.latitude_permitida && col.longitude_permitida);

      if (temGeofence) {
        if (!latitude || !longitude) {
          throw new BadRequestException('Localização GPS é obrigatória para registrar o ponto. Verifique as permissões de localização no seu dispositivo.');
        }
        let dentroDaArea = false;
        if (locais.length > 0) {
          for (const local of locais) {
            const dist = calcDistancia(latitude, longitude, Number(local.latitude), Number(local.longitude));
            if (dist <= (local.raio_metros ?? 100)) { dentroDaArea = true; break; }
          }
        } else {
          const dist = calcDistancia(latitude, longitude, Number(col.latitude_permitida), Number(col.longitude_permitida));
          dentroDaArea = dist <= (col.raio_metros ?? 100);
        }
        if (!dentroDaArea) {
          throw new BadRequestException('Você está fora da área permitida para registrar o ponto. Verifique sua localização.');
        }
      }
    }

    return this.registrarPonto({ colaborador_id: col.id, tipo, latitude, longitude, observacao, assinatura }, 'self');
  }

  async verificarColaboradorExterno(token: string, cpf_ou_matricula: string) {
    const tokens = new Set([PONTO_TOKEN, process.env.PONTO_TOKEN].filter(Boolean) as string[]);
    if (!token || !tokens.has(token)) throw new UnauthorizedException('Token inválido.');
    const [func] = await this.dataSource.query(
      `SELECT f.id as func_id, f.nome, f.matricula, f.cargo, f.foto FROM funcionarios f
       WHERE REGEXP_REPLACE(f.cpf, '[^0-9]', '', 'g') = REGEXP_REPLACE($1, '[^0-9]', '', 'g')
          OR f.matricula = $1 LIMIT 1`,
      [cpf_ou_matricula],
    );
    if (!func) throw new NotFoundException('Funcionário não encontrado.');
    const col = await this.colaboradorRepo.findOne({ where: { funcionario_id: func.func_id } });
    if (!col) throw new NotFoundException('Funcionário não habilitado para ponto.');
    const ultimoPonto = await this.pontoRepo.findOne({ where: { colaborador_id: col.id }, order: { data_hora: 'DESC' } });
    const locais = await this.localRepo.find({ where: { colaborador_id: col.id }, order: { createdAt: 'ASC' } });
    return { colaborador_id: col.id, nome: func.nome, matricula: func.matricula, cargo: func.cargo ?? null, foto: func.foto ?? null, horario_entrada: col.horario_entrada, horario_saida: col.horario_saida, jornada_flexivel: col.jornada_flexivel ?? false, horas_dia_flex: col.horas_dia_flex ?? null, latitude_permitida: col.latitude_permitida, longitude_permitida: col.longitude_permitida, raio_metros: col.raio_metros, locais, ultimo_ponto: ultimoPonto ?? null };
  }

  async deletarPonto(id: string) { await this.pontoRepo.delete(id); return { ok: true }; }

  // ── Locais permitidos ─────────────────────────────────────────────────────

  async listarLocais(colaborador_id: string) {
    return this.localRepo.find({ where: { colaborador_id }, order: { createdAt: 'ASC' } });
  }

  async criarLocal(dto: { colaborador_id: string; nome: string; latitude: number; longitude: number; raio_metros?: number }) {
    return this.localRepo.save(this.localRepo.create(dto));
  }

  async editarLocal(id: string, dto: Partial<{ nome: string; latitude: number; longitude: number; raio_metros: number }>) {
    await this.localRepo.update(id, dto);
    return this.localRepo.findOneBy({ id });
  }

  async deletarLocal(id: string) { await this.localRepo.delete(id); return { ok: true }; }

  // ── Recibos ───────────────────────────────────────────────────────────────

  async listarRecibos(colaborador_id?: string) {
    const where: any = {};
    if (colaborador_id) where.colaborador_id = colaborador_id;
    return this.reciboRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async criarRecibo(dto: any) { return this.reciboRepo.save(this.reciboRepo.create(dto)); }
  async editarRecibo(id: string, dto: any) { await this.reciboRepo.update(id, dto); return this.reciboRepo.findOneBy({ id }); }
  async deletarRecibo(id: string) { await this.reciboRepo.delete(id); return { ok: true }; }

  // ── Vales ─────────────────────────────────────────────────────────────────

  async listarVales(colaborador_id?: string) {
    const where: any = {};
    if (colaborador_id) where.colaborador_id = colaborador_id;
    return this.valeRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async criarVale(dto: any) {
    const vale = await this.valeRepo.save(this.valeRepo.create(dto)) as unknown as import('./entities/gente-vale.entity').GenteVale;

    // Gerar movimentação de saída no financeiro
    if (dto.forma_pagamento && dto.valor) {
      try {
        const col = await this.colaboradorRepo.findOneBy({ id: dto.colaborador_id });
        let nomeColaborador = 'Colaborador';
        if (col?.funcionario_id) {
          const [func] = await this.dataSource.query(
            `SELECT nome FROM funcionarios WHERE id = $1`, [col.funcionario_id],
          );
          if (func?.nome) nomeColaborador = func.nome;
        }
        const tipoLabel: Record<string, string> = {
          alimentacao: 'Alimentação', transporte: 'Transporte', adiantamento: 'Adiantamento', outro: 'Vale',
        };
        const mov = await this.movimentacaoRepo.save(this.movimentacaoRepo.create({
          nome: `${tipoLabel[dto.tipo] ?? 'Vale'} — ${nomeColaborador}`,
          tipo_movimentacao: 'Saída',
          plano_contas: 'Funcionários 2026',
          categoria: 'Pessoal',
          forma_pagamento: dto.forma_pagamento,
          valor: Number(dto.valor),
          data: dto.data ?? new Date().toISOString().split('T')[0],
          status: 'Concluído',
          descricao: dto.descricao ? `Vale: ${dto.descricao}` : `Vale liberado para ${nomeColaborador}`,
          usuario_nome: dto.criado_por_nome ?? null,
        }));
        await this.valeRepo.update(vale.id, { movimentacao_saida_id: mov.id });
        vale.movimentacao_saida_id = mov.id;
      } catch { /* não bloqueia o vale se financeiro falhar */ }
    }

    // Auto-criar documento vinculado quando há ficha de solicitação
    if (dto.ficha_url) {
      try {
        const tipoLabelDoc: Record<string, string> = {
          alimentacao: 'Alimentação', transporte: 'Transporte', adiantamento: 'Adiantamento', outro: 'Vale',
        };
        await this.documentoRepo.save(this.documentoRepo.create({
          colaborador_id: dto.colaborador_id,
          nome: `Ficha de Vale — ${tipoLabelDoc[dto.tipo] ?? 'Vale'} · ${dto.data}`,
          url: dto.ficha_url,
          categoria: 'vale',
          criado_por_id: dto.criado_por_id,
          criado_por_nome: dto.criado_por_nome,
        }));
      } catch { /* não bloqueia o vale se documento falhar */ }
    }

    return vale;
  }
  async editarVale(id: string, dto: any) { await this.valeRepo.update(id, dto); return this.valeRepo.findOneBy({ id }); }
  async deletarVale(id: string) { await this.valeRepo.delete(id); return { ok: true }; }

  // ── Advertências ──────────────────────────────────────────────────────────

  async listarAdvertencias(colaborador_id?: string) {
    const where: any = {};
    if (colaborador_id) where.colaborador_id = colaborador_id;
    return this.advertenciaRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async criarAdvertencia(dto: any) { return this.advertenciaRepo.save(this.advertenciaRepo.create(dto)); }
  async editarAdvertencia(id: string, dto: any) { await this.advertenciaRepo.update(id, dto); return this.advertenciaRepo.findOneBy({ id }); }
  async deletarAdvertencia(id: string) { await this.advertenciaRepo.delete(id); return { ok: true }; }

  // ── Suspensões ────────────────────────────────────────────────────────────

  async listarSuspensoes(colaborador_id?: string) {
    const where: any = {};
    if (colaborador_id) where.colaborador_id = colaborador_id;
    return this.suspensaoRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async criarSuspensao(dto: any) { return this.suspensaoRepo.save(this.suspensaoRepo.create(dto)); }
  async editarSuspensao(id: string, dto: any) { await this.suspensaoRepo.update(id, dto); return this.suspensaoRepo.findOneBy({ id }); }
  async deletarSuspensao(id: string) { await this.suspensaoRepo.delete(id); return { ok: true }; }

  // ── Faltas ────────────────────────────────────────────────────────────────

  async listarFaltas(colaborador_id?: string) {
    const where: any = {};
    if (colaborador_id) where.colaborador_id = colaborador_id;
    return this.faltaRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async criarFalta(dto: any) {
    if (dto.data_fim === '' || dto.data_fim === null || dto.data_fim === undefined) {
      // Atestados/afastamentos sem data_fim explícita: cobre ao menos o dia de início
      dto.data_fim = (dto.tipo === 'atestado' || dto.tipo === 'afastamento') ? (dto.data ?? null) : null;
    }
    return this.faltaRepo.save(this.faltaRepo.create(dto));
  }
  async editarFalta(id: string, dto: any) {
    if (dto.data_fim === '' || dto.data_fim === undefined) {
      const atual = await this.faltaRepo.findOneBy({ id });
      const tipo = dto.tipo ?? atual?.tipo;
      dto.data_fim = (tipo === 'atestado' || tipo === 'afastamento') ? (dto.data ?? atual?.data ?? null) : null;
    }
    await this.faltaRepo.update(id, dto);
    return this.faltaRepo.findOneBy({ id });
  }
  async deletarFalta(id: string) { await this.faltaRepo.delete(id); return { ok: true }; }

  // ── Documentos do colaborador ─────────────────────────────────────────────

  async listarDocumentos(colaborador_id: string) {
    return this.documentoRepo.find({ where: { colaborador_id }, order: { createdAt: 'DESC' } });
  }
  async criarDocumento(dto: any) { return this.documentoRepo.save(this.documentoRepo.create(dto)); }
  async editarDocumento(id: string, dto: any) { await this.documentoRepo.update(id, dto); return this.documentoRepo.findOneBy({ id }); }
  async deletarDocumento(id: string) { await this.documentoRepo.delete(id); return { ok: true }; }

  // ── Resumo do colaborador ─────────────────────────────────────────────────

  async resumoColaborador(id: string) {
    const [recibos, vales, advertencias, suspensoes, faltas, ponto] = await Promise.all([
      this.reciboRepo.find({ where: { colaborador_id: id }, order: { createdAt: 'DESC' } }),
      this.valeRepo.find({ where: { colaborador_id: id }, order: { createdAt: 'DESC' } }),
      this.advertenciaRepo.find({ where: { colaborador_id: id }, order: { createdAt: 'DESC' } }),
      this.suspensaoRepo.find({ where: { colaborador_id: id }, order: { createdAt: 'DESC' } }),
      this.faltaRepo.find({ where: { colaborador_id: id }, order: { createdAt: 'DESC' } }),
      this.pontoRepo.find({ where: { colaborador_id: id }, order: { data_hora: 'DESC' }, take: 30 }),
    ]);
    return { recibos, vales, advertencias, suspensoes, faltas, ponto };
  }

  // ── Banco de horas ────────────────────────────────────────────────────────

  private static readonly DIAS_MAP: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };
  private static readonly DIAS_MAP_INV: Record<number, string> = { 0:'dom',1:'seg',2:'ter',3:'qua',4:'qui',5:'sex',6:'sab' };

  private calcularMinutosPorDia(col: GenteColaborador): number {
    if (col.jornada_flexivel) return col.horas_dia_flex ?? 420;
    if (!col.horario_entrada || !col.horario_saida) return 0;
    const [eh, em] = col.horario_entrada.split(':').map(Number);
    const [sh, sm] = col.horario_saida.split(':').map(Number);
    return (sh * 60 + sm) - (eh * 60 + em);
  }

  /** Soma minutos esperados no período, respeitando janela por dia para jornada flexível.
   *  Datas em datasExcluidas (YYYY-MM-DD UTC) são tratadas como dias sem obrigação de comparecimento. */
  private calcularMinutosEsperados(col: GenteColaborador, inicioMs: number, fimMs: number, datasExcluidas: Set<string> = new Set()): { minutos: number; dias: number } {
    const diasNums = (col.dias_trabalho ?? []).map(d => GenteService.DIAS_MAP[d]).filter(n => n !== undefined);
    let minutos = 0;
    let dias = 0;
    let cur = inicioMs;
    while (cur <= fimMs) {
      const date = new Date(cur);
      const dow = date.getUTCDay();
      const iso = date.toISOString().split('T')[0];
      if (diasNums.includes(dow) && !datasExcluidas.has(iso)) {
        dias++;
        if (col.jornada_flexivel) {
          const diaKey = GenteService.DIAS_MAP_INV[dow];
          const janela = col.horario_flexivel_semana?.[diaKey];
          if (janela?.inicio && janela?.fim) {
            const [ih, im] = janela.inicio.split(':').map(Number);
            const [fh, fm] = janela.fim.split(':').map(Number);
            const dur = (fh * 60 + fm) - (ih * 60 + im);
            minutos += dur > 0 ? dur : 0;
          } else {
            minutos += col.horas_dia_flex ?? 420;
          }
        } else {
          minutos += this.calcularMinutosPorDia(col);
        }
      }
      cur += 86400000;
    }
    return { minutos, dias };
  }

  private calcularMinutosTrabalhados(pontos: any[]): number {
    // Sort globally and pair entrada→saída sequentially.
    // Grouping by UTC date breaks cross-midnight sessions (BRT is UTC-3).
    const sorted = [...pontos].sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime());
    let total = 0;
    let entrada: Date | null = null;
    for (const r of sorted) {
      if (r.tipo === 'entrada') {
        entrada = new Date(r.data_hora);
      } else if (r.tipo === 'saida' && entrada) {
        const diff = (new Date(r.data_hora).getTime() - entrada.getTime()) / 60000;
        if (diff > 0 && diff < 1440) total += diff; // ignora pares inválidos (>24h)
        entrada = null;
      }
    }
    return total;
  }

  private detectarMarcacoesIncompletas(pontos: any[]): string[] {
    const sorted = [...pontos].sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime());
    const problemas: string[] = [];
    let entrada: any = null;
    for (const r of sorted) {
      const hora = new Date(r.data_hora).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
      if (r.tipo === 'entrada') {
        if (entrada) {
          problemas.push(`Entrada sem saída em ${new Date(entrada.data_hora).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}`);
        }
        entrada = r;
      } else if (r.tipo === 'saida') {
        if (!entrada) {
          problemas.push(`Saída sem entrada em ${hora}`);
        } else {
          const diff = (new Date(r.data_hora).getTime() - new Date(entrada.data_hora).getTime()) / 60000;
          if (diff <= 0) problemas.push(`Par inválido em ${hora} (duração zero ou negativa)`);
          entrada = null;
        }
      }
    }
    if (entrada) {
      problemas.push(`Entrada sem saída em ${new Date(entrada.data_hora).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}`);
    }
    return problemas;
  }

  async bancoHoras(colaborador_id: string, mes?: string) {
    const col = await this.colaboradorRepo.findOneBy({ id: colaborador_id });
    if (!col) throw new NotFoundException('Colaborador não encontrado.');
    const refMes = mes ?? new Date().toISOString().slice(0, 7);
    const [year, month] = refMes.split('-').map(Number);

    // All date arithmetic in pure UTC to avoid server timezone ambiguity
    const inicioMs = Date.UTC(year, month - 1, 1); // April 1 00:00 UTC
    const fimDoMesMs = Date.UTC(year, month, 0, 23, 59, 59, 999); // last day of month 23:59:59 UTC

    // For current month, cap at yesterday UTC (future days don't exist yet)
    const hojeUtc = new Date();
    const hojeInicioMs = Date.UTC(hojeUtc.getUTCFullYear(), hojeUtc.getUTCMonth(), hojeUtc.getUTCDate());
    const ontemMs = hojeInicioMs - 86400000; // yesterday 00:00 UTC
    const ontemFimMs = hojeInicioMs - 1;     // yesterday 23:59:59.999 UTC

    const mesAtual = new Date().toISOString().slice(0, 7) === refMes;
    const fimMs = mesAtual ? (ontemMs >= inicioMs ? ontemFimMs : inicioMs) : fimDoMesMs;

    const pontos = await this.pontoRepo.find({
      where: { colaborador_id },
      order: { data_hora: 'ASC' },
    });

    // Filter pontos for this month with 3h BRT buffer on end boundary
    const BRT_OFFSET_MS = 3 * 3600 * 1000;
    const pontosMes = pontos.filter(p => {
      const t = new Date(p.data_hora).getTime();
      return t >= inicioMs && t <= fimMs + BRT_OFFSET_MS;
    });

    // Build exclusion set: folgas não confirmadas + atestados/afastamentos não impactam esperado
    // Folgas com realizada=true: mantidas no esperado → ausência gera débito (desconta banco)
    let folgasAprovadas: any[] = [], faltasExcluidas: any[] = [];
    try {
      [folgasAprovadas, faltasExcluidas] = await Promise.all([
        this.dataSource.query(
          `SELECT data::text, realizada FROM gente_folga_solicitacoes WHERE colaborador_id = $1 AND status = 'aprovada'`,
          [colaborador_id],
        ),
        this.dataSource.query(
          `SELECT data::text, data_fim::text FROM gente_faltas WHERE colaborador_id = $1 AND tipo IN ('atestado', 'afastamento')`,
          [colaborador_id],
        ),
      ]);
    } catch { /* sem exclusões se queries falharem */ }
    const datasExcluidas = new Set<string>();
    for (const f of folgasAprovadas) {
      if (f.realizada !== true) datasExcluidas.add(String(f.data).slice(0, 10));
    }
    for (const f of faltasExcluidas) {
      const isoStart = String(f.data).slice(0, 10);
      // Atestado sem data_fim → open-ended: cobre até o fim do mês em análise
      const fimMesISO = new Date(fimMs).toISOString().split('T')[0];
      const isoEnd = f.data_fim ? String(f.data_fim).slice(0, 10) : fimMesISO;
      const start = new Date(isoStart + 'T12:00:00Z').getTime();
      const end = new Date(isoEnd + 'T12:00:00Z').getTime();
      for (let d = start; d <= end; d += 86400000) datasExcluidas.add(new Date(d).toISOString().split('T')[0]);
    }

    // Feriados no período também excluem obrigatoriedade
    const inicioRelISO = new Date(inicioMs).toISOString().split('T')[0];
    const fimRelISO = new Date(fimMs).toISOString().split('T')[0];
    const feriadosRel = await this._feriadosNoIntervalo(inicioRelISO, fimRelISO);
    feriadosRel.forEach(d => datasExcluidas.add(d));

    // Separate sets for display: atestados por dia e folgas por dia
    const atestadosDatas = new Set<string>();
    for (const f of faltasExcluidas) {
      const isoStart = String(f.data).slice(0, 10);
      const fimMesISO = new Date(fimMs).toISOString().split('T')[0];
      const isoEnd = f.data_fim ? String(f.data_fim).slice(0, 10) : fimMesISO;
      const start = new Date(isoStart + 'T12:00:00Z').getTime();
      const end = new Date(isoEnd + 'T12:00:00Z').getTime();
      for (let d = start; d <= end; d += 86400000) atestadosDatas.add(new Date(d).toISOString().split('T')[0]);
    }
    const folgasDatas = new Set<string>();
    for (const f of folgasAprovadas) {
      if (f.realizada !== true) folgasDatas.add(String(f.data).slice(0, 10));
    }

    // Sessões de ponto: agrupa entrada→saída e atribui ao dia da entrada (BRT UTC-3)
    // Garante que virada de dia (saída 00:45 do dia seguinte) fica no dia correto.
    const sortedPontos = [...pontosMes].sort((a, b) =>
      new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime()
    );
    type Sessao = { entrada: string | null; saida: string | null; trabalhado_min: number; proximo_dia: boolean };
    const sessoesByDay: Record<string, Sessao[]> = {};
    let pendEntrada: { iso: string; hora: string; ts: number } | null = null;

    const brtHora = (ts: number) => {
      const d = new Date(ts - 3 * 3600000);
      return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
    };
    const brtISO = (ts: number) => new Date(ts - 3 * 3600000).toISOString().split('T')[0];

    const addSessao = (iso: string, s: Sessao) => {
      if (!sessoesByDay[iso]) sessoesByDay[iso] = [];
      sessoesByDay[iso].push(s);
    };

    for (const p of sortedPontos) {
      const ts = new Date(p.data_hora).getTime();
      const iso = brtISO(ts);
      const hora = brtHora(ts);
      if (p.tipo === 'entrada') {
        if (pendEntrada) addSessao(pendEntrada.iso, { entrada: pendEntrada.hora, saida: null, trabalhado_min: 0, proximo_dia: false });
        pendEntrada = { iso, hora, ts };
      } else if (p.tipo === 'saida') {
        if (pendEntrada) {
          const diffMin = Math.round((ts - pendEntrada.ts) / 60000);
          addSessao(pendEntrada.iso, {
            entrada: pendEntrada.hora,
            saida: hora,
            trabalhado_min: diffMin > 0 && diffMin < 1440 ? diffMin : 0,
            proximo_dia: iso !== pendEntrada.iso,
          });
          pendEntrada = null;
        } else {
          addSessao(iso, { entrada: null, saida: hora, trabalhado_min: 0, proximo_dia: false });
        }
      }
    }
    if (pendEntrada) addSessao(pendEntrada.iso, { entrada: pendEntrada.hora, saida: null, trabalhado_min: 0, proximo_dia: false });

    const minTrabalhados = this.calcularMinutosTrabalhados(pontosMes);
    const { minutos: minEsperados, dias: diasEsperados } = this.calcularMinutosEsperados(col, inicioMs, fimMs, datasExcluidas);
    const saldoMin = minTrabalhados - minEsperados;

    // Detect incomplete pairs — extend backward 24h to catch cross-midnight entradas
    const DAY_MS = 86400000;
    const pontosMesAlargado = pontos.filter(p => {
      const t = new Date(p.data_hora).getTime();
      return t >= inicioMs - DAY_MS && t <= fimMs + BRT_OFFSET_MS;
    });
    const marcacoesIncompletas = this.detectarMarcacoesIncompletas(pontosMesAlargado);

    // Detalhamento dia a dia
    const DIAS_LABEL_NUM: Record<number, string> = { 0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb' };
    const diasNums = (col.dias_trabalho ?? []).map((d: string) => GenteService.DIAS_MAP[d]).filter((n: number | undefined) => n !== undefined) as number[];

    const dias: any[] = [];
    let cur = inicioMs;
    while (cur <= fimMs) {
      const date = new Date(cur);
      const iso = date.toISOString().split('T')[0];
      const dow = date.getUTCDay();
      const isDiaTrabalho = diasNums.includes(dow);

      let esperadoMin = 0;
      if (isDiaTrabalho && !datasExcluidas.has(iso)) {
        if (col.jornada_flexivel) {
          const diaKey = GenteService.DIAS_MAP_INV[dow];
          const janela = col.horario_flexivel_semana?.[diaKey];
          if (janela?.inicio && janela?.fim) {
            const [ih, im] = janela.inicio.split(':').map(Number);
            const [fh, fm] = janela.fim.split(':').map(Number);
            esperadoMin = Math.max(0, (fh * 60 + fm) - (ih * 60 + im));
          } else {
            esperadoMin = col.horas_dia_flex ?? 420;
          }
        } else {
          esperadoMin = this.calcularMinutosPorDia(col);
        }
      }

      const sessoes = sessoesByDay[iso] ?? [];
      const trabalhadoMin = sessoes.reduce((s, se) => s + se.trabalhado_min, 0);
      const temEntradaAberta = sessoes.some(se => se.entrada && !se.saida);

      let status: string;
      if (!isDiaTrabalho) status = 'fds';
      else if (atestadosDatas.has(iso)) status = 'atestado';
      else if (folgasDatas.has(iso)) status = 'folga';
      else if (sessoes.length > 0) status = 'presente';
      else status = 'ausente';

      dias.push({
        data: iso,
        dia_semana: DIAS_LABEL_NUM[dow],
        dia_trabalho: isDiaTrabalho,
        status,
        esperado_min: esperadoMin,
        trabalhado_min: Math.round(trabalhadoMin),
        saldo_min: Math.round(trabalhadoMin - esperadoMin),
        sessoes,
        incompleto: temEntradaAberta,
      });

      cur += DAY_MS;
    }

    const fmt = (m: number) => `${m < 0 ? '-' : '+'}${String(Math.floor(Math.abs(m) / 60)).padStart(2, '0')}:${String(Math.round(Math.abs(m) % 60)).padStart(2, '0')}`;
    return {
      mes: refMes,
      trabalhado: fmt(minTrabalhados),
      esperado: fmt(minEsperados < 0 ? -minEsperados : minEsperados).replace('+', ''),
      saldo: fmt(saldoMin),
      saldo_minutos: Math.round(saldoMin),
      dias_esperados: diasEsperados,
      marcacoes_incompletas: marcacoesIncompletas,
      dias,
    };
  }

  // ── Alertas de Ausência ───────────────────────────────────────────────────

  async alertasAusencia() {
    const DIAS_MAP: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };
    const DIAS_LABEL: Record<string, string> = { dom: 'Dom', seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sáb' };

    const colaboradores = await this.colaboradorRepo.find({ where: { ativo: true } });

    // Date range: last 14 days up to yesterday UTC
    const hojeUtc = new Date();
    const hojeInicioMs = Date.UTC(hojeUtc.getUTCFullYear(), hojeUtc.getUTCMonth(), hojeUtc.getUTCDate());
    const ontemMs = hojeInicioMs - 86400000;
    const inicioMs = ontemMs - 13 * 86400000; // 14 days back from yesterday

    const inicioUTC = new Date(inicioMs);
    const fimUTC = new Date(hojeInicioMs); // exclusive upper bound (today 00:00 UTC)

    // Single query to get all ponto records in BRT for the period
    const pontosRaw: Array<{ colaborador_id: string; data_brt: string }> = await this.dataSource.query(
      `SELECT colaborador_id, (data_hora AT TIME ZONE 'America/Sao_Paulo')::date::text as data_brt
       FROM gente_ponto
       WHERE data_hora >= $1 AND data_hora < $2
       GROUP BY colaborador_id, data_brt`,
      [inicioUTC.toISOString(), fimUTC.toISOString()],
    );

    // Build lookup: colaborador_id → Set<data_brt>
    const pontoMap: Record<string, Set<string>> = {};
    for (const row of pontosRaw) {
      if (!pontoMap[row.colaborador_id]) pontoMap[row.colaborador_id] = new Set();
      pontoMap[row.colaborador_id].add(row.data_brt);
    }

    // Build exclusion maps: folgas aprovadas + atestados/afastamentos
    const inicioISO = new Date(inicioMs).toISOString().split('T')[0];
    const ontemISO = new Date(ontemMs).toISOString().split('T')[0];
    const [folgasRows, atestadosRows] = await Promise.all([
      this.dataSource.query(
        `SELECT colaborador_id, data::text FROM gente_folga_solicitacoes WHERE status = 'aprovada' AND data >= $1::date AND data <= $2::date`,
        [inicioISO, ontemISO],
      ),
      this.dataSource.query(
        `SELECT colaborador_id, data::text, data_fim::text FROM gente_faltas
         WHERE tipo IN ('atestado', 'afastamento')
           AND data <= $2::date
           AND (data_fim IS NULL OR data_fim >= $1::date)`,
        [inicioISO, ontemISO],
      ),
    ]);
    const exclusaoMap: Record<string, Set<string>> = {};
    for (const f of folgasRows) {
      if (!exclusaoMap[f.colaborador_id]) exclusaoMap[f.colaborador_id] = new Set();
      exclusaoMap[f.colaborador_id].add(String(f.data).slice(0, 10));
    }
    for (const f of atestadosRows) {
      if (!exclusaoMap[f.colaborador_id]) exclusaoMap[f.colaborador_id] = new Set();
      const isoStart = String(f.data).slice(0, 10);
      // Atestado sem data_fim → open-ended: cobre até ontem (fim da janela)
      const isoEnd = f.data_fim ? String(f.data_fim).slice(0, 10) : ontemISO;
      const start = new Date(isoStart + 'T12:00:00Z').getTime();
      const end = new Date(isoEnd + 'T12:00:00Z').getTime();
      for (let d = start; d <= end; d += 86400000) {
        const iso = new Date(d).toISOString().split('T')[0];
        if (iso >= inicioISO && iso <= ontemISO) exclusaoMap[f.colaborador_id].add(iso);
      }
    }

    // Feriados no período (excluem todo o efetivo)
    const feriadosSet = await this._feriadosNoIntervalo(inicioISO, ontemISO);

    // Collect funcionario names
    const funcIds = colaboradores.map(c => c.funcionario_id);
    const funcionarios: any[] = funcIds.length
      ? await this.dataSource.query(`SELECT id, nome FROM funcionarios WHERE id = ANY($1::uuid[])`, [funcIds])
      : [];
    const funcMap: Record<string, string> = {};
    funcionarios.forEach(f => (funcMap[f.id] = f.nome));

    const alertas: Array<{ colaborador_id: string; nome: string; dias_ausentes: string[] }> = [];

    for (const col of colaboradores) {
      if (!col.dias_trabalho || col.dias_trabalho.length === 0) continue;
      const diasNums = col.dias_trabalho.map((d: string) => DIAS_MAP[d]).filter((n: number | undefined) => n !== undefined) as number[];
      const diasNomesMap: Record<number, string> = {};
      col.dias_trabalho.forEach((d: string) => { if (DIAS_MAP[d] !== undefined) diasNomesMap[DIAS_MAP[d]] = d; });

      const presentes = pontoMap[col.id] ?? new Set<string>();
      const excluidos = exclusaoMap[col.id] ?? new Set<string>();
      const diasAusentes: string[] = [];

      // Iterate each day in the 14-day window
      let cur = inicioMs;
      while (cur <= ontemMs) {
        const date = new Date(cur);
        const dow = date.getUTCDay();
        if (diasNums.includes(dow)) {
          // Format as YYYY-MM-DD (UTC date)
          const iso = date.toISOString().split('T')[0];
          if (!presentes.has(iso) && !excluidos.has(iso) && !feriadosSet.has(iso)) {
            const diaStr = diasNomesMap[dow] ?? '';
            const [y, m, d] = iso.split('-');
            const label = `${d}/${m} (${DIAS_LABEL[diaStr] ?? diaStr})`;
            diasAusentes.push(label);
          }
        }
        cur += 86400000;
      }

      if (diasAusentes.length > 0) {
        alertas.push({
          colaborador_id: col.id,
          nome: funcMap[col.funcionario_id] ?? col.funcionario_id,
          dias_ausentes: diasAusentes,
        });
      }
    }

    return alertas;
  }

  async controlePresencaMes(mes: string): Promise<any[]> {
    const [year, month] = mes.split('-').map(Number);
    const inicioMs = Date.UTC(year, month - 1, 1);
    const fimDoMesMs = Date.UTC(year, month, 0, 23, 59, 59, 999);

    const hojeUtc = new Date();
    const hojeInicioMs = Date.UTC(hojeUtc.getUTCFullYear(), hojeUtc.getUTCMonth(), hojeUtc.getUTCDate());
    const ontemMs = hojeInicioMs - 86400000;
    const ontemFimMs = hojeInicioMs - 1;
    const mesAtual = new Date().toISOString().slice(0, 7) === mes;
    const fimMs = mesAtual ? (ontemMs >= inicioMs ? ontemFimMs : inicioMs) : fimDoMesMs;
    const inicioISO = new Date(inicioMs).toISOString().split('T')[0];
    const fimISO = new Date(fimMs).toISOString().split('T')[0];

    const colaboradores = await this.colaboradorRepo.find({ where: { ativo: true } });
    if (!colaboradores.length) return [];
    const colIds = colaboradores.map(c => c.id);
    const funcIds = colaboradores.map(c => c.funcionario_id);
    const BRT_OFFSET_MS = 3 * 3600 * 1000;

    const [pontosRaw, funcionarios, folgasRows, atestadosRows] = await Promise.all([
      this.dataSource.query(
        `SELECT colaborador_id, data_hora, tipo FROM gente_ponto
         WHERE colaborador_id = ANY($1::uuid[]) AND data_hora >= $2 AND data_hora <= $3
         ORDER BY colaborador_id, data_hora`,
        [colIds, new Date(inicioMs - BRT_OFFSET_MS).toISOString(), new Date(fimMs + BRT_OFFSET_MS).toISOString()],
      ),
      funcIds.length
        ? this.dataSource.query(`SELECT id, nome FROM funcionarios WHERE id = ANY($1::uuid[])`, [funcIds])
        : Promise.resolve([]),
      this.dataSource.query(
        `SELECT colaborador_id, data::text, realizada FROM gente_folga_solicitacoes
         WHERE colaborador_id = ANY($1::uuid[]) AND status = 'aprovada' AND data >= $2::date AND data <= $3::date`,
        [colIds, inicioISO, fimISO],
      ),
      this.dataSource.query(
        `SELECT colaborador_id, data::text, data_fim::text FROM gente_faltas
         WHERE colaborador_id = ANY($1::uuid[]) AND tipo IN ('atestado','afastamento')
           AND data <= $3::date AND (data_fim IS NULL OR data_fim >= $2::date)`,
        [colIds, inicioISO, fimISO],
      ),
    ]);

    const feriadosSet = await this._feriadosNoIntervalo(inicioISO, fimISO);

    const funcMap: Record<string, string> = {};
    for (const f of funcionarios) funcMap[f.id] = f.nome;

    const pontosMap: Record<string, any[]> = {};
    for (const p of pontosRaw) {
      if (!pontosMap[p.colaborador_id]) pontosMap[p.colaborador_id] = [];
      pontosMap[p.colaborador_id].push(p);
    }

    const folgasMap: Record<string, Set<string>> = {};
    for (const f of folgasRows) {
      if (!folgasMap[f.colaborador_id]) folgasMap[f.colaborador_id] = new Set();
      if (f.realizada !== true) folgasMap[f.colaborador_id].add(String(f.data).slice(0, 10));
    }

    const atestadosMap: Record<string, Set<string>> = {};
    for (const a of atestadosRows) {
      const cid = a.colaborador_id;
      if (!atestadosMap[cid]) atestadosMap[cid] = new Set();
      const start = new Date(String(a.data).slice(0, 10) + 'T12:00:00Z').getTime();
      const fim = new Date((a.data_fim ? String(a.data_fim).slice(0, 10) : fimISO) + 'T12:00:00Z').getTime();
      for (let d = start; d <= fim; d += 86400000) {
        const iso = new Date(d).toISOString().split('T')[0];
        if (iso >= inicioISO && iso <= fimISO) atestadosMap[cid].add(iso);
      }
    }

    const brtISO = (ts: number) => new Date(ts - BRT_OFFSET_MS).toISOString().split('T')[0];
    const fmt = (m: number) => `${m < 0 ? '-' : '+'}${String(Math.floor(Math.abs(m) / 60)).padStart(2, '0')}:${String(Math.round(Math.abs(m) % 60)).padStart(2, '0')}`;

    const resultado: any[] = [];

    for (const col of colaboradores) {
      const diasNums = (col.dias_trabalho ?? [])
        .map((d: string) => GenteService.DIAS_MAP[d])
        .filter((n: any) => n !== undefined) as number[];
      if (!diasNums.length) continue;

      const datasExcluidas = new Set<string>([
        ...(folgasMap[col.id] ?? []),
        ...(atestadosMap[col.id] ?? []),
        ...feriadosSet,
      ]);

      const colPontos = pontosMap[col.id] ?? [];
      const presencaDias = new Set<string>();
      for (const p of colPontos) presencaDias.add(brtISO(new Date(p.data_hora).getTime()));

      const { minutos: minEsperados } = this.calcularMinutosEsperados(col, inicioMs, fimMs, datasExcluidas);
      const minTrabalhados = this.calcularMinutosTrabalhados(colPontos);

      const diasAusentes: string[] = [];
      let diasPresentes = 0;
      let diasEsperados = 0;
      let cur = inicioMs;
      while (cur <= fimMs) {
        const date = new Date(cur);
        const iso = date.toISOString().split('T')[0];
        const dow = date.getUTCDay();
        if (diasNums.includes(dow) && !datasExcluidas.has(iso)) {
          diasEsperados++;
          if (presencaDias.has(iso)) diasPresentes++;
          else diasAusentes.push(iso);
        }
        cur += 86400000;
      }

      resultado.push({
        colaborador_id: col.id,
        nome: funcMap[col.funcionario_id] ?? col.funcionario_id,
        dias_presentes: diasPresentes,
        dias_esperados: diasEsperados,
        dias_ausentes: diasAusentes,
        saldo_minutos: Math.round(minTrabalhados - minEsperados),
        saldo: fmt(minTrabalhados - minEsperados),
        horas_trabalhadas: fmt(minTrabalhados),
      });
    }

    return resultado.sort((a, b) =>
      b.dias_ausentes.length - a.dias_ausentes.length || a.nome.localeCompare(b.nome),
    );
  }

  async debugAlertas() {
    const hojeUtc = new Date();
    const hojeInicioMs = Date.UTC(hojeUtc.getUTCFullYear(), hojeUtc.getUTCMonth(), hojeUtc.getUTCDate());
    const ontemMs = hojeInicioMs - 86400000;
    const inicioMs = ontemMs - 13 * 86400000;
    const inicioISO = new Date(inicioMs).toISOString().split('T')[0];
    const ontemISO = new Date(ontemMs).toISOString().split('T')[0];

    const atestados = await this.dataSource.query(
      `SELECT gf.id, gf.colaborador_id, gf.tipo, gf.data, gf.data_fim, f.nome
       FROM gente_faltas gf
       JOIN gente_colaboradores gc ON gc.id = gf.colaborador_id
       JOIN funcionarios f ON f.id = gc.funcionario_id
       WHERE gf.tipo IN ('atestado','afastamento')
         AND gf.data <= $2
         AND (gf.data_fim IS NULL OR gf.data_fim >= $1)
       ORDER BY f.nome, gf.data`,
      [inicioISO, ontemISO],
    );

    const alertas = await this.alertasAusencia();

    return { janela: { inicioISO, ontemISO }, atestados_encontrados: atestados, alertas_gerados: alertas };
  }

  // ── Relatório de Ponto ─────────────────────────────────────────────────────

  async relatorioPonto(data_inicio: string, data_fim: string) {
    const inicioUTC = new Date(data_inicio + 'T00:00:00.000Z');
    const fimUTC = new Date(data_fim + 'T23:59:59.999Z');

    const rows: any[] = await this.dataSource.query(
      `SELECT p.id, p.colaborador_id, p.tipo, p.data_hora,
              (p.data_hora AT TIME ZONE 'America/Sao_Paulo') as hora_brt,
              f.nome as funcionario_nome
       FROM gente_ponto p
       JOIN gente_colaboradores gc ON gc.id = p.colaborador_id
       JOIN funcionarios f ON f.id = gc.funcionario_id
       WHERE p.data_hora >= $1 AND p.data_hora <= $2
       ORDER BY f.nome, p.data_hora`,
      [inicioUTC.toISOString(), fimUTC.toISOString()],
    );

    // Group by colaborador_id → date (BRT) → records
    const colMap: Record<string, { colaborador_id: string; nome: string; dias: Record<string, any[]> }> = {};

    for (const row of rows) {
      if (!colMap[row.colaborador_id]) {
        colMap[row.colaborador_id] = { colaborador_id: row.colaborador_id, nome: row.funcionario_nome, dias: {} };
      }
      // hora_brt is a JS Date (PostgreSQL returns it parsed)
      const horaBrt = new Date(row.hora_brt);
      const dataBrt = `${horaBrt.getUTCFullYear()}-${String(horaBrt.getUTCMonth() + 1).padStart(2, '0')}-${String(horaBrt.getUTCDate()).padStart(2, '0')}`;
      const hora = `${String(horaBrt.getUTCHours()).padStart(2, '0')}:${String(horaBrt.getUTCMinutes()).padStart(2, '0')}`;
      if (!colMap[row.colaborador_id].dias[dataBrt]) colMap[row.colaborador_id].dias[dataBrt] = [];
      colMap[row.colaborador_id].dias[dataBrt].push({ id: row.id, tipo: row.tipo, hora });
    }

    const resultado = Object.values(colMap).map(col => {
      let totalMinutosCol = 0;
      const dias = Object.entries(col.dias)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([data, registros]) => {
          // Calculate minutos trabalhados: pair entrada→saida
          const sorted = [...registros].sort((a, b) => a.hora.localeCompare(b.hora));
          let minutos = 0;
          let entrada: string | null = null;
          for (const r of sorted) {
            if (r.tipo === 'entrada') {
              entrada = r.hora;
            } else if (r.tipo === 'saida' && entrada) {
              const [eh, em] = entrada.split(':').map(Number);
              const [sh, sm] = r.hora.split(':').map(Number);
              const diff = (sh * 60 + sm) - (eh * 60 + em);
              if (diff > 0 && diff < 1440) minutos += diff;
              entrada = null;
            }
          }
          totalMinutosCol += minutos;
          const temEntrada = sorted.some(r => r.tipo === 'entrada');
          const temSaida = sorted.some(r => r.tipo === 'saida');
          const completo = temEntrada && temSaida;
          return { data, registros: sorted.map(({ id, tipo, hora }) => ({ id, tipo, hora })), minutos_trabalhados: minutos, completo };
        });

      return { colaborador_id: col.colaborador_id, nome: col.nome, dias, total_minutos: totalMinutosCol };
    });

    return resultado;
  }

  async historicoExterno(colaborador_id: string, limite = 50) {
    const pontos = await this.pontoRepo.find({
      where: { colaborador_id },
      order: { data_hora: 'DESC' },
      take: limite,
    });
    return pontos.map(p => ({
      id: p.id,
      tipo: p.tipo,
      data_hora: p.data_hora,
      dentro_area: p.dentro_area,
      distancia_metros: p.distancia_metros,
    }));
  }

  // ── Folgas ────────────────────────────────────────────────────────────────

  private async verificarDebitoMesAnterior(colaborador_id: string): Promise<boolean> {
    const hoje = new Date();
    const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    // Regra vigente a partir de Abril/2026 — meses anteriores não bloqueiam
    if (mesAnterior < new Date(2026, 3, 1)) return false;
    const banco = await this.bancoHoras(colaborador_id, mesAnterior.toISOString().slice(0, 7));
    if (banco.saldo_minutos >= 0) return false;
    const fimMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
    const bloqueadoAte = new Date(fimMesAnterior);
    bloqueadoAte.setMonth(bloqueadoAte.getMonth() + 1);
    return hoje <= bloqueadoAte;
  }

  async solicitarFolga(colaborador_id: string, data: string) {
    const DIAS_FOLGA_PERMITIDOS = ['seg', 'qui', 'sex']; // regra global
    const DIAS_NUM: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };

    const col = await this.colaboradorRepo.findOneBy({ id: colaborador_id });
    if (!col) throw new NotFoundException('Colaborador não encontrado.');

    const dataFolga = new Date(data + 'T12:00:00');
    const agora = new Date();
    const dataMin = new Date(agora);
    dataMin.setHours(0, 0, 0, 0);
    dataMin.setDate(dataMin.getDate() + 10);
    dataFolga.setHours(0, 0, 0, 0);
    if (dataFolga < dataMin) {
      throw new BadRequestException('A folga deve ser solicitada com no mínimo 10 dias de antecedência.');
    }

    // Dia deve ser um dia de trabalho do colaborador
    const diaStr = Object.entries(DIAS_NUM).find(([, n]) => n === dataFolga.getDay())?.[0] ?? '';
    if (!(col.dias_trabalho ?? []).includes(diaStr)) throw new BadRequestException('A folga só pode ser marcada em dias de trabalho do colaborador.');

    // Dia deve ser seg, qui ou sex
    if (!DIAS_FOLGA_PERMITIDOS.includes(diaStr)) throw new BadRequestException('Folgas só podem ser solicitadas para segunda, quinta ou sexta-feira.');

    // Calcular início e fim da semana ISO da data solicitada
    const diaDaSemana = dataFolga.getDay();
    const diffLun = (diaDaSemana === 0 ? -6 : 1 - diaDaSemana);
    const segDaSemana = new Date(dataFolga);
    segDaSemana.setDate(dataFolga.getDate() + diffLun);
    segDaSemana.setHours(0, 0, 0, 0);
    const domDaSemana = new Date(segDaSemana);
    domDaSemana.setDate(segDaSemana.getDate() + 6);
    domDaSemana.setHours(23, 59, 59, 999);

    // Máximo 1 folga por funcionário na semana
    const folgasNaSemana = await this.dataSource.query(
      `SELECT id FROM gente_folga_solicitacoes WHERE colaborador_id = $1 AND data >= $2 AND data <= $3 AND status != 'negada'`,
      [colaborador_id, segDaSemana.toISOString().split('T')[0], domDaSemana.toISOString().split('T')[0]],
    );
    if (folgasNaSemana.length > 0) throw new BadRequestException('Você já possui uma folga solicitada nesta semana.');

    // Máximo 2 folgas por semana no total (todos os funcionários)
    const totalNaSemana = await this.dataSource.query(
      `SELECT id FROM gente_folga_solicitacoes WHERE data >= $1 AND data <= $2 AND status != 'negada'`,
      [segDaSemana.toISOString().split('T')[0], domDaSemana.toISOString().split('T')[0]],
    );
    if (totalNaSemana.length >= 2) throw new BadRequestException('Já existem 2 folgas aprovadas/pendentes nesta semana. Limite semanal atingido.');

    // Máximo 2 folgas por colaborador por mês
    const [yy, mm] = data.slice(0, 7).split('-').map(Number);
    const mesInicio = `${data.slice(0, 7)}-01`;
    const mesFim = new Date(yy, mm, 0).toISOString().split('T')[0];
    const folgasMes = await this.dataSource.query(
      `SELECT id FROM gente_folga_solicitacoes WHERE colaborador_id = $1 AND data >= $2 AND data <= $3 AND status != 'negada'`,
      [colaborador_id, mesInicio, mesFim],
    );
    if (folgasMes.length >= 2) throw new BadRequestException('Você já atingiu o limite de 2 folgas neste mês.');

    // Verificar débito do mês anterior
    const comDebito = await this.verificarDebitoMesAnterior(colaborador_id);
    if (comDebito) throw new BadRequestException('Você terminou o mês anterior com horas em débito e está temporariamente impedido de solicitar folgas. Procure a direção para mais informações.');

    const folga = this.folgaRepo.create({ colaborador_id, data, status: 'pendente' });
    return this.folgaRepo.save(folga);
  }

  async criarFolgaAdmin(colaborador_id: string, data: string, respondido_por: string) {
    const col = await this.colaboradorRepo.findOneBy({ id: colaborador_id });
    if (!col) throw new NotFoundException('Colaborador não encontrado.');
    const folga = this.folgaRepo.create({ colaborador_id, data, status: 'aprovada', respondido_por, respondido_em: new Date() });
    return this.folgaRepo.save(folga);
  }

  async consultarDisponibilidadeFolgas(colaborador_id: string) {
    const DIAS_FOLGA = ['seg', 'qui', 'sex'];
    const DIAS_NUM: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };
    const DIAS_LABEL: Record<string, string> = { seg: 'Segunda', ter: 'Terça', qua: 'Quarta', qui: 'Quinta', sex: 'Sexta', sab: 'Sábado', dom: 'Domingo' };

    const col = await this.colaboradorRepo.findOneBy({ id: colaborador_id });
    if (!col) throw new NotFoundException('Colaborador não encontrado.');

    const agora = new Date();
    const dataMin = new Date(agora);
    dataMin.setHours(0, 0, 0, 0);
    dataMin.setDate(dataMin.getDate() + 10);

    const datas: any[] = [];
    const cur = new Date(dataMin);

    for (let i = 0; i < 35; i++) {
      const diaStr = Object.entries(DIAS_NUM).find(([, n]) => n === cur.getDay())?.[0] ?? '';
      if (DIAS_FOLGA.includes(diaStr) && (col.dias_trabalho ?? []).includes(diaStr)) {
        const dataISO = cur.toISOString().split('T')[0];
        const diffLun = cur.getDay() === 0 ? -6 : 1 - cur.getDay();
        const seg = new Date(cur); seg.setDate(cur.getDate() + diffLun); seg.setHours(0, 0, 0, 0);
        const dom = new Date(seg); dom.setDate(seg.getDate() + 6);
        const segISO = seg.toISOString().split('T')[0];
        const domISO = dom.toISOString().split('T')[0];

        const [total, funcSemana] = await Promise.all([
          this.dataSource.query(`SELECT id FROM gente_folga_solicitacoes WHERE data >= $1 AND data <= $2 AND status != 'negada'`, [segISO, domISO]),
          this.dataSource.query(`SELECT id FROM gente_folga_solicitacoes WHERE colaborador_id = $1 AND data >= $2 AND data <= $3 AND status != 'negada'`, [colaborador_id, segISO, domISO]),
        ]);

        const semanaCheia = total.length >= 2;
        const jaTemNaSemana = funcSemana.length > 0;
        datas.push({
          data: dataISO,
          dia: DIAS_LABEL[diaStr] ?? diaStr,
          disponivel: !semanaCheia && !jaTemNaSemana,
          motivo: jaTemNaSemana ? 'Você já tem folga nesta semana' : semanaCheia ? `${total.length}/2 vagas ocupadas` : null,
          vagas_semana: Math.max(0, 2 - total.length),
        });
      }
      cur.setDate(cur.getDate() + 1);
    }

    // Folgas já marcadas no mês atual
    const mesAtualISO = agora.toISOString().slice(0, 7);
    const [yy, mm] = mesAtualISO.split('-').map(Number);
    const mesInicioISO = `${mesAtualISO}-01`;
    const mesFimISO = new Date(yy, mm, 0).toISOString().split('T')[0];
    const folgasMesAtual = await this.dataSource.query(
      `SELECT id FROM gente_folga_solicitacoes WHERE colaborador_id = $1 AND data >= $2 AND data <= $3 AND status != 'negada'`,
      [colaborador_id, mesInicioISO, mesFimISO],
    );

    return { datas, folgas_mes_atual: folgasMesAtual.length, limite_mes: 2 };
  }

  async confirmarRealizacaoFolga(id: string, realizada: boolean) {
    await this.folgaRepo.update(id, { realizada });
    return this.folgaRepo.findOneBy({ id });
  }

  async folgasPendentesConfirmacao(colaborador_id: string) {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    const ontemISO = ontem.toISOString().split('T')[0];
    return this.dataSource.query(
      `SELECT * FROM gente_folga_solicitacoes WHERE colaborador_id = $1 AND status = 'aprovada' AND data <= $2 AND realizada IS NULL ORDER BY data ASC`,
      [colaborador_id, ontemISO],
    );
  }

  async listarFolgas(colaborador_id?: string) {
    const rows = await this.dataSource.query(
      `SELECT f.*, gc.funcionario_id,
              fn.nome as funcionario_nome, fn.matricula
       FROM gente_folga_solicitacoes f
       JOIN gente_colaboradores gc ON gc.id = f.colaborador_id
       JOIN funcionarios fn ON fn.id = gc.funcionario_id
       ${colaborador_id ? 'WHERE f.colaborador_id = $1' : ''}
       ORDER BY f.data ASC`,
      colaborador_id ? [colaborador_id] : [],
    );
    return rows;
  }

  async responderFolga(id: string, status: 'aprovada' | 'negada', respondido_por: string) {
    await this.folgaRepo.update(id, { status, respondido_por, respondido_em: new Date() });
    return this.folgaRepo.findOneBy({ id });
  }

  // ── Trabalho externo ──────────────────────────────────────────────────────

  async habilitarTrabalhoExterno(colaborador_id: string, data: string, autorizado_por: string, autorizado_por_id?: string) {
    // Revogar qualquer autorização anterior para essa data
    await this.trabalhoExternoRepo.update({ colaborador_id, data }, { ativo: false });
    const reg = this.trabalhoExternoRepo.create({ colaborador_id, data, autorizado_por, autorizado_por_id, ativo: true });
    return this.trabalhoExternoRepo.save(reg);
  }

  async listarTrabalhoExterno(colaborador_id?: string) {
    const where: any = { ativo: true };
    if (colaborador_id) where.colaborador_id = colaborador_id;
    return this.trabalhoExternoRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async revogarTrabalhoExterno(id: string) {
    await this.trabalhoExternoRepo.update(id, { ativo: false });
    return { ok: true };
  }

  // ── Admin: mesclar colaborador duplicado ──────────────────────────────────

  async mesclarColaboradorDuplicado(matriculaCorreta: string): Promise<any> {
    const matriculaNorm = matriculaCorreta.trim().toUpperCase();

    // 1. Funcionário correto (pela matrícula)
    const [funcCorreto] = await this.dataSource.query(
      `SELECT id, nome, matricula FROM funcionarios WHERE UPPER(matricula) LIKE $1 LIMIT 1`,
      [`%${matriculaNorm}`],
    );
    if (!funcCorreto) throw new NotFoundException(`Nenhum funcionário encontrado com matrícula terminando em ${matriculaNorm}`);

    // 2. Colaborador correto
    const [colCorreto] = await this.dataSource.query(
      `SELECT id FROM gente_colaboradores WHERE funcionario_id = $1 LIMIT 1`,
      [funcCorreto.id],
    );
    if (!colCorreto) throw new NotFoundException(`Funcionário ${funcCorreto.nome} não possui colaborador vinculado`);

    // 3. Colaboradores duplicados (mesmo nome, funcionário diferente)
    const duplicatas = await this.dataSource.query(
      `SELECT gc.id AS col_id, f.id AS func_id, f.nome, f.matricula
       FROM gente_colaboradores gc
       JOIN funcionarios f ON f.id = gc.funcionario_id
       WHERE LOWER(f.nome) = LOWER($1)
         AND gc.id != $2`,
      [funcCorreto.nome, colCorreto.id],
    );

    if (!duplicatas.length) {
      return { ok: true, mensagem: 'Nenhuma duplicata encontrada', correto: { colaborador_id: colCorreto.id, ...funcCorreto } };
    }

    const log: string[] = [];

    for (const dup of duplicatas) {
      // Transferir pontos
      const [{ total_pontos }] = await this.dataSource.query(
        `SELECT COUNT(*) AS total_pontos FROM gente_ponto WHERE colaborador_id = $1`,
        [dup.col_id],
      );
      await this.dataSource.query(
        `UPDATE gente_ponto SET colaborador_id = $1 WHERE colaborador_id = $2`,
        [colCorreto.id, dup.col_id],
      );
      const pontos = total_pontos;

      // Transferir faltas
      await this.dataSource.query(`UPDATE gente_faltas SET colaborador_id = $1 WHERE colaborador_id = $2`, [colCorreto.id, dup.col_id]);

      // Transferir folgas
      await this.dataSource.query(`UPDATE gente_folgas_solicitacoes SET colaborador_id = $1 WHERE colaborador_id = $2`, [colCorreto.id, dup.col_id]).catch(() => {});

      // Transferir recibos
      await this.dataSource.query(`UPDATE gente_recibos SET colaborador_id = $1 WHERE colaborador_id = $2`, [colCorreto.id, dup.col_id]).catch(() => {});

      // Transferir vales
      await this.dataSource.query(`UPDATE gente_vales SET colaborador_id = $1 WHERE colaborador_id = $2`, [colCorreto.id, dup.col_id]).catch(() => {});

      // Deletar colaborador duplicado
      await this.dataSource.query(`DELETE FROM gente_colaboradores WHERE id = $1`, [dup.col_id]);

      // Deletar funcionário duplicado se não tiver usuário vinculado
      const [funcDup] = await this.dataSource.query(`SELECT usuario_id FROM funcionarios WHERE id = $1`, [dup.func_id]);
      if (!funcDup?.usuario_id) {
        await this.dataSource.query(`DELETE FROM funcionarios WHERE id = $1`, [dup.func_id]);
        log.push(`Deletado funcionário duplicado ${dup.matricula} (${dup.nome}) e colaborador. Pontos transferidos: ${pontos ?? '?'}`);
      } else {
        log.push(`Colaborador duplicado ${dup.col_id} deletado, mas funcionário ${dup.matricula} mantido (tem usuário vinculado). Pontos transferidos: ${pontos ?? '?'}`);
      }
    }

    return {
      ok: true,
      correto: { colaborador_id: colCorreto.id, funcionario_id: funcCorreto.id, nome: funcCorreto.nome, matricula: funcCorreto.matricula },
      acoes: log,
    };
  }
}
