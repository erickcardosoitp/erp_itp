import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Inscricao, StatusMatricula } from './inscricao.entity';
import { Aluno } from '../alunos/aluno.entity';

@Injectable()
export class MatriculasService {
  private readonly logger = new Logger(MatriculasService.name);

  constructor(
    @InjectRepository(Inscricao)
    private readonly inscricaoRepository: Repository<Inscricao>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Lista todas as inscrições com carregamento otimizado da relação aluno.
   */
  async listarTodas(): Promise<Inscricao[]> {
    try {
      return await this.inscricaoRepository.find({
        relations: { aluno: true },
        order: { createdAt: 'DESC' },
      });
    } catch (error: any) {
      this.logger.error(`❌ Erro ao listar matrículas: ${error.message}`);
      throw new BadRequestException('Não foi possível carregar a lista de matrículas.');
    }
  }

  /**
   * FASE 1 -> 2: Marca como aguardando assinatura do termo LGPD.
   */
  async marcarComoAguardandoLGPD(id: number): Promise<Inscricao> {
    const inscricao = await this.inscricaoRepository.findOneBy({ id });
    if (!inscricao) throw new NotFoundException('Inscrição não encontrada.');

    inscricao.status_matricula = StatusMatricula.AGUARDANDO_LGPD;
    
    this.logger.log(`📧 Termo LGPD disparado para: ${inscricao.nome_completo}`);
    return (await this.inscricaoRepository.save(inscricao)) as Inscricao;
  }

  /**
   * FASE 2 -> 3: Confirma a assinatura e move para validação documental.
   */
  async confirmarAssinaturaLGPD(id: number): Promise<Inscricao> {
    const inscricao = await this.inscricaoRepository.findOneBy({ id });
    if (!inscricao) throw new NotFoundException('Inscrição não encontrada.');
    
    if (inscricao.lgpd_aceito) return inscricao;

    inscricao.status_matricula = StatusMatricula.EM_VALIDACAO;
    inscricao.lgpd_aceito = true;
    inscricao.data_assinatura_lgpd = new Date();

    this.logger.log(`✅ Assinatura LGPD confirmada: ${inscricao.nome_completo}`);
    return (await this.inscricaoRepository.save(inscricao)) as Inscricao;
  }

  /**
   * Integração com gatilhos externos (ex: Webhook Google Forms).
   */
  async confirmarAssinaturaPorCpf(cpf: string): Promise<Inscricao> {
    const cpfLimpo = cpf.replace(/\D/g, '');
    const inscricao = await this.inscricaoRepository.findOneBy({ cpf: cpfLimpo });
    if (!inscricao) throw new NotFoundException('CPF não localizado na base de inscritos.');
    
    return this.confirmarAssinaturaLGPD(inscricao.id);
  }

  /**
   * Criação de nova inscrição com sanitização de CPF.
   */
  async receberInscricao(dados: any): Promise<Inscricao> {
    const cpfLimpo = String(dados.cpf).replace(/\D/g, '');
    
    const existente = await this.inscricaoRepository.findOneBy({ cpf: cpfLimpo });
    if (existente) throw new BadRequestException('Este CPF já possui uma inscrição ativa.');

    const novaInscricao = this.inscricaoRepository.create({
      ...dados,
      cpf: cpfLimpo,
      status_matricula: StatusMatricula.PENDENTE
    });

    // Cast duplo para resolver ambiguidade do TypeORM (Promise<Inscricao | Inscricao[]>)
    const salva = (await this.inscricaoRepository.save(novaInscricao)) as any as Inscricao;
    this.logger.log(`📥 Nova inscrição recebida: ${salva.nome_completo} (ID: ${salva.id})`);
    return salva;
  }
  
  /**
   * Atualização genérica de status com pipeline de finalização automático.
   */
  async atualizarStatus(id: number, novoStatus: StatusMatricula, motivo?: string): Promise<Inscricao | Aluno> {
    const inscricao = await this.inscricaoRepository.findOneBy({ id });
    if (!inscricao) throw new NotFoundException(`Inscrição ID ${id} não encontrada.`);

    if (novoStatus === StatusMatricula.MATRICULADO) {
      return await this.finalizarMatricula(id);
    }

    inscricao.status_matricula = novoStatus;
    if (motivo) inscricao.motivo_status = motivo;
    
    return (await this.inscricaoRepository.save(inscricao)) as Inscricao;
  }

  /**
   * FASE FINAL: Transação atômica para criação de Aluno e encerramento de Inscrição.
   */
  async finalizarMatricula(inscricaoId: number, cursosSelecionados?: string[]): Promise<Aluno> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const inscricao = await queryRunner.manager.findOne(Inscricao, { 
        where: { id: inscricaoId },
        lock: { mode: 'pessimistic_write' } // Evita condições de corrida
      });

      if (!inscricao) throw new NotFoundException('Inscrição não encontrada.');
      if (inscricao.status_matricula === StatusMatricula.MATRICULADO) {
        throw new BadRequestException('Candidato já possui matrícula ativa.');
      }

      if (cursosSelecionados && cursosSelecionados.length > 0) {
        inscricao.cursos_desejados = cursosSelecionados.join(', ');
      }

      const matriculaGerada = `ITP-${new Date().getFullYear()}-${inscricao.cpf?.substring(0, 4)}`;

      const novoAluno = queryRunner.manager.create(Aluno, {
        nome: inscricao.nome_completo,
        email: inscricao.email,
        cpf: inscricao.cpf,
        data_nascimento: inscricao.data_nascimento,
        matricula: matriculaGerada,
        ativo: true
      });

      const alunoSalvo = await queryRunner.manager.save(novoAluno);
      
      inscricao.status_matricula = StatusMatricula.MATRICULADO;
      inscricao.aluno = alunoSalvo; 
      await queryRunner.manager.save(Inscricao, inscricao);

      await queryRunner.commitTransaction();
      this.logger.log(`🎉 Matrícula efetivada: ${alunoSalvo.matricula} - ${alunoSalvo.nome}`);
      
      return alunoSalvo;
    } catch (err: any) { 
      await queryRunner.rollbackTransaction();
      this.logger.error(`💥 Falha na transação de matrícula: ${err.message}`);
      throw new BadRequestException(err.message || 'Erro interno ao processar matrícula.');
    } finally {
      await queryRunner.release();
    }
  }
}