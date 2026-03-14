import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from '../../usuarios/usuario.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
  ) {}

  listarTodos() {
    return this.usuarioRepo.find({
      relations: ['grupo'],
      order: { nome: 'ASC' },
    });
  }

  async criar(dados: { nome: string; email?: string; password: string; role?: string; grupo_id?: string; matricula?: string }) {
    if (!dados.password) {
      throw new BadRequestException('Senha é obrigatória.');
    }
    const emailNorm = dados.email ? dados.email.toLowerCase().trim() : null;
    if (emailNorm) {
      const existe = await this.usuarioRepo.findOneBy({ email: emailNorm });
      if (existe) throw new ConflictException('E-mail já cadastrado no sistema.');
    }

    // Gera matrícula com prefixo que reflete a hierarquia do cargo
    const rolePrefix: Record<string, string> = {
      admin: 'ITP-ADM', vp: 'ITP-VP', drt: 'ITP-DRT', adjunto: 'ITP-ADJ',
      prof: 'ITP-PROF', monitor: 'ITP-MNT', assist: 'ITP-AST', cozinha: 'ITP-CZNH',
    };
    let matricula = dados.matricula || null;
    if (!matricula) {
      const now = new Date();
      const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const total = await this.usuarioRepo.count();
      const seq = String(total + 1).padStart(3, '0');
      const prefix = rolePrefix[dados.role?.toLowerCase() ?? ''] ?? 'ITP-USR';
      matricula = `${prefix}-${yyyymm}-${seq}`;
    }

    const hashedPassword = await bcrypt.hash(dados.password, 10);
    const usuario = this.usuarioRepo.create({
      nome: dados.nome,
      email: emailNorm,
      password: hashedPassword,
      role: dados.role || 'assist',
      matricula,
    });
    if (dados.grupo_id) {
      (usuario as any).grupo = { id: dados.grupo_id };
    }
    const salvo = await this.usuarioRepo.save(usuario);
    const { password, ...semSenha } = salvo as any;
    return semSenha;
  }

  async atualizar(id: string, dados: Partial<{ nome: string; role: string; grupo_id: string | null; nova_senha: string; matricula: string }>) {
    const usuario = await this.usuarioRepo.findOne({ where: { id }, relations: ['grupo'] });
    if (!usuario) throw new NotFoundException('Usuário não encontrado.');
    if (dados.nome !== undefined) usuario.nome = dados.nome;
    if (dados.role !== undefined) usuario.role = dados.role;
    if (dados.matricula !== undefined) (usuario as any).matricula = dados.matricula || null;
    if ('grupo_id' in dados) {
      (usuario as any).grupo = dados.grupo_id ? { id: dados.grupo_id } : null;
    }
    if (dados.nova_senha) {
      if (dados.nova_senha.length < 6) throw new BadRequestException('A senha deve ter pelo menos 6 caracteres.');
      usuario.password = await bcrypt.hash(dados.nova_senha, 10);
    }
    const salvo = await this.usuarioRepo.save(usuario);
    const { password, ...semSenha } = salvo as any;
    return semSenha;
  }

  async deletar(id: string) {
    const usuario = await this.usuarioRepo.findOneBy({ id });
    if (!usuario) throw new NotFoundException('Usuário não encontrado.');
    await this.usuarioRepo.delete(id);
    return { message: 'Usuário removido com sucesso.' };
  }
}
