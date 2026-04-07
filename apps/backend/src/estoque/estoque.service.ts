import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Produto } from './entities/produto.entity';
import { MovimentoEstoque } from './entities/movimento-estoque.entity';
import { CategoriaInsumo } from './entities/categoria-insumo.entity';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

@Injectable()
export class EstoqueService {
  private readonly logger = new Logger(EstoqueService.name);

  constructor(
    @InjectRepository(Produto) private produtoRepo: Repository<Produto>,
    @InjectRepository(MovimentoEstoque) private movimentoRepo: Repository<MovimentoEstoque>,
    @InjectRepository(CategoriaInsumo) private categoriaRepo: Repository<CategoriaInsumo>,
    private readonly notificacoes: NotificacoesService,
  ) {}

  // ── Produtos ──────────────────────────────────────────────────────────────

  async listarTodos(): Promise<Produto[]> {
    return this.produtoRepo.find({ order: { categoria: 'ASC', nome: 'ASC' } });
  }

  async criarProduto(dados: {
    nome: string;
    categoria?: string;
    unidade_medida?: string;
    estoque_minimo?: number;
    quantidade_atual?: number;
    valor_compra?: number;
  }): Promise<Produto> {
    if (!dados.nome?.trim()) throw new BadRequestException('Nome é obrigatório.');
    const produto = this.produtoRepo.create({
      nome: dados.nome.trim(),
      categoria: dados.categoria || 'Geral',
      unidade_medida: dados.unidade_medida || 'un',
      estoque_minimo: Number(dados.estoque_minimo ?? 0),
      quantidade_atual: Number(dados.quantidade_atual ?? 0),
      valor_compra: dados.valor_compra != null ? Number(dados.valor_compra) : null,
    });
    // Gera código interno único: ITP-INSM-YYYYMM-NNN
    const now = new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const total = await this.produtoRepo.count();
    const seq = String(total + 1).padStart(3, '0');
    produto.codigo_interno = `ITP-INSM-${yyyymm}-${seq}`;
    const salvo = await this.produtoRepo.save(produto);
    this.logger.log(`📦 Produto criado: ${salvo.nome} (${salvo.id})`);
    await this.notificacoes.criar({
      tipo: 'sistema',
      titulo: `Produto cadastrado: ${salvo.nome}`,
      mensagem: `Novo produto "${salvo.nome}" foi adicionado ao estoque (${salvo.codigo_interno}).`,
      referencia_id: salvo.id,
      referencia_tipo: 'produto',
    });
    return salvo;
  }

  async atualizarProduto(id: string, dados: Partial<Produto>): Promise<Produto> {
    const p = await this.produtoRepo.findOneBy({ id });
    if (!p) throw new NotFoundException('Produto não encontrado.');
    // Campos numéricos: forçar conversão
    if (dados.estoque_minimo !== undefined) dados.estoque_minimo = Number(dados.estoque_minimo);
    if (dados.quantidade_atual !== undefined) dados.quantidade_atual = Number(dados.quantidade_atual);
    if (dados.valor_compra !== undefined) dados.valor_compra = dados.valor_compra != null ? Number(dados.valor_compra) : null;
    Object.assign(p, dados);
    return this.produtoRepo.save(p);
  }

  async deletarProduto(id: string): Promise<{ ok: boolean }> {
    const p = await this.produtoRepo.findOneBy({ id });
    if (!p) throw new NotFoundException('Produto não encontrado.');
    p.ativo = false;
    await this.produtoRepo.save(p);
    return { ok: true };
  }

  async listarAlertas(): Promise<Produto[]> {
    return this.produtoRepo
      .createQueryBuilder('p')
      .where('p.ativo = true AND p.estoque_minimo > 0 AND p.quantidade_atual <= p.estoque_minimo')
      .orderBy('p.quantidade_atual', 'ASC')
      .getMany();
  }

  // ── Movimentos ────────────────────────────────────────────────────────────

  async registrarEntrada(
    id: string,
    quantidade: number,
    observacao?: string,
    usuarioNome?: string,
    precoPago?: number,
  ): Promise<{ produto: Produto; movimento: MovimentoEstoque }> {
    const p = await this.produtoRepo.findOneBy({ id });
    if (!p) throw new NotFoundException('Produto não encontrado.');
    if (quantidade <= 0) throw new BadRequestException('Quantidade deve ser maior que zero.');

    p.quantidade_atual = Number(p.quantidade_atual) + Number(quantidade);
    // Atualiza valor_compra se informado na entrada
    if (precoPago != null) p.valor_compra = Number(precoPago);
    const produtoAtualizado = await this.produtoRepo.save(p);

    const mov = await this.movimentoRepo.save(
      this.movimentoRepo.create({
        produto_id: id, tipo: 'entrada', quantidade, observacao,
        usuario_nome: usuarioNome,
        preco_pago: precoPago != null ? Number(precoPago) : null,
      }),
    );
    this.logger.log(`➕ Entrada: +${quantidade} ${p.unidade_medida} | ${p.nome}`);
    return { produto: produtoAtualizado, movimento: mov };
  }

  async registrarBaixa(
    id: string,
    quantidade: number,
    observacao?: string,
    usuarioNome?: string,
  ): Promise<{ produto: Produto; movimento: MovimentoEstoque }> {
    const p = await this.produtoRepo.findOneBy({ id });
    if (!p) throw new NotFoundException('Produto não encontrado.');
    if (quantidade <= 0) throw new BadRequestException('Quantidade deve ser maior que zero.');
    if (Number(p.quantidade_atual) < Number(quantidade)) {
      throw new BadRequestException(
        `Estoque insuficiente. Disponível: ${p.quantidade_atual} ${p.unidade_medida}.`,
      );
    }

    p.quantidade_atual = Number(p.quantidade_atual) - Number(quantidade);
    const produtoAtualizado = await this.produtoRepo.save(p);

    const mov = await this.movimentoRepo.save(
      this.movimentoRepo.create({ produto_id: id, tipo: 'baixa', quantidade, observacao, usuario_nome: usuarioNome }),
    );
    this.logger.log(`➖ Baixa: -${quantidade} ${p.unidade_medida} | ${p.nome}`);
    // Dispara alerta de estoque mínimo se necessário
    if (produtoAtualizado.estoque_minimo > 0 && Number(produtoAtualizado.quantidade_atual) <= Number(produtoAtualizado.estoque_minimo)) {
      await this.notificacoes.gerarAlertasEstoqueMinimo([{
        id: produtoAtualizado.id,
        nome: produtoAtualizado.nome,
        quantidade_atual: Number(produtoAtualizado.quantidade_atual),
        estoque_minimo: Number(produtoAtualizado.estoque_minimo),
      }]).catch(() => {});
    }
    return { produto: produtoAtualizado, movimento: mov };
  }

  async listarMovimentos(produtoId?: string, limit = 100): Promise<MovimentoEstoque[]> {
    const qb = this.movimentoRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.produto', 'p')
      .orderBy('m.createdAt', 'DESC')
      .take(limit);
    if (produtoId) qb.where('m.produto_id = :produtoId', { produtoId });
    return qb.getMany();
  }

  // ── Relatório de Valor ────────────────────────────────────────────────────

  async relatorioValor() {
    const produtos = await this.produtoRepo.find({ where: { ativo: true }, order: { categoria: 'ASC', nome: 'ASC' } });
    const itens = produtos.map(p => ({
      id: p.id,
      nome: p.nome,
      categoria: p.categoria,
      unidade_medida: p.unidade_medida,
      quantidade_atual: Number(p.quantidade_atual),
      estoque_minimo: Number(p.estoque_minimo),
      valor_compra: p.valor_compra != null ? Number(p.valor_compra) : null,
      valor_total: p.valor_compra != null ? Number(p.quantidade_atual) * Number(p.valor_compra) : null,
    }));
    const valor_total_estoque = itens.reduce((acc, i) => acc + (i.valor_total ?? 0), 0);
    const itens_com_preco = itens.filter(i => i.valor_compra != null).length;
    return { itens, valor_total_estoque, itens_com_preco, total_itens: itens.length };
  }

  // ── Coletor (público) ────────────────────────────────────────────────────

  listarColetorPublico(): Promise<Pick<Produto, 'id' | 'nome' | 'categoria' | 'unidade_medida' | 'quantidade_atual' | 'estoque_minimo'>[]> {
    return this.produtoRepo.find({
      select: ['id', 'nome', 'categoria', 'unidade_medida', 'quantidade_atual', 'estoque_minimo'],
      where: { ativo: true },
      order: { categoria: 'ASC', nome: 'ASC' },
    });
  }

  // ── Categorias ────────────────────────────────────────────────────────────

  async listarCategorias(): Promise<CategoriaInsumo[]> {
    return this.categoriaRepo.find({ order: { nome: 'ASC' } });
  }

  async criarCategoria(nome: string, codigo?: string): Promise<CategoriaInsumo> {
    const nomeLimpo = nome?.trim();
    if (!nomeLimpo) throw new BadRequestException('Nome da categoria é obrigatório.');
    const existe = await this.categoriaRepo.findOneBy({ nome: nomeLimpo });
    if (existe) throw new ConflictException(`Categoria "${nomeLimpo}" já existe.`);
    const codigoLimpo = codigo?.trim().toUpperCase() || null;
    const cat = this.categoriaRepo.create({ nome: nomeLimpo, codigo: codigoLimpo });
    return this.categoriaRepo.save(cat);
  }

  async atualizarCategoria(id: string, nome: string, codigo?: string): Promise<CategoriaInsumo> {
    const c = await this.categoriaRepo.findOneBy({ id });
    if (!c) throw new NotFoundException('Categoria não encontrada.');
    const nomeLimpo = nome?.trim();
    if (!nomeLimpo) throw new BadRequestException('Nome é obrigatório.');
    c.nome = nomeLimpo;
    if (codigo !== undefined) c.codigo = codigo?.trim().toUpperCase() || null;
    return this.categoriaRepo.save(c);
  }

  async deletarCategoria(id: string): Promise<{ ok: boolean }> {
    const c = await this.categoriaRepo.findOneBy({ id });
    if (!c) throw new NotFoundException('Categoria não encontrada.');
    const usada = await this.produtoRepo.findOneBy({ categoria: c.nome, ativo: true });
    if (usada) throw new BadRequestException(`A categoria "${c.nome}" está em uso e não pode ser excluída.`);
    await this.categoriaRepo.remove(c);
    return { ok: true };
  }
}
