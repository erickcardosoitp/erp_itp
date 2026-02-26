import { Injectable, InternalServerErrorException, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Inscricao, StatusMatricula } from './inscricao.entity';
import { Aluno } from '../alunos/aluno.entity';

@Injectable()
export class MatriculasService {
  constructor(private readonly dataSource: DataSource) {}

  // 1. Recebe o Webhook do Google Forms
  async receberInscricao(dados: any) {
    const repo = this.dataSource.getRepository(Inscricao);
    try {
      const novaInscricao = repo.create({
        ...dados,
        status_matricula: StatusMatricula.PENDENTE
      });
      return await repo.save(novaInscricao);
    } catch (error) {
      console.error('Erro ao salvar inscrição:', error);
      throw new InternalServerErrorException('Falha ao processar dados do formulário.');
    }
  }

  // 2. Transição Atômica (Botão Concluir Matrícula)
  async finalizarMatricula(inscricaoId: string | number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const repoInscricao = queryRunner.manager.getRepository(Inscricao);
      const repoAluno = queryRunner.manager.getRepository(Aluno);

      // Conversão explícita para Number para evitar erro de tipo no Postgres
      const idNumerico = Number(inscricaoId);
      const inscricao = await repoInscricao.findOneBy({ id: idNumerico });

      if (!inscricao) {
        throw new NotFoundException('Inscrição não encontrada no sistema.');
      }

      if (inscricao.status_matricula !== StatusMatricula.CONFIRMADA) {
        throw new BadRequestException(`Status atual: ${inscricao.status_matricula}. A matrícula precisa estar CONFIRMADA.`);
      }

      // Cria o Aluno oficial
      const novoAluno = repoAluno.create({
        nome: inscricao.nome_completo,
        email: inscricao.email,
        cpf: inscricao.cpf,
        data_nascimento: inscricao.data_nascimento?.toString(),
        // Gerador de matrícula: ITP + ANO + 3 primeiros dígitos do CPF
        matricula: `ITP-${new Date().getFullYear()}-${inscricao.cpf?.replace(/\D/g, '').substring(0, 3) || '000'}`,
      });

      const alunoSalvo = await queryRunner.manager.save(novoAluno);

      // Atualiza a esteira para MATRICULADO
      inscricao.status_matricula = StatusMatricula.MATRICULADO;
      await queryRunner.manager.save(inscricao);

      await queryRunner.commitTransaction();
      return alunoSalvo;

    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // 3. Auxiliar para o Controller
  async listarTodas() {
    return await this.dataSource.getRepository(Inscricao).find({
      order: { id: 'DESC' } // Mostra as mais recentes primeiro
    });
  }
}