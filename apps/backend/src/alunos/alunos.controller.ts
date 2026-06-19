import {
  Controller, Get, Post, Patch, Param, Body, ParseUUIDPipe, Req,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants/roles.enum';
import { AlunosService } from './alunos.service';
import { UpsertComplementoDto } from './dto/upsert-complemento.dto';
import { EnviarDocumentoDto, ValidarDocumentoDto, InvalidarDocumentoDto } from './dto/enviar-documento.dto';

@Controller('alunos')
export class AlunosController {
  constructor(private readonly svc: AlunosService) {}

  // ── Complemento ───────────────────────────────────────────────────

  @Get(':id/complemento')
  getComplemento(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getComplemento(id);
  }

  @Patch(':id/complemento')
  upsertComplemento(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertComplementoDto,
  ) {
    return this.svc.upsertComplemento(id, dto);
  }

  // ── Auto-declaração ───────────────────────────────────────────────

  @Patch(':id/auto-declaracao')
  atualizarAutoDeclaracao(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('auto_declaracao') autoDeclaracao: string,
  ) {
    return this.svc.atualizarAutoDeclaracao(id, autoDeclaracao);
  }

  // ── Documentos ────────────────────────────────────────────────────

  @Get(':id/documentos')
  listarDocumentos(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.listarDocumentos(id);
  }

  @Get(':id/documentos/sumario')
  sumarioValidacao(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.sumarioValidacao(id);
  }

  @Post(':id/documentos')
  enviarDocumento(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EnviarDocumentoDto,
  ) {
    return this.svc.enviarDocumento(id, dto);
  }

  @Post(':id/documentos/upload')
  @UseInterceptors(FileInterceptor('arquivo', {
    storage: memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 },
  }))
  async uploadDocumentoArquivo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('tipo') tipo: string,
    @Body('nome_extra') nomeExtra: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado.');
    if (!tipo) throw new BadRequestException('Tipo de documento obrigatório.');
    return this.svc.uploadArquivoDossie(id, tipo, file, nomeExtra);
  }

  // ── Validação (admin) ─────────────────────────────────────────────

  @Patch(':id/documentos/:docId/validar')
  @Roles(Role.ASSIST)
  validarDocumento(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('docId', ParseUUIDPipe) docId: string,
    @Body() dto: ValidarDocumentoDto,
    @Req() req: any,
  ) {
    const usuarioId   = req.user?.sub ?? 'sistema';
    const usuarioNome = req.user?.nome ?? dto.validado_por_nome;
    return this.svc.validarDocumento(id, docId, usuarioId, { ...dto, validado_por_nome: usuarioNome });
  }

  @Patch(':id/documentos/:docId/invalidar')
  @Roles(Role.ASSIST)
  invalidarDocumento(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('docId', ParseUUIDPipe) docId: string,
    @Body() dto: InvalidarDocumentoDto,
    @Req() req: any,
  ) {
    const usuarioId   = req.user?.sub ?? 'sistema';
    const usuarioNome = req.user?.nome ?? dto.validado_por_nome;
    return this.svc.invalidarDocumento(id, docId, usuarioId, { ...dto, validado_por_nome: usuarioNome });
  }
}
