import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { PublicoService } from './publico.service';

@Controller('publico')
export class PublicoController {
  constructor(private readonly svc: PublicoService) {}

  @Get('prestacao-contas')
  @Public()
  getPrestacaoContas(@Query('ano') ano?: string, @Query('mes') mes?: string) {
    return this.svc.getPrestacaoContas(ano, mes);
  }
}
