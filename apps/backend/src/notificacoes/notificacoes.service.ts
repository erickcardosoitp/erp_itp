import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Notificacao } from './notificacao.entity';

export interface CriarNotificacaoDto {
  tipo: string;
  titulo: string;
  mensagem: string;
  referencia_id?: string;
  referencia_tipo?: string;
  usuario_id?: string;
}

@Injectable()
export class NotificacoesService {
  private readonly logger = new Logger(NotificacoesService.name);

  constructor(
    @InjectRepository(Notificacao) private repo: Repository<Notificacao>,
  ) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async listar(params: { pagina?: number; limite?: number; apenasNaoLidas?: boolean } = {}) {
    const { pagina = 1, limite = 50, apenasNaoLidas = false } = params;
    const skip = (pagina - 1) * limite;
    const where: Partial<Notificacao> = apenasNaoLidas ? { lida: false } : {};
    const [items, total] = await this.repo.findAndCount({
      where,
      order: { criado_em: 'DESC' },
      take: limite,
      skip,
    });
    return { items, total, pagina, limite };
  }

  async contarNaoLidas(): Promise<number> {
    return this.repo.count({ where: { lida: false } });
  }

  async marcarLida(id: string) {
    const n = await this.repo.findOneBy({ id });
    if (!n) throw new NotFoundException('Notificação não encontrada');
    n.lida = true;
    return this.repo.save(n);
  }

  async marcarTodasLidas() {
    await this.repo.update({ lida: false }, { lida: true });
    return { ok: true, mensagem: 'Todas as notificações foram marcadas como lidas.' };
  }

  async deletar(id: string) {
    await this.repo.delete(id);
    return { ok: true };
  }

  async deletarTodasLidas() {
    await this.repo.delete({ lida: true });
    return { ok: true };
  }

  // ── CRIAÇÃO INTERNA (chamada pelos outros serviços) ────────────────────────

  async criar(dto: CriarNotificacaoDto): Promise<Notificacao> {
    try {
      const n = this.repo.create({
        tipo: dto.tipo,
        titulo: dto.titulo,
        mensagem: dto.mensagem,
        referencia_id: dto.referencia_id ?? null,
        referencia_tipo: dto.referencia_tipo ?? null,
        usuario_id: dto.usuario_id ?? null,
        lida: false,
      });
      const salvo = await this.repo.save(n);
      this.logger.log(`🔔 Notificação criada: [${dto.tipo}] ${dto.titulo}`);
      return salvo;
    } catch (err: any) {
      this.logger.error(`Erro ao criar notificação: ${err.message}`);
      throw err;
    }
  }

  // ── ALERTAS AUTOMÁTICOS ───────────────────────────────────────────────────

  /**
   * Verifica produtos abaixo do estoque mínimo e cria notificações
   * para aqueles que ainda não têm notificação não-lida.
   */
  async gerarAlertasEstoqueMinimo(produtos: { id: string; nome: string; quantidade_atual: number; estoque_minimo: number }[]) {
    const criticos = produtos.filter(p => p.estoque_minimo > 0 && p.quantidade_atual <= p.estoque_minimo);
    for (const p of criticos) {
      // Evita duplicar alertas não-lidos para o mesmo produto
      const existe = await this.repo.findOne({
        where: { tipo: 'estoque_minimo', referencia_id: p.id, lida: false },
      });
      if (!existe) {
        await this.criar({
          tipo: 'estoque_minimo',
          titulo: `⚠ Estoque crítico: ${p.nome}`,
          mensagem: `O produto "${p.nome}" está com estoque crítico (${p.quantidade_atual} ${p.quantidade_atual === 1 ? 'unidade' : 'unidades'} — mínimo: ${p.estoque_minimo}).`,
          referencia_id: p.id,
          referencia_tipo: 'produto',
        });
      }
    }
  }

  /** Limpa notificações antigas (> 90 dias) que já foram lidas */
  async limparAntigos() {
    const limite = new Date();
    limite.setDate(limite.getDate() - 90);
    const result = await this.repo.delete({ lida: true, criado_em: LessThan(limite) });
    this.logger.log(`🗑 ${result.affected ?? 0} notificações antigas removidas.`);
    return { removidas: result.affected ?? 0 };
  }
}
