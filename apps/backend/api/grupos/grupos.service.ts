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

  async atualizar(id: string, dados: Partial<{ nome: string; grupo_permissoes: any }>) {
    const grupo = await this.grupoRepository.findOneBy({ id });
    if (!grupo) throw new NotFoundException('Grupo não encontrado.');
    if (dados.nome) dados.nome = dados.nome.toUpperCase().trim();
    await this.grupoRepository.update(id, dados);
    return this.grupoRepository.findOneByOrFail({ id });
  }

  async deletar(id: string) {
    const grupo = await this.grupoRepository.findOne({ where: { id }, relations: ['usuarios'] });
    if (!grupo) throw new NotFoundException('Grupo não encontrado.');
    if (grupo.usuarios && grupo.usuarios.length > 0) {
      throw new ConflictException('Não é possível excluir um grupo com usuários vinculados.');
    }
    await this.grupoRepository.delete(id);
    return { message: 'Grupo removido com sucesso.' };
  }
}