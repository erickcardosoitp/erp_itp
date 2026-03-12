import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Insumo } from './entities/insumo.entity';
import { Doador } from './entities/doador.entity';
import { ContaBancaria } from './entities/conta-bancaria.entity';

@Injectable()
export class CadastroService {
  constructor(
    @InjectRepository(Insumo)        private insumoRepo: Repository<Insumo>,
    @InjectRepository(Doador)        private doadorRepo: Repository<Doador>,
    @InjectRepository(ContaBancaria) private contaRepo: Repository<ContaBancaria>,
  ) {}

  // ── INSUMOS ───────────────────────────────────────────────────────────────

  listarInsumos() {
    return this.insumoRepo.find({ order: { nome: 'ASC' } });
  }

  async criarInsumo(dto: Partial<Insumo>) {
    if (!dto.nome) throw new BadRequestException('Nome é obrigatório');
    const insumo = this.insumoRepo.create(dto);
    return this.insumoRepo.save(insumo);
  }

  async editarInsumo(id: string, dto: Partial<Insumo>) {
    const existing = await this.insumoRepo.findOneBy({ id });
    if (!existing) throw new NotFoundException('Insumo não encontrado');
    await this.insumoRepo.update(id, dto);
    return this.insumoRepo.findOneByOrFail({ id });
  }

  async deletarInsumo(id: string) {
    const existing = await this.insumoRepo.findOneBy({ id });
    if (!existing) throw new NotFoundException('Insumo não encontrado');
    await this.insumoRepo.delete(id);
    return { message: 'Insumo removido com sucesso' };
  }

  // ── DOADORES ──────────────────────────────────────────────────────────────

  listarDoadores() {
    return this.doadorRepo.find({ order: { nome: 'ASC' } });
  }

  async criarDoador(dto: Partial<Doador>) {
    if (!dto.nome) throw new BadRequestException('Nome é obrigatório');
    const now = new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const total = await this.doadorRepo.count();
    const seq = String(total + 1).padStart(3, '0');
    const codigo_interno = `ITP-DOAD-${yyyymm}-${seq}`;
    const doador = this.doadorRepo.create({ ...dto, codigo_interno });
    return this.doadorRepo.save(doador);
  }

  async editarDoador(id: string, dto: Partial<Doador>) {
    const existing = await this.doadorRepo.findOneBy({ id });
    if (!existing) throw new NotFoundException('Doador não encontrado');
    await this.doadorRepo.update(id, dto);
    return this.doadorRepo.findOneByOrFail({ id });
  }

  async deletarDoador(id: string) {
    const existing = await this.doadorRepo.findOneBy({ id });
    if (!existing) throw new NotFoundException('Doador não encontrado');
    await this.doadorRepo.delete(id);
    return { message: 'Doador removido com sucesso' };
  }

  // ── CONTAS BANCÁRIAS ──────────────────────────────────────────────────────

  listarContas() {
    return this.contaRepo.find({ order: { banco: 'ASC' } });
  }

  async criarConta(dto: Partial<ContaBancaria>) {
    if (!dto.banco || !dto.conta || !dto.titular) {
      throw new BadRequestException('Banco, conta e titular são obrigatórios');
    }
    const now = new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const total = await this.contaRepo.count();
    const seq = String(total + 1).padStart(3, '0');
    const codigo_interno = `ITP-BNCO-${yyyymm}-${seq}`;
    const conta = this.contaRepo.create({ ...dto, codigo_interno });
    return this.contaRepo.save(conta);
  }

  async editarConta(id: string, dto: Partial<ContaBancaria>) {
    const existing = await this.contaRepo.findOneBy({ id });
    if (!existing) throw new NotFoundException('Conta bancária não encontrada');
    await this.contaRepo.update(id, dto);
    return this.contaRepo.findOneByOrFail({ id });
  }

  async deletarConta(id: string) {
    const existing = await this.contaRepo.findOneBy({ id });
    if (!existing) throw new NotFoundException('Conta bancária não encontrada');
    await this.contaRepo.delete(id);
    return { message: 'Conta bancária removida com sucesso' };
  }
}
