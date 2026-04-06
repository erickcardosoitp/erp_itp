import { Injectable, ConflictException, UnauthorizedException, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from '../usuarios/usuario.entity';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from '../email.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
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
  async login(identifier: string, pass: string, lembrar = false) {
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

    // Conta ADMIN só pode entrar via matrícula — nunca por e-mail
    if (isEmail && usuario.role === 'admin') {
      this.logger.warn(`⛔ Tentativa de login ADM por e-mail bloqueada: ${id}`);
      throw new UnauthorizedException('Conta administrativa. Use a matrícula para entrar.');
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

      this.logger.log(`✅ Login realizado: ${id} [Cargo: ${roleLimpa}]`);

      // Inclui flag de troca obrigatória de senha no payload e na resposta
      const deveTracar = Boolean((usuario as any).deve_trocar_senha);
      const payloadComFlag = { ...payload, deve_trocar_senha: deveTracar };

      // "Lembrar acesso" → token de 30 dias; caso contrário → 8 horas
      const expiresIn = lembrar ? '30d' : '8h';

      return {
        access_token: await this.jwtService.signAsync(payloadComFlag, { expiresIn }),
        usuario: { ...usuarioSemSenha, deve_trocar_senha: deveTracar },
        deve_trocar_senha: deveTracar,
      };
    } catch (err: any) {
      this.logger.error(`💥 Erro interno no processo de login: ${err.message}`);
      throw new UnauthorizedException('Erro ao validar credenciais.');
    }
  }

  /**
   * PERFIL: Retorna os dados completos do usuário pelo ID (sub do JWT).
   */
  async getProfile(userId: string) {
    const usuario = await this.usuarioRepository.findOne({
      where: { id: userId },
      relations: ['grupo'],
      select: ['id', 'nome', 'email', 'fotoUrl', 'matricula', 'role', 'deve_trocar_senha', 'createdAt', 'updatedAt', 'grupo'],
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
  async updateProfile(userId: string, data: { nome?: string; fotoUrl?: string }) {
    const usuario = await this.usuarioRepository.findOne({
      where: { id: userId },
      relations: ['grupo'], 
    });

    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    if (data.nome) usuario.nome = data.nome;
    if (data.fotoUrl) usuario.fotoUrl = data.fotoUrl;

    await this.usuarioRepository.save(usuario);
    
    this.logger.log(`Perfil atualizado: ${usuario.matricula}`);

    const { password, ...usuarioSemSenha } = usuario;
    return usuarioSemSenha;
  }

  /**
   * ESQUECI SENHA: Gera token de reset e envia por e-mail.
   * Por segurança, sempre retorna a mesma mensagem (não confirma se o e-mail existe).
   */
  async solicitarReset(email: string): Promise<{ message: string }> {
    const usuario = await this.usuarioRepository
      .createQueryBuilder('u')
      .addSelect('u.resetToken')
      .addSelect('u.resetTokenExpires')
      .where('LOWER(u.email) = LOWER(:email)', { email: email.trim() })
      .getOne();

    if (usuario) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

      await this.usuarioRepository.update(usuario.id, {
        resetToken: token,
        resetTokenExpires: expires,
      });

      if (usuario.email) {
        try {
          await this.emailService.enviarResetSenha(usuario.email, usuario.nome, token);
        } catch (err: any) {
          this.logger.error(`Falha ao enviar e-mail de reset: ${err.message}`);
        }
        this.logger.log(`🔑 Token de reset gerado para: ${usuario.email}`);
      }
    }

    return { message: 'Se este e-mail estiver cadastrado, você receberá as instruções em breve.' };
  }

  /**
   * RESETAR SENHA: Valida o token e atualiza a senha.
   */
  async resetarSenha(token: string, novaSenha: string): Promise<{ message: string }> {
    if (!token || !novaSenha || novaSenha.length < 6) {
      throw new BadRequestException('Token e nova senha (mínimo 6 caracteres) são obrigatórios.');
    }

    const usuario = await this.usuarioRepository
      .createQueryBuilder('u')
      .addSelect('u.resetToken')
      .addSelect('u.resetTokenExpires')
      .where('u.resetToken = :token', { token })
      .getOne();

    if (!usuario || !usuario.resetToken || !usuario.resetTokenExpires) {
      throw new BadRequestException('Link de recuperação inválido ou expirado.');
    }

    if (new Date() > new Date(usuario.resetTokenExpires)) {
      throw new BadRequestException('Este link de recuperação expirou. Solicite um novo.');
    }

    const hashedPassword = await bcrypt.hash(novaSenha, 10);

    await this.usuarioRepository.update(usuario.id, {
      password: hashedPassword,
      resetToken: null as any,
      resetTokenExpires: null as any,
    });

    this.logger.log(`✅ Senha redefinida para usuário: ${usuario.email}`);
    return { message: 'Senha redefinida com sucesso! Você já pode fazer login.' };
  }

  // ─────────────────────────────────────────────────────────────────────
  //  Validação de senha forte (14 chars, maiúscula, minúscula, número, símbolo)
  // ─────────────────────────────────────────────────────────────────────

  private validarSenhaForte(senha: string): void {
    if (senha.length < 14) {
      throw new BadRequestException('A senha deve ter pelo menos 14 caracteres.');
    }
    if (!/[A-Z]/.test(senha)) {
      throw new BadRequestException('A senha deve conter pelo menos uma letra maiúscula.');
    }
    if (!/[a-z]/.test(senha)) {
      throw new BadRequestException('A senha deve conter pelo menos uma letra minúscula.');
    }
    if (!/[0-9]/.test(senha)) {
      throw new BadRequestException('A senha deve conter pelo menos um número.');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(senha)) {
      throw new BadRequestException('A senha deve conter pelo menos um símbolo especial (!@#$%...). ');
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  //  Troca obrigatória de senha (requer auth + valida critérios MFA)
  // ─────────────────────────────────────────────────────────────────────

  async trocarSenha(userId: string, novaSenha: string, senhaAtual?: string): Promise<{ message: string }> {
    this.validarSenhaForte(novaSenha);

    const usuario = await this.usuarioRepository
      .createQueryBuilder('u')
      .addSelect('u.password')
      .where('u.id = :id', { id: userId })
      .getOne();

    if (!usuario) throw new NotFoundException('Usuário não encontrado.');

    // Se o usuário forneceu a senha atual, valida-a (exceto quando deve_trocar_senha=true e não tem senha atual)
    if (senhaAtual && usuario.password) {
      const ok = await bcrypt.compare(senhaAtual, usuario.password);
      if (!ok) throw new UnauthorizedException('Senha atual incorreta.');
    }

    const hashedPassword = await bcrypt.hash(novaSenha, 12);
    await this.usuarioRepository.update(userId, {
      password: hashedPassword,
      deve_trocar_senha: false,
    });

    this.logger.log(`✅ Senha trocada com sucesso: ${usuario.email}`);
    return { message: 'Senha atualizada com sucesso!' };
  }

  // ─────────────────────────────────────────────────────────────────────
  //  Criar usuário a partir de um funcionário (chamado pelo admin)
  // ─────────────────────────────────────────────────────────────────────

  async criarUsuarioParaFuncionario(dto: {
    funcionario_id: string;
    role?: string;
    grupo_id?: string;
  }): Promise<{ usuario: Partial<Usuario>; senha_inicial: string }> {
    // Busca funcionário via query direta (sem injetar FuncionariosService para evitar dependência circular)
    const rows: any[] = await this.usuarioRepository.manager.query(
      `SELECT * FROM funcionarios WHERE id = $1`,
      [dto.funcionario_id],
    );
    const func = rows[0];
    if (!func) throw new NotFoundException('Funcionário não encontrado.');
    if (func.usuario_id) throw new ConflictException('Este funcionário já possui um usuário de sistema.');
    if (!func.email) throw new BadRequestException('O funcionário não possui e-mail cadastrado para criar o acesso.');

    const emailExiste = await this.usuarioRepository.findOneBy({ email: func.email.toLowerCase() });
    if (emailExiste) throw new ConflictException(`O e-mail ${func.email} já está cadastrado no sistema.`);

    // Gera matrícula com prefixo que reflete o cargo na hierarquia
    const now = new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const total = await this.usuarioRepository.count();
    const seq = String(total + 1).padStart(3, '0');
    const rolePrefix: Record<string, string> = {
      admin: 'ITP-ADM', vp: 'ITP-VP', drt: 'ITP-DRT', adjunto: 'ITP-ADJ',
      prof: 'ITP-PROF', monitor: 'ITP-MNT', assist: 'ITP-AST', cozinha: 'ITP-CZNH',
    };
    const prefix = rolePrefix[dto.role?.toLowerCase() ?? ''] ?? 'ITP-USR';
    const matricula = `${prefix}-${yyyymm}-${seq}`;

    // Senha inicial = YYYYMMDD da data de nascimento ou data atual
    let senhaInicial = now.toISOString().slice(0, 10).replace(/-/g, '');
    if (func.data_nascimento) {
      const d = String(func.data_nascimento).replace(/-/g, '').slice(0, 8);
      if (d.length === 8) senhaInicial = d;
    }

    const hashedPassword = await bcrypt.hash(senhaInicial, 12);

    const novoUsuario = this.usuarioRepository.create({
      nome: func.nome,
      email: func.email.toLowerCase(),
      password: hashedPassword,
      matricula,
      funcionario_id: func.id,
      role: dto.role ?? 'assistente',
      deve_trocar_senha: true,
    });

    const salvo = await this.usuarioRepository.save(novoUsuario);

    // Vincula usuario_id no funcionário
    await this.usuarioRepository.manager.query(
      `UPDATE funcionarios SET usuario_id = $1 WHERE id = $2`,
      [salvo.id, func.id],
    );

    this.logger.log(`👤 Usuário criado para funcionário ${func.nome} | Login: ${matricula}`);

    // Envia e-mail com credenciais
    try {
      await this.emailService.enviarAcessoSistema(func.email, func.nome, matricula, senhaInicial);
    } catch (err: any) {
      this.logger.error(`Erro ao enviar e-mail de acesso: ${err.message}`);
    }

    const { password, resetToken, resetTokenExpires, ...semSenha } = salvo as any;
    return { usuario: semSenha, senha_inicial: senhaInicial };
  }

  // ─────────────────────────────────────────────────────────────────────
  //  Cron: envia e-mails de lembrete para usuários com deve_trocar_senha=true
  // ─────────────────────────────────────────────────────────────────────

  async enviarLembretesSenhaFraca(): Promise<{ total: number }> {
    const pendentes = await this.usuarioRepository.find({
      where: { deve_trocar_senha: true },
      select: ['id', 'nome', 'email'],
    });

    let enviados = 0;
    for (const u of pendentes) {
      if (!u.email) continue;
      try {
        await this.emailService.enviarLembreteSenhaFraca(u.email, u.nome);
        enviados++;
      } catch (err: any) {
        this.logger.error(`Erro lembrete senha fraca ${u.email}: ${err.message}`);
      }
    }

    this.logger.log(`📧 Lembretes de senha fraca enviados: ${enviados}/${pendentes.length}`);
    return { total: enviados };
  }
}