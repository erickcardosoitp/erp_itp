import { Controller, Post, Get, Query, Body } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { AcademicoService } from './academico.service';
import { CriarChamadoPublicoDto } from './dto/criar-chamado-publico.dto';

@Controller('api/chamados/publico')
export class ChamadosPublicoController {
  constructor(private readonly svc: AcademicoService) {}

  @Post()
  @Public()
  async criar(@Body() dto: CriarChamadoPublicoDto) {
    return this.svc.criarChamadoPublico(dto);
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
