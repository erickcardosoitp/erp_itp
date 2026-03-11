import { Injectable, ConflictException, UnauthorizedException, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from '../usuarios/usuario.entity';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * REGISTRO: Novos usuários entram com cargo 'assist'.
   */
  async registrar(dados: any) {
    const { email, password, senha, nome } = dados;
    const pass = password || senha;

    if (!email || !pass) {
      throw new ConflictException('E-mail e senha são obrigatórios.');
    }

    const emailNormalizado = email.toLowerCase().trim();
    const existe = await this.usuarioRepository.findOneBy({ email: emailNormalizado });
    
    if (existe) {
      throw new ConflictException('E-mail já registrado no Instituto.');
    }

    // Gerando hash seguro
    const hashedPassword = await bcrypt.hash(pass, 10);

    const usuario = this.usuarioRepository.create({
      nome,
      email: emailNormalizado,
      password: hashedPassword,
      role: 'assist', 
    });

    const salvo = await this.usuarioRepository.save(usuario);
    this.logger.log(`Novo usuário registrado: ${emailNormalizado}`);

    return {
      id: salvo.id,
      nome: salvo.nome,
      email: salvo.email,
      role: salvo.role,
    };
  }

  /**
   * LOGIN: Autentica com e-mail OU matrícula (ITP-...).
   * ✅ Corrigido para evitar o erro "argument name is invalid"
   */
  async login(identifier: string, pass: string) {
    // 1. Validação de Pré-voo
    if (!identifier || !pass || identifier.trim() === '' || pass.trim() === '') {
      throw new UnauthorizedException('Identificador e senha devem ser preenchidos.');
    }

    const id = identifier.trim();
    const isEmail = id.includes('@');

    const qb = this.usuarioRepository.createQueryBuilder('user')
      .addSelect('user.password')
      .leftJoinAndSelect('user.grupo', 'grupo');

    if (isEmail) {
      qb.where('LOWER(user.email) = LOWER(:email)', { email: id });
    } else {
      qb.where('user.matricula = :matricula', { matricula: id });
    }

    const usuario = await qb.getOne();

    if (!usuario) {
      this.logger.warn(`Tentativa de login falhou: usuário '${id}' não encontrado.`);
      throw new UnauthorizedException('Credenciais incorretas.');
    }

    // 2. Verificação de Integridade do Hash
    if (!usuario.password) {
      this.logger.error(`❌ Usuário '${id}' está sem senha definida no banco de dados!`);
      throw new UnauthorizedException('Problema na conta de acesso. Contate o administrador.');
    }

    try {
      // 3. Comparação Bcrypt (Onde o erro "argument name is invalid" ocorria)
      const isPasswordValid = await bcrypt.compare(pass, usuario.password);

      if (!isPasswordValid) {
        throw new UnauthorizedException('Credenciais incorretas.');
      }

      // 4. Sanitização do Cargo (Normaliza 'aadmin' -> 'admin' e remove espaços)
      const roleLimpa = String(usuario.role || 'assist')
        .toLowerCase()
        .trim()
        .replace(/^aadmin$/, 'admin'); 

      // 5. Montagem do Payload JWT
      const payload = { 
        sub: usuario.id, 
        email: usuario.email, 
        role: roleLimpa,
        grupo: usuario.grupo?.nome || 'SEM_GRUPO',
        permissoes: usuario.grupo?.grupo_permissoes || {} 
      };
      
      const { password, ...usuarioSemSenha } = usuario;
      usuarioSemSenha.role = roleLimpa; // Atualiza o objeto de retorno também

      this.logger.log(`✅ Login realizado: ${email} [Cargo: ${roleLimpa}]`);

      return {
        access_token: await this.jwtService.signAsync(payload),
        usuario: usuarioSemSenha 
      };
    } catch (err: any) {
      this.logger.error(`💥 Erro interno no processo de login: ${err.message}`);
      throw new UnauthorizedException('Erro ao validar credenciais.');
    }
  }

  /**
   * PERFIL: Retorna os dados completos do usuário pelo email.
   */
  async getProfile(email: string) {
    const usuario = await this.usuarioRepository.findOne({
      where: { email: email.toLowerCase().trim() },
      relations: ['grupo'],
    });

    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const { password, ...usuarioSemSenha } = usuario;
    return usuarioSemSenha;
  }

  /**
   * ATUALIZAÇÃO DE PERFIL: Nome e Foto.
   */
  async updateProfile(email: string, data: { nome?: string; fotoUrl?: string }) {
    const usuario = await this.usuarioRepository.findOne({
      where: { email: email.toLowerCase().trim() },
      relations: ['grupo'], 
    });

    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    if (data.nome) usuario.nome = data.nome;
    if (data.fotoUrl) usuario.fotoUrl = data.fotoUrl;

    await this.usuarioRepository.save(usuario);
    
    this.logger.log(`Perfil atualizado: ${email}`);

    const { password, ...usuarioSemSenha } = usuario;
    return usuarioSemSenha;
  }
}