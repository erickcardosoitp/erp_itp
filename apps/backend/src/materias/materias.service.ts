import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Materia } from '../materia.entity';

@Injectable()
export class MateriasService {
  constructor(
    @InjectRepository(Materia)
    private readonly materiaRepository: Repository<Materia>,
  ) {}

  // Criar nova matéria com todos os campos do seu .docx
  async create(dados: Partial<Materia>): Promise<Materia> {
    const novaMateria = this.materiaRepository.create({
      ...dados,
      status: 'Pendente', // Regra: inicia sempre como Pendente
      progresso: 0,
      media: 0,
      acertos: 0,
      totalQuestoes: 0,
    });
    return await this.materiaRepository.save(novaMateria);
  }

  // Listar todas para a Aba Histórico
  async findAll(): Promise<Materia[]> {
    return await this.materiaRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  // Helper para buscar uma matéria específica
  async findOne(id: string): Promise<Materia> {
    const materia = await this.materiaRepository.findOneBy({ id });
    if (!materia) {
      throw new NotFoundException(`Matéria com ID ${id} não encontrada`);
    }
    return materia;
  }

  // Atualizar progresso (Barra Evolutiva)
  async updateProgress(id: string, novoProgresso: number): Promise<Materia> {
    const materia = await this.findOne(id);
    materia.progresso = novoProgresso;

    // Lógica automática: se progresso é 100%, status muda
    if (novoProgresso >= 100) {
      materia.status = 'Concluída';
    } else if (novoProgresso > 0) {
      materia.status = 'Em Andamento';
    }

    return await this.materiaRepository.save(materia);
  }

  // Remover matéria
  async remove(id: string): Promise<void> {
    const materia = await this.findOne(id);
    await this.materiaRepository.remove(materia);
  }
}