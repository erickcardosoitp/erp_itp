import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ProjetosService } from './projetos.service';
import { CreateProjetoDto } from './dto/create-projeto.dto';
import { CreateEquipeDto } from './dto/create-equipe.dto';
import { CreateInscricaoDto } from './dto/create-inscricao.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants/roles.enum';

@Roles(Role.ASSIST)
@Controller('projetos')
export class ProjetosController {
  constructor(private readonly svc: ProjetosService) {}

  // ── Projetos ──────────────────────────────────────────────────────────────

  @Get()
  findAll() { return this.svc.findAll(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  @Post()
  create(@Body() dto: CreateProjetoDto) { return this.svc.create(dto); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: any) { return this.svc.update(id, dto); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.svc.remove(id); }

  // ── Checkout (público com role mínimo) ───────────────────────────────────

  @Get('checkout/:inscricao_id')
  checkout(@Param('inscricao_id') id: string) { return this.svc.checkout(id); }

  // ── Equipes ───────────────────────────────────────────────────────────────

  @Get(':id/equipes')
  findEquipes(@Param('id') id: string) { return this.svc.findEquipes(id); }

  @Post(':id/equipes')
  createEquipe(@Param('id') id: string, @Body() dto: CreateEquipeDto) {
    return this.svc.createEquipe(id, dto);
  }

  @Patch(':id/equipes/:eqId')
  updateEquipe(@Param('id') id: string, @Param('eqId') eqId: string, @Body() dto: any) {
    return this.svc.updateEquipe(id, eqId, dto);
  }

  @Delete(':id/equipes/:eqId')
  removeEquipe(@Param('id') id: string, @Param('eqId') eqId: string) {
    return this.svc.removeEquipe(id, eqId);
  }

  @Post(':id/equipes/:eqId/template')
  @UseInterceptors(FileInterceptor('arquivo', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadTemplate(
    @Param('id') id: string,
    @Param('eqId') eqId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
      throw new BadRequestException('Use JPEG, PNG ou WebP.');
    const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    return this.svc.updateEquipe(id, eqId, { imagem_template: dataUrl });
  }

  // ── Inscrições ────────────────────────────────────────────────────────────

  @Get(':id/inscricoes')
  findInscricoes(@Param('id') id: string) { return this.svc.findInscricoes(id); }

  @Post(':id/inscricoes')
  createInscricao(@Param('id') id: string, @Body() dto: CreateInscricaoDto) {
    return this.svc.createInscricao(id, dto);
  }

  @Patch(':id/inscricoes/:iId')
  updateInscricao(@Param('id') id: string, @Param('iId') iId: string, @Body() dto: any) {
    return this.svc.updateInscricao(id, iId, dto);
  }

  @Delete(':id/inscricoes/:iId')
  removeInscricao(@Param('id') id: string, @Param('iId') iId: string) {
    return this.svc.removeInscricao(id, iId);
  }

  // ── Presença ──────────────────────────────────────────────────────────────

  @Get(':id/presencas')
  findPresencas(
    @Param('id') id: string,
    @Query('data') data?: string,
    @Query('equipe_id') equipe_id?: string,
  ) {
    return this.svc.findPresencas(id, data, equipe_id);
  }

  @Post(':id/presencas/:inscricaoId/:data')
  upsertPresenca(
    @Param('id') id: string,
    @Param('inscricaoId') inscricaoId: string,
    @Param('data') data: string,
    @Body() body: any,
  ) {
    return this.svc.upsertPresenca(id, inscricaoId, data, body);
  }
}
