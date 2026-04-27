import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { TipoMovimentacao } from './entities/tipo-movimentacao.entity';
import { PlanoContas } from './entities/plano-contas.entity';
import { CategoriaFinanceira } from './entities/categoria-financeira.entity';
import { TipoPessoa } from './entities/tipo-pessoa.entity';
import { FormaPagamento } from './entities/forma-pagamento.entity';
import { Recorrencia } from './entities/recorrencia.entity';
import { MovimentacaoFinanceira } from './entities/movimentacao-financeira.entity';
import { Boleto } from './entities/boleto.entity';
import { BoletoParcela } from './entities/boleto-parcela.entity';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

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
    @InjectRepository(Boleto)                  private boletoRepo: Repository<Boleto>,
    @InjectRepository(BoletoParcela)           private parcelaRepo: Repository<BoletoParcela>,
    @InjectDataSource()                        private readonly dataSource: DataSource,
    private readonly notificacoes: NotificacoesService,
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
    const mov = await this.movRepo.save(this.movRepo.create(dto));
    // Notificações automáticas por tipo de movimentação
    const valor = Number(mov.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (mov.categoria?.toLowerCase().includes('doação') || mov.categoria?.toLowerCase() === 'doacao') {
      await this.notificacoes.criar({
        tipo: 'nova_doacao',
        titulo: `💚 Nova doação: ${valor}`,
        mensagem: `Uma nova doação de ${valor} foi registrada em nome de "${mov.nome}"${mov.data ? ` em ${mov.data}` : ''}.`,
        referencia_id: mov.id,
        referencia_tipo: 'movimentacao',
      }).catch(() => {});
    } else if (mov.forma_pagamento?.toUpperCase() === 'PIX') {
      const isEntrada = mov.tipo_movimentacao === 'Receita' || mov.tipo_movimentacao === 'Entrada';
      await this.notificacoes.criar({
        tipo: isEntrada ? 'pix_recebido' : 'pix_enviado',
        titulo: isEntrada ? `🟢 PIX recebido: ${valor}` : `🔴 PIX enviado: ${valor}`,
        mensagem: isEntrada
          ? `Um pagamento via PIX de ${valor} foi recebido (${mov.nome}).`
          : `Um pagamento via PIX de ${valor} foi enviado (${mov.nome}).`,
        referencia_id: mov.id,
        referencia_tipo: 'movimentacao',
      }).catch(() => {});
    }
    return mov;
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

  // ── BOLETOS A RECEBER ─────────────────────────────────────────────────────

  async listarBoletos() {
    const boletos = await this.boletoRepo.find({ order: { data_emissao: 'DESC', created_at: 'DESC' } });
    const parcelas = await this.parcelaRepo.find({ order: { boleto_id: 'ASC', numero_parcela: 'ASC' } });
    return boletos.map(b => ({
      ...b,
      parcelas: parcelas.filter(p => p.boleto_id === b.id),
    }));
  }

  async criarBoleto(dto: any) {
    if (!dto.recebedor) throw new BadRequestException('Recebedor é obrigatório');
    if (!dto.credor) throw new BadRequestException('Credor é obrigatório');
    if (!dto.valor && dto.valor !== 0) throw new BadRequestException('Valor é obrigatório');
    if (!dto.data_emissao) throw new BadRequestException('Data de emissão é obrigatória');

    const boleto = await this.boletoRepo.save(this.boletoRepo.create({
      recebedor: dto.recebedor,
      credor: dto.credor,
      cnpj: dto.cnpj ?? null,
      valor: dto.valor,
      cod_barras: dto.cod_barras ?? null,
      data_emissao: dto.data_emissao,
      parcelado: dto.parcelado ?? false,
      qtd_parcelas: dto.qtd_parcelas ?? 1,
      status: 'Pendente',
      arquivo_base64: dto.arquivo_base64 ?? null,
      arquivo_nome: dto.arquivo_nome ?? null,
      descricao: dto.descricao ?? null,
    }));

    const parcelas: BoletoParcela[] = [];
    const parcelasConfig: any[] = dto.parcelas ?? [];

    if (parcelasConfig.length > 0) {
      for (let i = 0; i < parcelasConfig.length; i++) {
        const pc = parcelasConfig[i];
        // Create movimentacao entry
        const mov = await this.movRepo.save(this.movRepo.create({
          nome: `Boleto: ${boleto.credor} — Parcela ${i + 1}/${parcelasConfig.length}`,
          valor: pc.valor,
          data: pc.data_vencimento,
          tipo_movimentacao: 'Receita',
          plano_contas: 'Boletos a Receber',
          status: 'Pendente',
          descricao: boleto.descricao ?? undefined,
        } as any)) as unknown as MovimentacaoFinanceira;

        const p = await this.parcelaRepo.save(this.parcelaRepo.create({
          boleto_id: boleto.id,
          numero_parcela: i + 1,
          valor: pc.valor,
          data_vencimento: pc.data_vencimento,
          data_pagamento: null,
          pago: false,
          movimentacao_id: mov.id,
        }));
        parcelas.push(p);
      }
    } else {
      // à vista — single parcela
      const mov = await this.movRepo.save(this.movRepo.create({
        nome: `Boleto: ${boleto.credor}`,
        valor: boleto.valor,
        data: boleto.data_emissao,
        tipo_movimentacao: 'Receita',
        plano_contas: 'Boletos a Receber',
        status: 'Pendente',
        descricao: boleto.descricao ?? undefined,
      } as any)) as unknown as MovimentacaoFinanceira;

      const p = await this.parcelaRepo.save(this.parcelaRepo.create({
        boleto_id: boleto.id,
        numero_parcela: 1,
        valor: boleto.valor,
        data_vencimento: boleto.data_emissao,
        data_pagamento: null,
        pago: false,
        movimentacao_id: mov.id,
      }));
      parcelas.push(p);
    }

    return { ...boleto, parcelas };
  }

  async atualizarBoleto(id: string, dto: any) {
    const b = await this.boletoRepo.findOneBy({ id });
    if (!b) throw new NotFoundException('Boleto não encontrado');
    const { parcelas: _p, ...fields } = dto;
    await this.boletoRepo.update(id, fields);
    return this.boletoRepo.findOneByOrFail({ id });
  }

  async marcarParcelaPaga(parcelaId: string, dto: { data_pagamento: string }) {
    const parcela = await this.parcelaRepo.findOneBy({ id: parcelaId });
    if (!parcela) throw new NotFoundException('Parcela não encontrada');

    await this.parcelaRepo.update(parcelaId, {
      pago: true,
      data_pagamento: dto.data_pagamento,
    });

    // Sync movimentacao status
    if (parcela.movimentacao_id) {
      await this.movRepo.update(parcela.movimentacao_id, {
        status: 'Pago',
        data: dto.data_pagamento,
      } as any);
    }

    // Check if all parcelas paid → update boleto status
    const allParcelas = await this.parcelaRepo.findBy({ boleto_id: parcela.boleto_id });
    const todasPagas = allParcelas.every(p => p.id === parcelaId || p.pago);
    if (todasPagas) {
      await this.boletoRepo.update(parcela.boleto_id, { status: 'Pago' });
    }

    return { ok: true };
  }

  async deletarBoleto(id: string) {
    const b = await this.boletoRepo.findOneBy({ id });
    if (!b) throw new NotFoundException('Boleto não encontrado');
    // Clean up movimentacoes linked to parcelas
    const parcelas = await this.parcelaRepo.findBy({ boleto_id: id });
    for (const p of parcelas) {
      if (p.movimentacao_id) {
        await this.movRepo.delete(p.movimentacao_id).catch(() => {});
      }
    }
    await this.parcelaRepo.delete({ boleto_id: id });
    await this.boletoRepo.delete(id);
    return { message: 'Boleto removido' };
  }
}
