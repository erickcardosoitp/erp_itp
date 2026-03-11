import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Funcionario } from '../academico/entities/funcionario.entity';

@Injectable()
export class FuncionariosService {
  private readonly logger = new Logger(FuncionariosService.name);

  constructor(
    @InjectRepository(Funcionario) private funcionarioRepo: Repository<Funcionario>,
  ) {}

  listar() {
    return this.funcionarioRepo.find({ order: { nome: 'ASC' } });
  }

  async criar(dto: Partial<Funcionario>) {
    if (!dto.nome) throw new BadRequestException('Nome é obrigatório');

    // Gera matrícula única: ITP-FUNC-YYYYMM-NNN
    const now = new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const total = await this.funcionarioRepo.count();
    const seq = String(total + 1).padStart(3, '0');
    const matricula = `ITP-FUNC-${yyyymm}-${seq}`;

    const funcionario = this.funcionarioRepo.create({ ...dto, matricula });
    const salvo = await this.funcionarioRepo.save(funcionario);
    this.logger.log(`Funcionário criado: ${salvo.id} - ${salvo.nome} | Matrícula: ${matricula}`);
    return salvo;
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
}
