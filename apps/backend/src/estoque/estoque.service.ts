import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Produto } from './entities/produto.entity';
import { MovimentoEstoque } from './entities/movimento-estoque.entity';
import { CategoriaInsumo } from './entities/categoria-insumo.entity';

@Injectable()
export class EstoqueService {
  private readonly logger = new Logger(EstoqueService.name);

  constructor(
    @InjectRepository(Produto) private produtoRepo: Repository<Produto>,
    @InjectRepository(MovimentoEstoque) private movimentoRepo: Repository<MovimentoEstoque>,
    @InjectRepository(CategoriaInsumo) private categoriaRepo: Repository<CategoriaInsumo>,
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
  }): Promise<Produto> {
    if (!dados.nome?.trim()) throw new BadRequestException('Nome é obrigatório.');
    const produto = this.produtoRepo.create({
      nome: dados.nome.trim(),
      categoria: dados.categoria || 'Geral',
      unidade_medida: dados.unidade_medida || 'un',
      estoque_minimo: Number(dados.estoque_minimo ?? 0),
      quantidade_atual: Number(dados.quantidade_atual ?? 0),
    });
    const salvo = await this.produtoRepo.save(produto);
    this.logger.log(`📦 Produto criado: ${salvo.nome} (${salvo.id})`);
    return salvo;
  }

  async atualizarProduto(id: string, dados: Partial<Produto>): Promise<Produto> {
    const p = await this.produtoRepo.findOneBy({ id });
    if (!p) throw new NotFoundException('Produto não encontrado.');
    // Campos numéricos: forçar conversão
    if (dados.estoque_minimo !== undefined) dados.estoque_minimo = Number(dados.estoque_minimo);
    if (dados.quantidade_atual !== undefined) dados.quantidade_atual = Number(dados.quantidade_atual);
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
  ): Promise<{ produto: Produto; movimento: MovimentoEstoque }> {
    const p = await this.produtoRepo.findOneBy({ id });
    if (!p) throw new NotFoundException('Produto não encontrado.');
    if (quantidade <= 0) throw new BadRequestException('Quantidade deve ser maior que zero.');

    p.quantidade_atual = Number(p.quantidade_atual) + Number(quantidade);
    const produtoAtualizado = await this.produtoRepo.save(p);

    const mov = await this.movimentoRepo.save(
      this.movimentoRepo.create({ produto_id: id, tipo: 'entrada', quantidade, observacao, usuario_nome: usuarioNome }),
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

  async criarCategoria(nome: string): Promise<CategoriaInsumo> {
    const nomeLimpo = nome?.trim();
    if (!nomeLimpo) throw new BadRequestException('Nome da categoria é obrigatório.');
    const existe = await this.categoriaRepo.findOneBy({ nome: nomeLimpo });
    if (existe) throw new ConflictException(`Categoria "${nomeLimpo}" já existe.`);
    const cat = this.categoriaRepo.create({ nome: nomeLimpo });
    return this.categoriaRepo.save(cat);
  }

  async atualizarCategoria(id: string, nome: string): Promise<CategoriaInsumo> {
    const c = await this.categoriaRepo.findOneBy({ id });
    if (!c) throw new NotFoundException('Categoria não encontrada.');
    const nomeLimpo = nome?.trim();
    if (!nomeLimpo) throw new BadRequestException('Nome é obrigatório.');
    c.nome = nomeLimpo;
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
