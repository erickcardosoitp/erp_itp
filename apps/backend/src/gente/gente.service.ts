import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GenteColaborador } from './entities/gente-colaborador.entity';
import { GentePonto } from './entities/gente-ponto.entity';
import { GenteRecibo } from './entities/gente-recibo.entity';
import { GenteVale } from './entities/gente-vale.entity';
import { GenteAdvertencia } from './entities/gente-advertencia.entity';
import { GenteSuspensao } from './entities/gente-suspensao.entity';
import { GenteFalta } from './entities/gente-falta.entity';
import { DataSource } from 'typeorm';

const PONTO_TOKEN = 'itp-ponto-2026';

function calcDistancia(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
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
    private dataSource: DataSource,
  ) {}

  // ── Colaboradores ──────────────────────────────────────────────────────────

  async listarColaboradores() {
    const colaboradores = await this.colaboradorRepo.find({ order: { createdAt: 'DESC' } });
    if (!colaboradores.length) return [];

    const ids = colaboradores.map(c => c.funcionario_id);
    const funcionarios: any[] = await this.dataSource.query(
      `SELECT id, nome, cargo, email, cpf, celular, matricula, ativo FROM funcionarios WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    const funcMap: Record<string, any> = {};
    funcionarios.forEach(f => (funcMap[f.id] = f));

    return colaboradores.map(c => ({ ...c, funcionario: funcMap[c.funcionario_id] ?? null }));
  }

  async buscarColaborador(id: string) {
    const col = await this.colaboradorRepo.findOne({ where: { id } });
    if (!col) throw new NotFoundException('Colaborador não encontrado.');
    const [func] = await this.dataSource.query(
      `SELECT id, nome, cargo, email, cpf, celular, matricula, sexo, data_nascimento, ativo FROM funcionarios WHERE id = $1`,
      [col.funcionario_id],
    );
    return { ...col, funcionario: func ?? null };
  }

  async criarColaborador(dto: any) {
    const existe = await this.colaboradorRepo.findOne({ where: { funcionario_id: dto.funcionario_id } });
    if (existe) throw new Error('Este funcionário já está cadastrado no módulo Gente.');
    const col = this.colaboradorRepo.create(dto);
    return this.colaboradorRepo.save(col);
  }

  async editarColaborador(id: string, dto: any) {
    await this.colaboradorRepo.update(id, dto);
    return this.buscarColaborador(id);
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
      if (col?.latitude_permitida && col?.longitude_permitida) {
        distancia_metros = Math.round(
          calcDistancia(dto.latitude, dto.longitude, Number(col.latitude_permitida), Number(col.longitude_permitida)),
        );
        dentro_area = distancia_metros <= (col.raio_metros ?? 200);
      }
    }

    const reg = this.pontoRepo.create({
      ...dto,
      data_hora: dto.data_hora ?? new Date(),
      distancia_metros,
      dentro_area,
      registrado_por,
    });
    return this.pontoRepo.save(reg);
  }

  async registrarPontoExterno(token: string, cpf_ou_matricula: string, tipo: string, latitude?: number, longitude?: number, observacao?: string) {
    const tokens = new Set([PONTO_TOKEN, process.env.PONTO_TOKEN].filter(Boolean) as string[]);
    if (!token || !tokens.has(token)) throw new UnauthorizedException('Token inválido.');

    const [func] = await this.dataSource.query(
      `SELECT f.id as func_id, f.nome, f.cpf, f.matricula FROM funcionarios f WHERE f.cpf = $1 OR f.matricula = $1 LIMIT 1`,
      [cpf_ou_matricula],
    );
    if (!func) throw new NotFoundException('Funcionário não encontrado.');

    const col = await this.colaboradorRepo.findOne({ where: { funcionario_id: func.func_id } });
    if (!col) throw new NotFoundException('Funcionário não cadastrado no módulo Gente.');

    return this.registrarPonto(
      { colaborador_id: col.id, tipo, latitude, longitude, observacao },
      'self',
    );
  }

  async verificarColaboradorExterno(token: string, cpf_ou_matricula: string) {
    const tokens = new Set([PONTO_TOKEN, process.env.PONTO_TOKEN].filter(Boolean) as string[]);
    if (!token || !tokens.has(token)) throw new UnauthorizedException('Token inválido.');
    const [func] = await this.dataSource.query(
      `SELECT f.id as func_id, f.nome, f.matricula FROM funcionarios f WHERE f.cpf = $1 OR f.matricula = $1 LIMIT 1`,
      [cpf_ou_matricula],
    );
    if (!func) throw new NotFoundException('Funcionário não encontrado.');
    const col = await this.colaboradorRepo.findOne({ where: { funcionario_id: func.func_id } });
    if (!col) throw new NotFoundException('Funcionário não habilitado para ponto.');

    const ultimoPonto = await this.pontoRepo.findOne({
      where: { colaborador_id: col.id },
      order: { data_hora: 'DESC' },
    });

    return {
      colaborador_id: col.id,
      nome: func.nome,
      matricula: func.matricula,
      horario_entrada: col.horario_entrada,
      horario_saida: col.horario_saida,
      latitude_permitida: col.latitude_permitida,
      longitude_permitida: col.longitude_permitida,
      raio_metros: col.raio_metros,
      ultimo_ponto: ultimoPonto ?? null,
    };
  }

  async deletarPonto(id: string) {
    await this.pontoRepo.delete(id);
    return { ok: true };
  }

  // ── Recibos ───────────────────────────────────────────────────────────────

  async listarRecibos(colaborador_id?: string) {
    const where: any = {};
    if (colaborador_id) where.colaborador_id = colaborador_id;
    return this.reciboRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async criarRecibo(dto: any) {
    return this.reciboRepo.save(this.reciboRepo.create(dto));
  }

  async editarRecibo(id: string, dto: any) {
    await this.reciboRepo.update(id, dto);
    return this.reciboRepo.findOneBy({ id });
  }

  async deletarRecibo(id: string) {
    await this.reciboRepo.delete(id);
    return { ok: true };
  }

  // ── Vales ─────────────────────────────────────────────────────────────────

  async listarVales(colaborador_id?: string) {
    const where: any = {};
    if (colaborador_id) where.colaborador_id = colaborador_id;
    return this.valeRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async criarVale(dto: any) {
    return this.valeRepo.save(this.valeRepo.create(dto));
  }

  async editarVale(id: string, dto: any) {
    await this.valeRepo.update(id, dto);
    return this.valeRepo.findOneBy({ id });
  }

  async deletarVale(id: string) {
    await this.valeRepo.delete(id);
    return { ok: true };
  }

  // ── Advertências ──────────────────────────────────────────────────────────

  async listarAdvertencias(colaborador_id?: string) {
    const where: any = {};
    if (colaborador_id) where.colaborador_id = colaborador_id;
    return this.advertenciaRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async criarAdvertencia(dto: any) {
    return this.advertenciaRepo.save(this.advertenciaRepo.create(dto));
  }

  async editarAdvertencia(id: string, dto: any) {
    await this.advertenciaRepo.update(id, dto);
    return this.advertenciaRepo.findOneBy({ id });
  }

  async deletarAdvertencia(id: string) {
    await this.advertenciaRepo.delete(id);
    return { ok: true };
  }

  // ── Suspensões ────────────────────────────────────────────────────────────

  async listarSuspensoes(colaborador_id?: string) {
    const where: any = {};
    if (colaborador_id) where.colaborador_id = colaborador_id;
    return this.suspensaoRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async criarSuspensao(dto: any) {
    return this.suspensaoRepo.save(this.suspensaoRepo.create(dto));
  }

  async editarSuspensao(id: string, dto: any) {
    await this.suspensaoRepo.update(id, dto);
    return this.suspensaoRepo.findOneBy({ id });
  }

  async deletarSuspensao(id: string) {
    await this.suspensaoRepo.delete(id);
    return { ok: true };
  }

  // ── Faltas ────────────────────────────────────────────────────────────────

  async listarFaltas(colaborador_id?: string) {
    const where: any = {};
    if (colaborador_id) where.colaborador_id = colaborador_id;
    return this.faltaRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async criarFalta(dto: any) {
    return this.faltaRepo.save(this.faltaRepo.create(dto));
  }

  async editarFalta(id: string, dto: any) {
    await this.faltaRepo.update(id, dto);
    return this.faltaRepo.findOneBy({ id });
  }

  async deletarFalta(id: string) {
    await this.faltaRepo.delete(id);
    return { ok: true };
  }

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
}
