import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Projeto } from './entities/projeto.entity';
import { ProjetoEquipe } from './entities/projeto-equipe.entity';
import { ProjetoInscricao } from './entities/projeto-inscricao.entity';
import { ProjetoPresenca } from './entities/projeto-presenca.entity';
import { CreateProjetoDto } from './dto/create-projeto.dto';
import { CreateEquipeDto } from './dto/create-equipe.dto';
import { CreateInscricaoDto } from './dto/create-inscricao.dto';

@Injectable()
export class ProjetosService {
  constructor(
    @InjectRepository(Projeto)         private projetosRepo: Repository<Projeto>,
    @InjectRepository(ProjetoEquipe)   private equipesRepo: Repository<ProjetoEquipe>,
    @InjectRepository(ProjetoInscricao) private inscricoesRepo: Repository<ProjetoInscricao>,
    @InjectRepository(ProjetoPresenca) private presencasRepo: Repository<ProjetoPresenca>,
    private dataSource: DataSource,
  ) {}

  // ── Projetos ──────────────────────────────────────────────────────────────

  findAll() {
    return this.projetosRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    const p = await this.projetosRepo.findOne({
      where: { id },
      relations: ['equipes'],
    });
    if (!p) throw new NotFoundException('Projeto não encontrado');
    return p;
  }

  async create(dto: CreateProjetoDto) {
    const p = this.projetosRepo.create(dto);
    return this.projetosRepo.save(p);
  }

  async update(id: string, dto: Partial<CreateProjetoDto> & { ativo?: boolean }) {
    await this.findOne(id);
    await this.projetosRepo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.projetosRepo.delete(id);
  }

  // ── Equipes ───────────────────────────────────────────────────────────────

  findEquipes(projeto_id: string) {
    return this.equipesRepo.find({ where: { projeto_id }, order: { nome: 'ASC' } });
  }

  async createEquipe(projeto_id: string, dto: CreateEquipeDto) {
    await this.findOne(projeto_id);
    const e = this.equipesRepo.create({ ...dto, projeto_id });
    return this.equipesRepo.save(e);
  }

  async updateEquipe(projeto_id: string, id: string, dto: Partial<CreateEquipeDto>) {
    const e = await this.equipesRepo.findOne({ where: { id, projeto_id } });
    if (!e) throw new NotFoundException('Equipe não encontrada');
    await this.equipesRepo.update(id, dto);
    return this.equipesRepo.findOne({ where: { id } });
  }

  async removeEquipe(projeto_id: string, id: string) {
    const e = await this.equipesRepo.findOne({ where: { id, projeto_id } });
    if (!e) throw new NotFoundException('Equipe não encontrada');
    await this.equipesRepo.delete(id);
  }

  // ── Inscrições ────────────────────────────────────────────────────────────

  async findInscricoes(projeto_id: string) {
    const rows = await this.dataSource.query(`
      SELECT pi.*,
        row_to_json(pe) as equipe,
        a.logradouro  as aluno_logradouro,
        a.numero      as aluno_numero,
        a.bairro      as aluno_bairro,
        a.cidade      as aluno_cidade,
        foto.url_arquivo as foto_url
      FROM projeto_inscricoes pi
      LEFT JOIN projeto_equipes pe ON pe.id = pi.equipe_id
      LEFT JOIN alunos a ON a.id = pi.aluno_id
      LEFT JOIN LATERAL (
        SELECT d.url_arquivo
        FROM inscricoes insc
        JOIN documentos_inscricao d ON d.inscricao_id = insc.id AND d.tipo = 'foto_aluno'
        WHERE insc.aluno_id::text = pi.aluno_id::text
        ORDER BY d.created_at DESC
        LIMIT 1
      ) foto ON true
      WHERE pi.projeto_id = $1
      ORDER BY pi.created_at ASC
    `, [projeto_id]);
    return rows.map((r: any) => {
      const logradouro = r.logradouro || r.aluno_logradouro;
      const numero     = r.numero     || r.aluno_numero;
      const bairro     = r.aluno_bairro;
      const cidade     = r.aluno_cidade;
      return {
        ...r,
        endereco: [logradouro, numero, bairro, cidade].filter(Boolean).join(', ') || null,
      };
    });
  }

  async createInscricao(projeto_id: string, dto: CreateInscricaoDto) {
    await this.findOne(projeto_id);
    const tipo = dto.aluno_id ? 'regular' : 'externo';

    let dadosAluno: Partial<CreateInscricaoDto> = {};
    if (dto.aluno_id) {
      const aluno = await this.dataSource.query(
        `SELECT a.nome_completo, a.data_nascimento, a.nome_responsavel, a.telefone_alternativo,
                i.nome_responsavel  AS insc_nome_responsavel,
                i.telefone_responsavel AS insc_telefone_responsavel
         FROM alunos a
         LEFT JOIN inscricoes i ON i.aluno_id::text = a.id::text
         WHERE a.id = $1
         ORDER BY i.id DESC
         LIMIT 1`,
        [dto.aluno_id],
      );
      if (!aluno.length) throw new BadRequestException('Aluno não encontrado');
      const a = aluno[0];
      dadosAluno = {
        nome_completo:        a.nome_completo,
        data_nascimento:      a.data_nascimento,
        nome_responsavel:     a.nome_responsavel || a.insc_nome_responsavel || null,
        telefone_responsavel: a.telefone_alternativo || a.insc_telefone_responsavel || null,
      };
    }

    const i = this.inscricoesRepo.create({
      projeto_id,
      tipo,
      ...dadosAluno,
      ...dto,
    });
    return this.inscricoesRepo.save(i);
  }

  async updateInscricao(projeto_id: string, id: string, dto: Partial<CreateInscricaoDto> & { status?: string; convertido_em_aluno?: boolean }) {
    const i = await this.inscricoesRepo.findOne({ where: { id, projeto_id } });
    if (!i) throw new NotFoundException('Inscrição não encontrada');
    await this.inscricoesRepo.update(id, dto);
    return this.inscricoesRepo.findOne({ where: { id }, relations: ['equipe'] });
  }

  async removeInscricao(projeto_id: string, id: string) {
    const i = await this.inscricoesRepo.findOne({ where: { id, projeto_id } });
    if (!i) throw new NotFoundException('Inscrição não encontrada');
    await this.inscricoesRepo.delete(id);
  }

  // ── Presença ──────────────────────────────────────────────────────────────

  async findPresencas(projeto_id: string, data?: string, equipe_id?: string) {
    const qb = this.presencasRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.inscricao', 'i')
      .leftJoinAndSelect('p.equipe', 'e')
      .where('p.projeto_id = :projeto_id', { projeto_id });
    if (data) qb.andWhere('p.data = :data', { data });
    if (equipe_id) qb.andWhere('p.equipe_id = :equipe_id', { equipe_id });
    return qb.orderBy('i.nome_completo', 'ASC').getMany();
  }

  async upsertPresenca(projeto_id: string, inscricao_id: string, data: string, body: { presente?: boolean; hora_entrada?: string; equipe_id?: string }) {
    const inscricao = await this.inscricoesRepo.findOne({ where: { id: inscricao_id, projeto_id } });
    if (!inscricao) throw new NotFoundException('Inscrição não encontrada');

    let presenca = await this.presencasRepo.findOne({ where: { inscricao_id, data } });
    if (presenca) {
      await this.presencasRepo.update(presenca.id, body);
      return this.presencasRepo.findOne({ where: { id: presenca.id } });
    }
    presenca = this.presencasRepo.create({
      projeto_id,
      inscricao_id,
      data,
      equipe_id: inscricao.equipe_id,
      ...body,
    });
    return this.presencasRepo.save(presenca);
  }

  // ── Checkout via barcode ──────────────────────────────────────────────────

  async checkout(inscricao_id: string) {
    const inscricao = await this.inscricoesRepo.findOne({
      where: { id: inscricao_id },
      relations: ['equipe'],
    });
    if (!inscricao) throw new NotFoundException('Inscrição não encontrada');

    const hoje = new Date().toISOString().slice(0, 10);
    const presenca = await this.presencasRepo.findOne({
      where: { inscricao_id, data: hoje, presente: true },
    });

    if (!presenca) {
      throw new BadRequestException('Nenhuma presença registrada para hoje para este participante');
    }
    if (presenca.hora_saida) {
      return { ok: true, ja_registrado: true, inscricao, presenca };
    }

    const hora_saida = new Date().toTimeString().slice(0, 8);
    await this.presencasRepo.update(presenca.id, { hora_saida });

    return {
      ok: true,
      ja_registrado: false,
      inscricao,
      hora_saida,
    };
  }
}
