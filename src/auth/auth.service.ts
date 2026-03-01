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
   * Registra um novo usuário com Hash Bcrypt
   */
  async registrar(dados: any) {
    const { email, password, nome, role } = dados;

    const usuarioExistente = await this.usuarioRepository.findOneBy({ email });
    if (usuarioExistente) {
      throw new ConflictException('Este e-mail já está cadastrado no sistema.');
    }

    // Gerando o hash da senha
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const novoUsuario = this.usuarioRepository.create({
      nome,
      email,
      password: hashedPassword, // Certifique-se que na Entity é 'password'
      role: role || 'assistente', // Valor default caso não venha no body
    });

    const salvo = await this.usuarioRepository.save(novoUsuario);
    
    // Remove a senha do retorno de forma segura
    const { password: _, ...usuarioSemSenha } = salvo;
    return usuarioSemSenha;
  }

  /**
   * Valida credenciais e gera o Token JWT para o ERP
   */
  async login(email: string, pass: string) {
    if (!email || !pass) {
      throw new UnauthorizedException('E-mail e senha são obrigatórios.');
    }

    // Busca o usuário. O addSelect é vital se a entity tiver { select: false }
    const usuario = await this.usuarioRepository.createQueryBuilder('user')
      .addSelect('user.password') 
      .where('user.email = :email', { email: email.toLowerCase().trim() })
      .getOne();

    if (!usuario) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const isMatch = await bcrypt.compare(pass, usuario.password);
    if (!isMatch) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    // Payload que o Front-end vai decodificar para o Menu Lateral
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