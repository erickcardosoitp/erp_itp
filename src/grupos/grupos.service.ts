import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Grupo } from './grupo.entity';

@Injectable()
export class GruposService {
  constructor(
    @InjectRepository(Grupo)
    private readonly grupoRepository: Repository<Grupo>,
  ) {}

  async criar(nome: string, permissoes: any) {
    const nomeNormalizado = nome.toUpperCase().trim();
    const existe = await this.grupoRepository.findOneBy({ nome: nomeNormalizado });
    
    if (existe) {
      throw new ConflictException('Este cargo/grupo já está cadastrado.');
    }

    const novoGrupo = this.grupoRepository.create({
      nome: nomeNormalizado,
      grupo_permissoes: permissoes,
    });

    return await this.grupoRepository.save(novoGrupo);
  }

  async listarTodos() {
    return await this.grupoRepository.find({ relations: ['usuarios'] });
  }

  async buscarPorId(id: string) {
    const grupo = await this.grupoRepository.findOneBy({ id });
    if (!grupo) throw new NotFoundException('Grupo não encontrado.');
    return grupo;
  }
}