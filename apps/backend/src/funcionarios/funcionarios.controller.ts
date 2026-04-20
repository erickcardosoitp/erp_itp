import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Headers, UseGuards, Logger,
  UnauthorizedException, BadRequestException,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModuloPermGuard } from '../auth/guards/modulo-perm.guard';
import { ModuloPerm } from '../auth/decorators/modulo-perm.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { FuncionariosService } from './funcionarios.service';

@Controller('funcionarios')
@UseGuards(JwtAuthGuard, ModuloPermGuard)
export class FuncionariosController {
  private readonly logger = new Logger(FuncionariosController.name);

  constructor(private readonly svc: FuncionariosService) {}

  @Get()
  @ModuloPerm('cadastro_basico', 'visualizar')
  listar() {
    return this.svc.listar();
  }

  @Post()
  @ModuloPerm('cadastro_basico', 'incluir')
  criar(@Body() dto: any) {
    return this.svc.criar(dto);
  }

  @Patch(':id')
  @ModuloPerm('cadastro_basico', 'editar')
  editar(@Param('id') id: string, @Body() dto: any) {
    return this.svc.editar(id, dto);
  }

  @Delete(':id')
  @ModuloPerm('cadastro_basico', 'excluir')
  deletar(@Param('id') id: string) {
    return this.svc.deletar(id);
  }

  @Patch(':id/foto')
  @ModuloPerm('cadastro_basico', 'editar')
  async uploadFoto(@Param('id') id: string, @Body() body: { foto: string }) {
    if (!body?.foto) throw new BadRequestException('Nenhuma foto enviada.');
    if (!body.foto.startsWith('data:image/')) throw new BadRequestException('Formato inválido. Envie uma imagem em base64.');
    return this.svc.editar(id, { foto: body.foto } as any);
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

    const p = payload;
    const dto = {
      nome:                   p.nome,
      cargo:                  p.cargo,
      email:                  p.email,
      cpf:                    p.cpf,
      data_nascimento:        p.data_nascimento,
      celular:                p.celular,
      sexo:                   p.sexo,
      raca_cor:               p.raca ?? p.raca_cor,
      escolaridade:           p.escolaridade,
      cep:                    p.cep,
      logradouro:             p.endereco ?? p.logradouro,
      numero_residencia:      p.numero ?? p.numero_residencia,
      bairro:                 p.bairro,
      cidade:                 p.cidade,
      complemento:            p.complemento,
      estado:                 p.estado,
      telefone_emergencia_1:  p.telefone_emergencia_1,
      telefone_emergencia_2:  p.telefone_emergencia_2,
      possui_deficiencia:    p.possui_deficiencia === true || String(p.possui_deficiencia).toLowerCase() === 'sim',
      deficiencia_descricao: p.descricao_deficiencia ?? p.deficiencia_descricao,
      possui_alergias:       p.possui_alergia === true || p.possui_alergias === true
                               || String(p.possui_alergia ?? '').toLowerCase() === 'sim'
                               || String(p.possui_alergias ?? '').toLowerCase() === 'sim',
      alergias_descricao:    p.descricao_alergia ?? p.alergias_descricao,
      usa_medicamentos:      p.usa_medicamento === true || p.usa_medicamentos === true
                               || String(p.usa_medicamento ?? '').toLowerCase() === 'sim'
                               || String(p.usa_medicamentos ?? '').toLowerCase() === 'sim',
      medicamentos_descricao: p.descricao_medicamento ?? p.medicamentos_descricao,
      possui_plano_saude:    p.possui_plano_saude === true || String(p.possui_plano_saude ?? '').toLowerCase() === 'sim',
      plano_saude:           p.plano_saude,
      numero_sus:            p.numero_sus,
      interesse_cursos:           p.interesse_cursos === true || String(p.interesse_cursos ?? '').toLowerCase() === 'sim',
      genero:                     p.genero,
      pertence_comunidade_tradicional: p.pertence_comunidade_tradicional === true || String(p.pertence_comunidade_tradicional ?? '').toLowerCase() === 'sim',
      comunidade_tradicional:     p.comunidade_tradicional,
      possui_cad_unico:           p.possui_cad_unico === true || String(p.possui_cad_unico ?? '').toLowerCase() === 'sim',
      baixo_idh:                  p.baixo_idh === true || String(p.baixo_idh ?? '').toLowerCase() === 'sim',
      ativo:                      true,
    };
    this.logger.log(`[Webhook Google Forms] Cadastrando funcionário: ${dto.nome}`);
    return this.svc.criarViaWebhook(dto);
  }

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
