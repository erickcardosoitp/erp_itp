import {
  Controller, Get, Post, Patch, Param, Body, ParseUUIDPipe, Req,
} from '@nestjs/common';
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
