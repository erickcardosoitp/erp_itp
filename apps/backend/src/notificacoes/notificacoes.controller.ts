import { Controller, Get, Patch, Delete, Param, Query, Req, UseGuards } from '@nestjs/common';
import { NotificacoesService } from './notificacoes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModuloPermGuard } from '../auth/guards/modulo-perm.guard';
import { ModuloPerm } from '../auth/decorators/modulo-perm.decorator';
import { Role, RoleLevel } from '../auth/constants/roles.enum';

@Controller('notificacoes')
@UseGuards(JwtAuthGuard, ModuloPermGuard)
export class NotificacoesController {
  constructor(private readonly svc: NotificacoesService) {}

  @Get()
  listar(
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
    @Query('nao_lidas') naoLidas?: string,
    @Req() req?: any,
  ) {
    const nivelRole = RoleLevel[req?.user?.role ?? ''] ?? 0;
    return this.svc.listar({
      pagina: pagina ? Number(pagina) : 1,
      limite: limite ? Number(limite) : 50,
      apenasNaoLidas: naoLidas === 'true',
      nivelRole,
    });
  }

  @Get('count')
  contarNaoLidas(@Req() req?: any) {
    const nivelRole = RoleLevel[req?.user?.role ?? ''] ?? 0;
    return this.svc.contarNaoLidas(nivelRole).then(total => ({ total }));
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
  @ModuloPerm('notificacoes', 'excluir')
  limparAntigos() {
    return this.svc.limparAntigos();
  }
}
