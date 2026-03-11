import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TipoMovimentacao } from './entities/tipo-movimentacao.entity';
import { PlanoContas } from './entities/plano-contas.entity';
import { CategoriaFinanceira } from './entities/categoria-financeira.entity';
import { TipoPessoa } from './entities/tipo-pessoa.entity';
import { FormaPagamento } from './entities/forma-pagamento.entity';
import { Recorrencia } from './entities/recorrencia.entity';
import { MovimentacaoFinanceira } from './entities/movimentacao-financeira.entity';

@Injectable()
export class FinanceiroService {
  constructor(
    @InjectRepository(TipoMovimentacao)       private tipoMovRepo: Repository<TipoMovimentacao>,
    @InjectRepository(PlanoContas)             private planoRepo: Repository<PlanoContas>,
    @InjectRepository(CategoriaFinanceira)     private categoriaRepo: Repository<CategoriaFinanceira>,
    @InjectRepository(TipoPessoa)              private tipoPessoaRepo: Repository<TipoPessoa>,
    @InjectRepository(FormaPagamento)          private formaPagRepo: Repository<FormaPagamento>,
    @InjectRepository(Recorrencia)             private recorrenciaRepo: Repository<Recorrencia>,
    @InjectRepository(MovimentacaoFinanceira)  private movRepo: Repository<MovimentacaoFinanceira>,
  ) {}

  // ── TIPOS DE MOVIMENTAÇÃO ─────────────────────────────────────────────────

  listarTiposMovimentacao() { return this.tipoMovRepo.find({ order: { nome: 'ASC' } }); }

  async criarTipoMovimentacao(dto: Partial<TipoMovimentacao>) {
    if (!dto.nome) throw new BadRequestException('Nome é obrigatório');
    return this.tipoMovRepo.save(this.tipoMovRepo.create(dto));
  }

  async editarTipoMovimentacao(id: string, dto: Partial<TipoMovimentacao>) {
    const e = await this.tipoMovRepo.findOneBy({ id });
    if (!e) throw new NotFoundException('Tipo de movimentação não encontrado');
    await this.tipoMovRepo.update(id, dto);
    return this.tipoMovRepo.findOneByOrFail({ id });
  }

  async deletarTipoMovimentacao(id: string) {
    const e = await this.tipoMovRepo.findOneBy({ id });
    if (!e) throw new NotFoundException('Tipo de movimentação não encontrado');
    await this.tipoMovRepo.delete(id);
    return { message: 'Tipo de movimentação removido' };
  }

  // ── PLANOS DE CONTAS ──────────────────────────────────────────────────────

  listarPlanosContas() { return this.planoRepo.find({ order: { nome: 'ASC' } }); }

  async criarPlanoContas(dto: Partial<PlanoContas>) {
    if (!dto.nome) throw new BadRequestException('Nome é obrigatório');
    return this.planoRepo.save(this.planoRepo.create(dto));
  }

  async editarPlanoContas(id: string, dto: Partial<PlanoContas>) {
    const e = await this.planoRepo.findOneBy({ id });
    if (!e) throw new NotFoundException('Plano de contas não encontrado');
    await this.planoRepo.update(id, dto);
    return this.planoRepo.findOneByOrFail({ id });
  }

  async deletarPlanoContas(id: string) {
    const e = await this.planoRepo.findOneBy({ id });
    if (!e) throw new NotFoundException('Plano de contas não encontrado');
    await this.planoRepo.delete(id);
    return { message: 'Plano de contas removido' };
  }

  // ── CATEGORIAS FINANCEIRAS ────────────────────────────────────────────────

  listarCategorias() { return this.categoriaRepo.find({ order: { nome: 'ASC' } }); }

  async criarCategoria(dto: Partial<CategoriaFinanceira>) {
    if (!dto.nome) throw new BadRequestException('Nome é obrigatório');
    return this.categoriaRepo.save(this.categoriaRepo.create(dto));
  }

  async editarCategoria(id: string, dto: Partial<CategoriaFinanceira>) {
    const e = await this.categoriaRepo.findOneBy({ id });
    if (!e) throw new NotFoundException('Categoria não encontrada');
    await this.categoriaRepo.update(id, dto);
    return this.categoriaRepo.findOneByOrFail({ id });
  }

  async deletarCategoria(id: string) {
    const e = await this.categoriaRepo.findOneBy({ id });
    if (!e) throw new NotFoundException('Categoria não encontrada');
    await this.categoriaRepo.delete(id);
    return { message: 'Categoria removida' };
  }

  // ── TIPOS DE PESSOA ───────────────────────────────────────────────────────

  listarTiposPessoa() { return this.tipoPessoaRepo.find({ order: { nome: 'ASC' } }); }

  async criarTipoPessoa(dto: Partial<TipoPessoa>) {
    if (!dto.nome) throw new BadRequestException('Nome é obrigatório');
    return this.tipoPessoaRepo.save(this.tipoPessoaRepo.create(dto));
  }

  async editarTipoPessoa(id: string, dto: Partial<TipoPessoa>) {
    const e = await this.tipoPessoaRepo.findOneBy({ id });
    if (!e) throw new NotFoundException('Tipo de pessoa não encontrado');
    await this.tipoPessoaRepo.update(id, dto);
    return this.tipoPessoaRepo.findOneByOrFail({ id });
  }

  async deletarTipoPessoa(id: string) {
    const e = await this.tipoPessoaRepo.findOneBy({ id });
    if (!e) throw new NotFoundException('Tipo de pessoa não encontrado');
    await this.tipoPessoaRepo.delete(id);
    return { message: 'Tipo de pessoa removido' };
  }

  // ── FORMAS DE PAGAMENTO ───────────────────────────────────────────────────

  listarFormasPagamento() { return this.formaPagRepo.find({ order: { nome: 'ASC' } }); }

  async criarFormaPagamento(dto: Partial<FormaPagamento>) {
    if (!dto.nome) throw new BadRequestException('Nome é obrigatório');
    return this.formaPagRepo.save(this.formaPagRepo.create(dto));
  }

  async editarFormaPagamento(id: string, dto: Partial<FormaPagamento>) {
    const e = await this.formaPagRepo.findOneBy({ id });
    if (!e) throw new NotFoundException('Forma de pagamento não encontrada');
    await this.formaPagRepo.update(id, dto);
    return this.formaPagRepo.findOneByOrFail({ id });
  }

  async deletarFormaPagamento(id: string) {
    const e = await this.formaPagRepo.findOneBy({ id });
    if (!e) throw new NotFoundException('Forma de pagamento não encontrada');
    await this.formaPagRepo.delete(id);
    return { message: 'Forma de pagamento removida' };
  }

  // ── RECORRÊNCIAS ──────────────────────────────────────────────────────────

  listarRecorrencias() { return this.recorrenciaRepo.find({ order: { nome: 'ASC' } }); }

  async criarRecorrencia(dto: Partial<Recorrencia>) {
    if (!dto.nome) throw new BadRequestException('Nome é obrigatório');
    return this.recorrenciaRepo.save(this.recorrenciaRepo.create(dto));
  }

  async editarRecorrencia(id: string, dto: Partial<Recorrencia>) {
    const e = await this.recorrenciaRepo.findOneBy({ id });
    if (!e) throw new NotFoundException('Recorrência não encontrada');
    await this.recorrenciaRepo.update(id, dto);
    return this.recorrenciaRepo.findOneByOrFail({ id });
  }

  async deletarRecorrencia(id: string) {
    const e = await this.recorrenciaRepo.findOneBy({ id });
    if (!e) throw new NotFoundException('Recorrência não encontrada');
    await this.recorrenciaRepo.delete(id);
    return { message: 'Recorrência removida' };
  }

  // ── MOVIMENTAÇÕES FINANCEIRAS ─────────────────────────────────────────────

  listarMovimentacoes() { return this.movRepo.find({ order: { data: 'DESC', created_at: 'DESC' } }); }

  listarDoacoes() {
    return this.movRepo.find({ where: { categoria: 'Doação' }, order: { data: 'DESC', created_at: 'DESC' } });
  }

  async criarMovimentacao(dto: Partial<MovimentacaoFinanceira>) {
    if (!dto.nome) throw new BadRequestException('Nome é obrigatório');
    if (!dto.valor && dto.valor !== 0) throw new BadRequestException('Valor é obrigatório');
    return this.movRepo.save(this.movRepo.create(dto));
  }

  async editarMovimentacao(id: string, dto: Partial<MovimentacaoFinanceira>) {
    const e = await this.movRepo.findOneBy({ id });
    if (!e) throw new NotFoundException('Movimentação não encontrada');
    await this.movRepo.update(id, dto);
    return this.movRepo.findOneByOrFail({ id });
  }

  async deletarMovimentacao(id: string) {
    const e = await this.movRepo.findOneBy({ id });
    if (!e) throw new NotFoundException('Movimentação não encontrada');
    await this.movRepo.delete(id);
    return { message: 'Movimentação removida' };
  }
}
