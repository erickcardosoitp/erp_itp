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
import { SupabaseService } from '../modules/supabase/supabase.service';

const UPLOAD_OPTIONS = {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req: any, file: any, cb: any) => {
    if (['image/jpeg', 'image/png', 'image/heic', 'image/heif'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestException('Use JPEG, PNG ou HEIC.'), false);
    }
  },
};

@Roles(Role.ASSIST)
@Controller('projetos')
export class ProjetosController {
  constructor(private readonly svc: ProjetosService, private readonly supabase: SupabaseService) {}

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

  // ── Checkout (estático — deve vir antes de rotas com :id) ────────────────

  @Get('checkout/:inscricao_id')
  checkout(@Param('inscricao_id') id: string) { return this.svc.checkout(id); }

  // ── Busca de reinscrição (estático — antes de :id/inscricoes) ────────────

  @Get('inscricoes/buscar')
  buscarInscricaoAnterior(
    @Query('nome') nome: string,
    @Query('nascimento') nascimento: string,
  ) {
    if (!nome || !nascimento) throw new BadRequestException('nome e nascimento são obrigatórios');
    return this.svc.buscarInscricaoAnterior(nome, nascimento);
  }

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
    const storagePath = await this.supabase.upload(file.buffer, `projeto_equipes/${eqId}.${file.mimetype.includes('png') ? 'png' : 'jpg'}`, file.mimetype);
    return this.svc.updateEquipe(id, eqId, { imagem_template: storagePath } as any);
  }

  // ── Inscrições ────────────────────────────────────────────────────────────

  @Get(':id/inscricoes')
  findInscricoes(@Param('id') id: string) { return this.svc.findInscricoes(id); }

  @Post(':id/inscricoes')
  createInscricao(@Param('id') id: string, @Body() dto: any) {
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

  // ── Documentos de inscrição ───────────────────────────────────────────────

  @Get(':id/inscricoes/:iId/documentos')
  findDocumentos(@Param('id') id: string, @Param('iId') iId: string) {
    return this.svc.findDocumentos(id, iId);
  }

  @Post(':id/inscricoes/:iId/documentos')
  @UseInterceptors(FileInterceptor('arquivo', UPLOAD_OPTIONS))
  uploadDocumento(
    @Param('id') id: string,
    @Param('iId') iId: string,
    @Body('tipo') tipo: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado.');
    if (!tipo) throw new BadRequestException('Campo tipo é obrigatório.');
    return this.svc.uploadDocumento(id, iId, tipo, file);
  }

  @Delete(':id/inscricoes/:iId/documentos/:docId')
  removeDocumento(
    @Param('id') id: string,
    @Param('iId') iId: string,
    @Param('docId') docId: string,
  ) {
    return this.svc.removeDocumento(id, iId, docId);
  }

  @Post(':id/inscricoes/:iId/documentos/declaracao-fisica')
  marcarDeclaracaoFisica(@Param('id') id: string, @Param('iId') iId: string) {
    return this.svc.marcarDeclaracaoFisica(id, iId);
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
