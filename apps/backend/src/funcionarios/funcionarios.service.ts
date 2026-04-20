import { Injectable, NotFoundException, BadRequestException, Logger, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Funcionario } from '../academico/entities/funcionario.entity';
import { Usuario } from '../usuarios/usuario.entity';
import { EmailService } from '../email.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

@Injectable()
export class FuncionariosService {
  private readonly logger = new Logger(FuncionariosService.name);

  constructor(
    @InjectRepository(Funcionario) private funcionarioRepo: Repository<Funcionario>,
    @InjectRepository(Usuario) private usuarioRepo: Repository<Usuario>,
    public readonly emailService: EmailService,
    private readonly notificacoesService: NotificacoesService,
  ) {}

  listar() {
    return this.funcionarioRepo.find({ order: { nome: 'ASC' } });
  }

  async criar(dto: Partial<Funcionario>): Promise<Funcionario> {
    if (!dto.nome) throw new BadRequestException('Nome é obrigatório');

    // Gera matrícula única: ITP-FUNC-YYYYMM-NNN
    const now = new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const total = await this.funcionarioRepo.count();
    const seq = String(total + 1).padStart(3, '0');
    const matricula = `ITP-FUNC-${yyyymm}-${seq}`;

    try {
      const funcionario = this.funcionarioRepo.create({ ...dto, matricula });
      const salvo = await this.funcionarioRepo.save(funcionario);
      this.logger.log(`Funcionário criado: ${salvo.id} - ${salvo.nome} | Matrícula: ${matricula}`);

      if (salvo.email) {
        this.emailService
          .enviarConfirmacaoCadastroFuncionario(salvo.email, salvo.nome, salvo.matricula)
          .catch(err => this.logger.error(`Erro e-mail confirmação funcionário: ${err.message}`));
      }

      return salvo;
    } catch (err: any) {
      this.logger.error(`Erro ao salvar funcionário: ${err.message}`, err.stack);
      throw new BadRequestException('Erro ao salvar funcionário: ' + err.message);
    }
    
  }

  /**
   * Criado via webhook do Google Forms — após salvar,
   * envia e-mail de confirmação ao funcionário e cria notificação para admins.
   */
  async criarViaWebhook(dto: Partial<Funcionario>): Promise<Funcionario> {
    // Se já existe um funcionário com esse CPF, atualiza em vez de criar (evita duplicata)
    let salvo: Funcionario;
    if (dto.cpf) {
      const cpfNormalizado = dto.cpf.replace(/\D/g, '');
      const existente = await this.funcionarioRepo
        .createQueryBuilder('f')
        .where(`REGEXP_REPLACE(f.cpf, '[^0-9]', '', 'g') = :cpf`, { cpf: cpfNormalizado })
        .getOne();
      if (existente) {
        this.logger.log(`CPF ${cpfNormalizado} já existe — atualizando funcionário ${existente.id}`);
        await this.funcionarioRepo.update(existente.id, { ...dto, cpf: existente.cpf, matricula: existente.matricula });
        salvo = await this.funcionarioRepo.findOneByOrFail({ id: existente.id });
      } else {
        salvo = await this.criar(dto);
      }
    } else {
      salvo = await this.criar(dto);
    }

    // E-mail de confirmação ao funcionário (sem bloquear o retorno)
    if (salvo.email) {
      this.emailService
        .enviarConfirmacaoCadastroFuncionario(salvo.email, salvo.nome, salvo.matricula)
        .catch(err => this.logger.error(`Erro e-mail confirmação funcionário: ${err.message}`));
    }

    // Notificação + e-mail para todos os usuários dos grupos ADMIN, PRT e VP
    this.notificarGruposPorNome(
      ['ADMIN', 'PRT', 'VP'],
      'nova_matricula',
      '👤 Nova solicitação de cadastro de funcionário',
      `${salvo.nome} preencheu o formulário de cadastro. Matrícula provisória: ${salvo.matricula}.`,
      salvo.id,
      'funcionario',
    ).catch(err => this.logger.error(`Erro ao notificar grupos: ${err.message}`));

    return salvo;
  }

  /**
   * Envia notificação no sistema + e-mail para todos os usuários
   * pertencentes aos grupos informados (ex.: ADMIN, PRT, VP).
   */
  private async notificarGruposPorNome(
    grupos: string[],
    tipo: string,
    titulo: string,
    mensagem: string,
    referencia_id?: string,
    referencia_tipo?: string,
  ): Promise<void> {
    try {
      const usuarios = await this.usuarioRepo.find({
        where: { grupo: { nome: In(grupos) } },
        relations: ['grupo'],
      });

      if (usuarios.length === 0) {
        this.logger.warn(`⚠️  Nenhum usuário encontrado nos grupos: ${grupos.join(', ')}`);
        return;
      }

      for (const usuario of usuarios) {
        // Notificação individual visível no painel do usuário
        this.notificacoesService
          .criar({ tipo, titulo, mensagem, referencia_id, referencia_tipo, usuario_id: usuario.id })
          .catch(err => this.logger.error(`Notif. usuario ${usuario.id}: ${err.message}`));

        // E-mail individual
        if (usuario.email) {
          this.emailService
            .enviarNotificacaoGrupo(usuario.email, usuario.nome, titulo, mensagem)
            .catch(err => this.logger.error(`E-mail grupo ${usuario.email}: ${err.message}`));
        }
      }

      this.logger.log(
        `🔔 ${usuarios.length} usuário(s) nos grupos [${grupos.join(', ')}] notificados: ${titulo}`,
      );
    } catch (err: any) {
      this.logger.error(`Erro em notificarGruposPorNome: ${err.message}`);
    }
  }

  async editar(id: string, dto: Partial<Funcionario>) {
    const funcionario = await this.funcionarioRepo.findOneBy({ id });
    if (!funcionario) throw new NotFoundException('Funcionário não encontrado');
    await this.funcionarioRepo.update(id, dto);
    return this.funcionarioRepo.findOneByOrFail({ id });
  }

  async deletar(id: string) {
    const funcionario = await this.funcionarioRepo.findOneBy({ id });
    if (!funcionario) throw new NotFoundException('Funcionário não encontrado');
    await this.funcionarioRepo.delete(id);
  }

  async buscarPorId(id: string): Promise<Funcionario> {
    const f = await this.funcionarioRepo.findOneBy({ id });
    if (!f) throw new NotFoundException('Funcionário não encontrado');
    return f;
  }

  /** Vincula um usuario_id ao funcionário e limpa a matrícula FUNC */
  async vincularUsuario(funcionarioId: string, usuarioId: string): Promise<void> {
    await this.funcionarioRepo.update(funcionarioId, { usuario_id: usuarioId });
  }
}

