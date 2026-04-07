import { Controller, Get, Post, Patch, Delete, Body, Param, Req } from '@nestjs/common';
import { PesquisasService } from './pesquisas.service';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants/roles.enum';
// Role.USER is the lowest role — used for endpoints any logged-in user can access

@Controller('pesquisas')
export class PesquisasController {
  constructor(private readonly svc: PesquisasService) {}

  // ── NPS público (qualquer usuário autenticado) ────────────────────────────

  @Get('nps')
  @Roles(Role.USER)
  nps() {
    return this.svc.npsAtual();
  }

  // ── Endpoints protegidos (DRT / VP / ADMIN) ───────────────────────────────

  @Post()
  @Roles(Role.DRT)
  criar(@Body() dto: any, @Req() req: any) {
    const usuario = { id: req.user?.userId || req.user?.sub, nome: req.user?.nome || req.user?.email };
    return this.svc.criar(dto, usuario);
  }

  @Get()
  @Roles(Role.DRT)
  listar() {
    return this.svc.listar();
  }

  @Get(':id/resultados')
  @Roles(Role.DRT)
  resultados(@Param('id') id: string) {
    return this.svc.buscarResultados(id);
  }

  @Patch(':id/encerrar')
  @Roles(Role.DRT)
  encerrar(@Param('id') id: string) {
    return this.svc.encerrar(id);
  }

  @Patch(':id/reiniciar')
  @Roles(Role.ADMIN)
  reiniciar(@Param('id') id: string) {
    return this.svc.reiniciar(id);
  }

  @Patch('respostas/:id/expurgar')
  @Roles(Role.DRT)
  expurgar(@Param('id') id: string, @Body() body: { expurgado: boolean }) {
    return this.svc.expurgarResposta(id, body.expurgado ?? true);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
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
