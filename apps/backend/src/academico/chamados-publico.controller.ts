import {
  Controller, Post, Get, Query, Body, BadRequestException,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { AcademicoService } from './academico.service';

@Controller('api/chamados/publico')
export class ChamadosPublicoController {
  constructor(private readonly svc: AcademicoService) {}

  @Post()
  @Public()
  async criar(@Body() body: any) {
    const { nome, email, telefone, nome_aluno, assunto, mensagem } = body;
    if (!nome?.trim() || !email?.trim() || !telefone?.trim() || !assunto?.trim() || !mensagem?.trim()) {
      throw new BadRequestException('Campos obrigatórios: nome, email, telefone, assunto, mensagem');
    }
    return this.svc.criarChamadoPublico({ nome, email, telefone, nome_aluno, assunto, mensagem });
  }

  @Get('consultar')
  @Public()
  async consultar(@Query('q') q: string) {
    if (!q?.trim() || q.trim().length < 3) {
      throw new BadRequestException('Informe pelo menos 3 caracteres para buscar');
    }
    return this.svc.consultarChamadoPublico(q);
  }
}
