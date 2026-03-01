import { Controller, Post, Body, Get, Param, Patch, BadRequestException, ParseIntPipe } from '@nestjs/common';
import { MatriculasService } from './matriculas.service'; 
import { StatusMatricula } from './inscricao.entity';

@Controller('matriculas')
export class MatriculasController {
  constructor(private readonly matriculasService: MatriculasService) {}

  @Get()
  async listarInscricoes() {
    return await this.matriculasService.listarTodas();
  }

  @Post('inscricao')
  async receberInscricao(@Body() dados: any) {
    if (!dados?.nome_completo || !dados?.cpf) {
      throw new BadRequestException('Campos obrigatórios (nome, cpf) ausentes.');
    }
    return await this.matriculasService.receberInscricao(dados);
  }

  /**
   * Passo 1: Disparo manual do funcionário
   * Endpoint: PATCH /matriculas/:id/enviar-lgpd
   */
  @Patch(':id/enviar-lgpd')
  async enviarLGPD(@Param('id', ParseIntPipe) id: number) {
    return await this.matriculasService.marcarComoAguardandoLGPD(id);
  }

  /**
   * Passo 2: Retorno do formulário (Webhook ou confirmação manual)
   * Endpoint: PATCH /matriculas/:id/confirmar-lgpd
   */
  @Patch(':id/confirmar-lgpd')
  async confirmarLGPD(@Param('id', ParseIntPipe) id: number) {
    return await this.matriculasService.confirmarAssinaturaLGPD(id);
  }

  /**
   * Passo 3: Finalização da Matrícula (Agora aceita os cursos selecionados)
   * Endpoint: PATCH /matriculas/:id/finalizar
   */
  @Patch(':id/finalizar')
  async finalizarMatricula(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { cursos?: string[] }
  ) {
    return await this.matriculasService.finalizarMatricula(id, body.cursos);
  }

  @Patch(':id/status')
  async atualizarStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: StatusMatricula; motivo?: string }
  ) {
    return await this.matriculasService.atualizarStatus(id, body.status, body.motivo);
  }
}