import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { PesquisasService } from './pesquisas.service';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModuloPermGuard } from '../auth/guards/modulo-perm.guard';
import { ModuloPerm } from '../auth/decorators/modulo-perm.decorator';

@Controller('pesquisas')
@UseGuards(JwtAuthGuard, ModuloPermGuard)
export class PesquisasController {
  constructor(private readonly svc: PesquisasService) {}

  // ── NPS público (qualquer usuário autenticado com acesso ao módulo) ───────

  @Get('nps')
  @ModuloPerm('pesquisas', 'visualizar')
  nps() {
    return this.svc.npsAtual();
  }

  // ── Endpoints protegidos ──────────────────────────────────────────────────

  @Post()
  @ModuloPerm('pesquisas', 'incluir')
  criar(@Body() dto: any, @Req() req: any) {
    const usuario = { id: req.user?.userId || req.user?.sub, nome: req.user?.nome || req.user?.email };
    return this.svc.criar(dto, usuario);
  }

  @Get()
  @ModuloPerm('pesquisas', 'visualizar')
  listar() {
    return this.svc.listar();
  }

  @Get(':id/resultados')
  @ModuloPerm('pesquisas', 'visualizar')
  resultados(@Param('id') id: string) {
    return this.svc.buscarResultados(id);
  }

  @Patch(':id/encerrar')
  @ModuloPerm('pesquisas', 'editar')
  encerrar(@Param('id') id: string) {
    return this.svc.encerrar(id);
  }

  @Patch(':id/reiniciar')
  @ModuloPerm('pesquisas', 'editar')
  reiniciar(@Param('id') id: string) {
    return this.svc.reiniciar(id);
  }

  @Patch('respostas/:id/expurgar')
  @ModuloPerm('pesquisas', 'editar')
  expurgar(@Param('id') id: string, @Body() body: { expurgado: boolean }) {
    return this.svc.expurgarResposta(id, body.expurgado ?? true);
  }

  @Delete(':id')
  @ModuloPerm('pesquisas', 'excluir')
  deletar(@Param('id') id: string) {
    return this.svc.deletar(id);
  }

  // ── Endpoints públicos (sem autenticação) ─────────────────────────────────

  @Public()
  @Get('publica/:link')
  buscarPublico(@Param('link') link: string) {
    return this.svc.buscarPublico(link);
  }

  @Public()
  @Post('publica/:link/responder')
  responder(@Param('link') link: string, @Body() body: any) {
    return this.svc.responder(link, body.respostas);
  }
}
