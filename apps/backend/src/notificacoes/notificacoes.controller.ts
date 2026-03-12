import { Controller, Get, Patch, Delete, Param, Query } from '@nestjs/common';
import { NotificacoesService } from './notificacoes.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants/roles.enum';

@Controller('notificacoes')
export class NotificacoesController {
  constructor(private readonly svc: NotificacoesService) {}

  @Get()
  listar(
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
    @Query('nao_lidas') naoLidas?: string,
  ) {
    return this.svc.listar({
      pagina: pagina ? Number(pagina) : 1,
      limite: limite ? Number(limite) : 50,
      apenasNaoLidas: naoLidas === 'true',
    });
  }

  @Get('count')
  contarNaoLidas() {
    return this.svc.contarNaoLidas().then(total => ({ total }));
  }

  @Patch(':id/lida')
  marcarLida(@Param('id') id: string) {
    return this.svc.marcarLida(id);
  }

  @Patch('todas-lidas')
  marcarTodasLidas() {
    return this.svc.marcarTodasLidas();
  }

  @Delete('lidas')
  deletarTodasLidas() {
    return this.svc.deletarTodasLidas();
  }

  @Delete(':id')
  deletar(@Param('id') id: string) {
    return this.svc.deletar(id);
  }

  @Delete('manutencao/antigos')
  @Roles(Role.ADMIN)
  limparAntigos() {
    return this.svc.limparAntigos();
  }
}
