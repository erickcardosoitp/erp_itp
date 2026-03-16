import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Headers, UseGuards, Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants/roles.enum';
import { Public } from '../auth/decorators/public.decorator';
import { FuncionariosService } from './funcionarios.service';

@Controller('funcionarios')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FuncionariosController {
  private readonly logger = new Logger(FuncionariosController.name);

  constructor(private readonly svc: FuncionariosService) {}

  @Get()
  @Roles(Role.CZNH)
  listar() {
    return this.svc.listar();
  }

  @Post()
  @Roles(Role.DRT)
  criar(@Body() dto: any) {
    return this.svc.criar(dto);
  }

  @Patch(':id')
  @Roles(Role.DRT)
  editar(@Param('id') id: string, @Body() dto: any) {
    return this.svc.editar(id, dto);
  }

  @Delete(':id')
  @Roles(Role.DRT)
  deletar(@Param('id') id: string) {
    return this.svc.deletar(id);
  }

  // ── WEBHOOK: Google Forms → Cadastro de Funcionário (rota pública) ────────
  @Public()
  @Post('webhook')
  async webhookGoogleForms(
    @Headers('x-itp-webhook-secret') secret: string,
    @Body() payload: any,
  ) {
    const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'itp-forms-2026';
    if (secret !== WEBHOOK_SECRET) {
      throw new UnauthorizedException('Secret inválido.');
    }

    // Normaliza os nomes dos campos — o GAS pode enviar variantes diferentes
    const p = payload;
    const dto = {
      nome:                   p.nome,
      cargo:                  p.cargo,
      email:                  p.email,
      cpf:                    p.cpf,
      data_nascimento:        p.data_nascimento,
      celular:                p.celular,
      sexo:                   p.sexo,
      // "raca" (GAS) ou "raca_cor" (legado)
      raca_cor:               p.raca ?? p.raca_cor,
      escolaridade:           p.escolaridade,
      cep:                    p.cep,
      // "endereco" (GAS) ou "logradouro" (legado)
      logradouro:             p.endereco ?? p.logradouro,
      // "numero" (GAS) ou "numero_residencia" (legado)
      numero_residencia:      p.numero ?? p.numero_residencia,
      bairro:                 p.bairro,
      cidade:                 p.cidade,
      complemento:            p.complemento,
      estado:                 p.estado,
      telefone_emergencia_1:  p.telefone_emergencia_1,
      telefone_emergencia_2:  p.telefone_emergencia_2,
      // booleans: aceita true/false ou string "sim"
      possui_deficiencia:    p.possui_deficiencia === true || String(p.possui_deficiencia).toLowerCase() === 'sim',
      // "descricao_deficiencia" (GAS) ou "deficiencia_descricao" (legado)
      deficiencia_descricao: p.descricao_deficiencia ?? p.deficiencia_descricao,
      // "possui_alergia" (GAS singular) ou "possui_alergias" (legado)
      possui_alergias:       p.possui_alergia === true || p.possui_alergias === true
                               || String(p.possui_alergia ?? '').toLowerCase() === 'sim'
                               || String(p.possui_alergias ?? '').toLowerCase() === 'sim',
      // "descricao_alergia" (GAS) ou "alergias_descricao" (legado)
      alergias_descricao:    p.descricao_alergia ?? p.alergias_descricao,
      // "usa_medicamento" (GAS singular) ou "usa_medicamentos" (legado)
      usa_medicamentos:      p.usa_medicamento === true || p.usa_medicamentos === true
                               || String(p.usa_medicamento ?? '').toLowerCase() === 'sim'
                               || String(p.usa_medicamentos ?? '').toLowerCase() === 'sim',
      // "descricao_medicamento" (GAS) ou "medicamentos_descricao" (legado)
      medicamentos_descricao: p.descricao_medicamento ?? p.medicamentos_descricao,
      // Campos de saúde adicionais do GAS
      possui_plano_saude:    p.possui_plano_saude === true || String(p.possui_plano_saude ?? '').toLowerCase() === 'sim',
      plano_saude:           p.plano_saude,
      numero_sus:            p.numero_sus,
      interesse_cursos:      p.interesse_cursos === true || String(p.interesse_cursos ?? '').toLowerCase() === 'sim',
      ativo:                 true,
    };
    this.logger.log(`[Webhook Google Forms] Cadastrando funcionário: ${dto.nome}`);
    return this.svc.criarViaWebhook(dto);
  }

  /**
   * Endpoint temporário para testar envio de e-mail de confirmação de cadastro de funcionário.
   * POST /funcionarios/test-email
   */
  @Post('test-email')
  @Public()
  async testEmail() {
    const email = 'goncalvecardoso@gmail.com';
    const nome = 'Teste Cardoso';
    const matricula = 'ITP-FUNC-202603-999';
    try {
      await this.svc.emailService.enviarConfirmacaoCadastroFuncionario(email, nome, matricula);
      return { ok: true, email, nome, matricula };
    } catch (e) {
      this.logger.error('Erro ao enviar e-mail de teste', (e as any)?.stack);
      return { ok: false, error: (e as any)?.message };
    }
  }
}

