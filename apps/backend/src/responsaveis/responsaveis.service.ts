import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, Or } from 'typeorm';
import { Responsavel } from './responsavel.entity';

@Injectable()
export class ResponsaveisService {
  constructor(
    @InjectRepository(Responsavel)
    private repo: Repository<Responsavel>,
  ) {}

  buscar(search?: string, limit = 20): Promise<Responsavel[]> {
    if (search?.trim()) {
      const q = `%${search.trim()}%`;
      return this.repo.find({
        where: [
          { nome_completo: ILike(q), ativo: true },
          { cpf: ILike(q), ativo: true },
          { email: ILike(q), ativo: true },
        ],
        order: { nome_completo: 'ASC' },
        take: Math.min(limit, 50),
      });
    }
    return this.repo.find({
      where: { ativo: true },
      order: { nome_completo: 'ASC' },
      take: Math.min(limit, 50),
    });
  }

  async findOne(id: string): Promise<Responsavel> {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Responsável não encontrado');
    return r;
  }

  criar(data: Partial<Responsavel>): Promise<Responsavel> {
    return this.repo.save(this.repo.create(data));
  }

  async atualizar(id: string, data: Partial<Responsavel>): Promise<Responsavel> {
    const r = await this.findOne(id);
    Object.assign(r, data);
    return this.repo.save(r);
  }

  async desativar(id: string): Promise<void> {
    await this.findOne(id);
    await this.repo.update(id, { ativo: false });
  }
}
