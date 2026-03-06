import { 
  Controller, Post, Body, Get, Param, Patch, 
  BadRequestException, ParseIntPipe, UseGuards 
} from '@nestjs/common';
import { MatriculasService } from './matriculas.service'; 
import { StatusMatricula } from './inscricao.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; 
import { RolesGuard } from '../auth/guards/roles.guard'; 
import { Roles } from '../auth/decorators/roles.decorator'; 
import { Role } from '../auth/constants/roles.enum'; 

@Controller('matriculas')
@UseGuards(JwtAuthGuard, RolesGuard) // Proteção Global do Controller
export class MatriculasController {
  constructor(private readonly matriculasService: MatriculasService) {}

  /**
   * CONSULTA: Nível mínimo CZNH (1). 
   * Como o ADMIN é nível 10, o RolesGuard permitirá o acesso automaticamente (10 >= 1).
   */
  @Get()
  @Roles(Role.CZNH) 
  async listarInscricoes() {
    return await this.matriculasService.listarTodas();
  }

  /**
   * INCLUSÃO: Restrita a Diretores (8) para cima.
   * ADMIN (10) e VP (9) passam automaticamente pela lógica de hierarquia.
   */
  @Post('inscricao')
  @Roles(Role.DRT) 
  async receberInscricao(@Body() dados: any) {
    if (!dados?.nome_completo || !dados?.cpf) {
      throw new BadRequestException('Campos obrigatórios (nome, cpf) ausentes.');
    }
    return await this.matriculasService.receberInscricao(dados);
  }

  /**
   * EDIÇÃO E STATUS: Exige nível DRT (8).
   */
  @Patch(':id/enviar-lgpd')
  @Roles(Role.DRT) 
  async enviarLGPD(@Param('id', ParseIntPipe) id: number) {
    return await this.matriculasService.marcarComoAguardandoLGPD(id);
  }

  @Patch(':id/confirmar-lgpd')
  @Roles(Role.DRT) 
  async confirmarLGPD(@Param('id', ParseIntPipe) id: number) {
    return await this.matriculasService.confirmarAssinaturaLGPD(id);
  }

  @Patch(':id/finalizar')
  @Roles(Role.DRT) 
  async finalizarMatricula(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { cursos?: string[] }
  ) {
    return await this.matriculasService.finalizarMatricula(id, body.cursos);
  }

  @Patch(':id/status')
  @Roles(Role.DRT) 
  async atualizarStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: StatusMatricula; motivo?: string }
  ) {
    return await this.matriculasService.atualizarStatus(id, body.status, body.motivo);
  }
}