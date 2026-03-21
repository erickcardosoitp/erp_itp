import { 
  Controller, Post, Body, Get, Param, Patch, Request, Req, Delete,
  BadRequestException, ParseIntPipe, UseGuards, UseInterceptors,
  UploadedFile, Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { MatriculasService } from './matriculas.service'; 
import { StatusMatricula } from './inscricao.entity';
import { TipoDocumento } from './documento-inscricao.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; 
import { RolesGuard } from '../auth/guards/roles.guard'; 
import { Roles } from '../auth/decorators/roles.decorator'; 
import { Role } from '../auth/constants/roles.enum'; 
import { Public } from '../auth/decorators/public.decorator';

@Controller('matriculas')
@UseGuards(JwtAuthGuard, RolesGuard) // Proteção Global do Controller
export class MatriculasController {
  constructor(private readonly matriculasService: MatriculasService) {}

  /**
   * CONSULTA: Nível mínimo CZNH (1). 
   * Suporta paginação (?pagina=1&limite=50) e filtros como query params.
   */
  @Get()
  @Roles(Role.CZNH)
  async listarInscricoes(
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
    @Query('nome') nome?: string,
    @Query('cpf') cpf?: string,
    @Query('status') status?: string,
    @Query('cidade') cidade?: string,
    @Query('bairro') bairro?: string,
    @Query('sexo') sexo?: string,
    @Query('tem_alergia') temAlergia?: string,
    @Query('orderBy') orderBy?: string,
    @Query('orderDir') orderDir?: string,
  ) {
    const p = Math.max(1, parseInt(pagina ?? '1', 10) || 1);
    const l = Math.min(200, Math.max(1, parseInt(limite ?? '50', 10) || 50));
    const dir: 'ASC' | 'DESC' = orderDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    return await this.matriculasService.listarTodas(p, l, {
      nome, cpf, status, cidade, bairro, sexo, tem_alergia: temAlergia, orderBy, orderDir: dir,
    });
  }

  /**
   * Retorna cidades e bairros distintos para popular dropdowns do frontend.
   */
  @Get('localidades')
  @Roles(Role.CZNH)
  async localidades() {
    return await this.matriculasService.listarLocalidades();
  }

  /**
   * Retorna lista de cursos únicos extraídos de cursos_desejados das inscrições.
   */
  @Get('cursos-disponiveis')
  @Roles(Role.CZNH)
  async cursosDisponiveis() {
    return await this.matriculasService.listarCursosDisponiveis();
  }

  /**
   * Retorna cursos ATIVOS do módulo acadêmico com suas turmas ativas.
   * Endpoint público para popular formulário de matrícula direta.
   * Substituir listarCursosDisponiveis por dados reais do acadêmico.
   */
  @Get('cursos-ativos-academico')
  @Public()
  async cursosAtivosAcademico() {
    return await this.matriculasService.obterCursosAtivosComTurmas();
  }

  /**
   * INCLUSÃO: Restrita a Diretores (8) para cima.
   * ADMIN (10) e VP (9) passam automaticamente pela lógica de hierarquia.
   */
  @Post('inscricao')
  @Public()
  async receberInscricao(@Body() dados: any) {
    return await this.matriculasService.receberInscricao(dados);
  }

  /**
   * CRIAÇÃO DIRETA DE ALUNO: Bypass do workflow de inscrição.
   * Útil para matrícula presencial ou casos de exceção.
   * Exige nível DRT (8).
   * Campos obrigatórios: nome_completo, cpf, email, celular, cursos_matriculados
   */
  @Post('aluno-direto')
  @Roles(Role.DRT)
  async criarAlunoDireto(@Body() dados: any) {
    return await this.matriculasService.criarAlunoDireto(dados);
  }

  /**
   * EDIÇÃO E STATUS: Exige nível DRT (8).
   */
  @Patch(':id/enviar-lgpd')
  @Roles(Role.DRT) 
  async enviarLGPD(@Param('id', ParseIntPipe) id: number) {
    return await this.matriculasService.marcarComoAguardandoLGPD(id);
  }

  @Patch(':id/confirmar-lgpd')
  @Roles(Role.DRT) 
  async confirmarLGPD(@Param('id', ParseIntPipe) id: number) {
    return await this.matriculasService.confirmarAssinaturaLGPD(id);
  }

  @Post(':id/finalizar')
  @Roles(Role.DRT) 
  async finalizarMatricula(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { cursos?: string[] }
  ) {
    return await this.matriculasService.finalizarMatricula(id, body.cursos);
  }

  @Patch(':id/status')
  @Roles(Role.DRT) 
  async atualizarStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: StatusMatricula; motivo?: string },
    @Request() req: any
  ) {
    return await this.matriculasService.atualizarStatus(id, body.status, body.motivo, req.user);
  }

  @Get('inscricao/:id')
  @Roles(Role.CZNH)
  async buscarInscricao(@Param('id', ParseIntPipe) id: number) {
    return await this.matriculasService.buscarPorId(id);
  }

  @Patch('inscricao/:id')
  @Roles(Role.DRT)
  async editarInscricao(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @Request() req: any
  ) {
    return await this.matriculasService.editarInscricao(id, body, req.user);
  }

  @Get('inscricao/:id/anotacoes')
  @Roles(Role.CZNH)
  async listarAnotacoes(@Param('id', ParseIntPipe) id: number) {
    return await this.matriculasService.listarAnotacoes(id);
  }

  @Post('inscricao/:id/anotacoes')
  @Roles(Role.CZNH)
  async adicionarAnotacao(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { texto_anotacao: string },
    @Request() req: any
  ) {
    if (!body?.texto_anotacao?.trim()) throw new BadRequestException('Texto da anotação é obrigatório.');
    return await this.matriculasService.adicionarAnotacao(id, body.texto_anotacao, req.user);
  }

  @Get('inscricao/:id/movimentacoes')
  @Roles(Role.CZNH)
  async listarMovimentacoes(@Param('id', ParseIntPipe) id: number) {
    return await this.matriculasService.listarMovimentacoes(id);
  }

  // ── Rotas PÚBLICAS do Termo LGPD (acesso sem autenticação) ──────────────────

  /**
   * Retorna os dados da inscrição associada ao token LGPD.
   * Usada pela página pública para exibir o nome do candidato.
   */
  @Get('lgpd/:token')
  @Public()
  async buscarDadosLGPD(@Param('token') token: string) {
    const inscricao = await this.matriculasService.buscarPorTokenLGPD(token);
    // Retorna apenas os dados necessários para a página de assinatura
    return {
      id: inscricao.id,
      nome_completo: inscricao.nome_completo,
      cpf: inscricao.cpf,
      email: inscricao.email,
    };
  }

  /**
   * Processa a assinatura eletrônica do candidato.
   * Recebe: nome_completo (digitado), cpf, confirmacoes (array dos checkboxes).
   */
  @Post('lgpd/:token/assinar')
  @Public()
  async assinarLGPD(
    @Param('token') token: string,
    @Body() body: { nome_completo: string; cpf: string; confirmacoes: string[] },
    @Req() req: any,
  ) {
    if (!body?.nome_completo?.trim() || !body?.cpf?.trim()) {
      throw new BadRequestException('Nome completo e CPF são obrigatórios.');
    }
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.ip
      || 'desconhecido';
    return await this.matriculasService.assinarLGPD(token, body.nome_completo, body.cpf, ip);
  }

  // ── Rotas PÚBLICAS de Documentos ────────────────────────────────────────────

  /**
   * Admin dispara link de envio de documentos para o candidato.
   */
  @Post('inscricao/:id/enviar-link-documentos')
  @Roles(Role.DRT)
  async enviarLinkDocumentos(@Param('id', ParseIntPipe) id: number) {
    return await this.matriculasService.enviarLinkDocumentos(id);
  }

  /**
   * Candidato consulta status dos documentos enviados pelo token.
   */
  @Get('documentos/status/:token')
  @Public()
  async statusDocumentos(@Param('token') token: string) {
    return await this.matriculasService.listarDocumentosPublico(token);
  }

  /**
   * Candidato envia um documento via token público.
   * Multer salva em public/uploads/documentos/<inscricao_id>/
   */
  @Post('documentos/upload/:token')
  @Public()
  @UseInterceptors(
    FileInterceptor('arquivo', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          // destino provisório — será movido para subpasta por token no service
          const dir = join(process.cwd(), 'public', 'uploads', 'documentos', 'tmp');
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
        },
      }),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  async uploadDocumento(
    @Param('token') token: string,
    @Body('tipo') tipo: string,
    @Body('nome_extra') nomeExtra: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado.');

    const tipoEnum = Object.values(TipoDocumento).includes(tipo as TipoDocumento)
      ? (tipo as TipoDocumento)
      : null;
    if (!tipoEnum) throw new BadRequestException('Tipo de documento inválido.');

    // Move arquivo do tmp para subpasta do token
    const inscricao = await this.matriculasService.buscarPorDocToken(token);
    const destDir = join(process.cwd(), 'public', 'uploads', 'documentos', String(inscricao.id));
    if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });

    const { renameSync } = await import('fs');
    const newPath = join(destDir, file.filename);
    renameSync(file.path, newPath);
    file.path = newPath;

    return await this.matriculasService.uploadDocumento(token, tipoEnum, file, nomeExtra);
  }

  /**
   * Admin remove um documento específico.
   */
  @Delete('documentos/:docId')
  @Roles(Role.DRT)
  async removerDocumento(@Param('docId') docId: string) {
    await this.matriculasService.removerDocumento(docId);
    return { ok: true };
  }

  /**
   * Admin lista documentos de uma inscrição por ID (uso interno).
   */
  @Get('inscricao/:id/documentos')
  @Roles(Role.CZNH)
  async listarDocumentosAdmin(@Param('id', ParseIntPipe) id: number) {
    const inscricao = await this.matriculasService.buscarPorId(id);
    if (!inscricao.doc_token) {
      return { documentos: [], tipos_enviados: [], obrigatorios_pendentes: [], completo: false };
    }
    return await this.matriculasService.listarDocumentosPublico(inscricao.doc_token);
  }
}
