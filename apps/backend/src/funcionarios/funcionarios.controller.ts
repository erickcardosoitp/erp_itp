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
    const dto = {
      nome:                   payload.nome,
      cargo:                  payload.cargo,
      email:                  payload.email,
      cpf:                    payload.cpf,
      data_nascimento:        payload.data_nascimento,
      celular:                payload.celular,
      sexo:                   payload.sexo,
      raca_cor:               payload.raca_cor,
      escolaridade:           payload.escolaridade,
      cep:                    payload.cep,
      numero_residencia:      payload.numero_residencia,
      complemento:            payload.complemento,
      estado:                 payload.estado,
      telefone_emergencia_1:  payload.telefone_emergencia_1,
      telefone_emergencia_2:  payload.telefone_emergencia_2,
      possui_deficiencia:     payload.possui_deficiencia === true,
      deficiencia_descricao:  payload.deficiencia_descricao,
      possui_alergias:        payload.possui_alergias === true,
      alergias_descricao:     payload.alergias_descricao,
      usa_medicamentos:       payload.usa_medicamentos === true,
      medicamentos_descricao: payload.medicamentos_descricao,
      interesse_cursos:       payload.interesse_cursos === true,
      ativo:                  true,
    };
    this.logger.log(`[Webhook Google Forms] Cadastrando funcionário: ${dto.nome}`);
    return this.svc.criar(dto);
  }
}
