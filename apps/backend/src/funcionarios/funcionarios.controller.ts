import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Headers, UseGuards, Logger,
  UnauthorizedException, BadRequestException,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModuloPermGuard } from '../auth/guards/modulo-perm.guard';
import { ModuloPerm } from '../auth/decorators/modulo-perm.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { FuncionariosService } from './funcionarios.service';

@Controller('funcionarios')
@UseGuards(JwtAuthGuard, ModuloPermGuard)
export class FuncionariosController {
  private readonly logger = new Logger(FuncionariosController.name);

  constructor(private readonly svc: FuncionariosService) {}

  @Get()
  @ModuloPerm('cadastro_basico', 'visualizar')
  listar() {
    return this.svc.listar();
  }

  @Post()
  @ModuloPerm('cadastro_basico', 'incluir')
  criar(@Body() dto: any) {
    return this.svc.criar(dto);
  }

  @Patch(':id')
  @ModuloPerm('cadastro_basico', 'editar')
  editar(@Param('id') id: string, @Body() dto: any) {
    return this.svc.editar(id, dto);
  }

  @Delete(':id')
  @ModuloPerm('cadastro_basico', 'excluir')
  deletar(@Param('id') id: string) {
    return this.svc.deletar(id);
  }

  @Patch(':id/foto')
  @ModuloPerm('cadastro_basico', 'editar')
  async uploadFoto(@Param('id') id: string, @Body() body: { foto: string }) {
    if (!body?.foto) throw new BadRequestException('Nenhuma foto enviada.');
    if (!body.foto.startsWith('data:image/')) throw new BadRequestException('Formato inválido. Envie uma imagem em base64.');
    return this.svc.uploadFoto(id, body.foto);
  }


  @Post('test-email')
  @Public()
  async testEmail() {
    const email = 'goncalvecardoso@gmail.com';
    const nome = 'Teste Cardoso';
    const matricula = 'ITP-FUNC-202603-999';
    try {
      await this.svc.emailService.enviarConfirmacaoCadastroFuncionario(email, nome, matricula);
      return { ok: true, email, nome, matricula };
    } catch (e) {
      this.logger.error('Erro ao enviar e-mail de teste', (e as any)?.stack);
      return { ok: false, error: (e as any)?.message };
    }
  }
}
