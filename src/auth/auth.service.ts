import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from '../usuarios/usuario.entity';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Registra um novo usuário no ITP (Admin, Professor ou Assistente)
   */
  async registrar(dados: any) {
    const { email, password, nome, role } = dados;

    // 1. Verifica duplicidade
    const usuarioExistente = await this.usuarioRepository.findOneBy({ email });
    if (usuarioExistente) {
      throw new ConflictException('Este e-mail já está cadastrado no sistema.');
    }

    // 2. Hash da senha para segurança (Sprint 1)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Persistência no Neon
    const novoUsuario = this.usuarioRepository.create({
      nome,
      email,
      password: hashedPassword,
      role,
    });

    const salvo = await this.usuarioRepository.save(novoUsuario);

    // CORREÇÃO TS2790: Usando desestruturação para remover a senha do retorno
    const { password: _, ...usuarioSemSenha } = salvo;
    
    return usuarioSemSenha;
  }

  /**
   * Valida credenciais e gera o Token JWT
   */
  async login(email: string, pass: string) {
    // Busca o usuário incluindo a senha (que está com select: false na entity)
    const usuario = await this.usuarioRepository.createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();

    if (!usuario) {
      throw new UnauthorizedException('E-mail ou senha incorretos.');
    }

    // Compara senha digitada com o hash do banco
    const isMatch = await bcrypt.compare(pass, usuario.password);
    if (!isMatch) {
      throw new UnauthorizedException('E-mail ou senha incorretos.');
    }

    // Payload do Token (Sprint 1 - Identificação e Role)
    const payload = { 
      sub: usuario.id, 
      email: usuario.email, 
      role: usuario.role 
    };

    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: usuario.id,
        nome: usuario.nome,
        role: usuario.role,
      },
    };
  }
}