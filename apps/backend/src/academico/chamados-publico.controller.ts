import {
  Controller, Post, Get, Query, Body, UploadedFiles, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { Public } from '../auth/decorators/public.decorator';
import { AcademicoService } from './academico.service';

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_TAMANHO = 5 * 1024 * 1024; // 5MB

const uploadDir = join(process.cwd(), 'uploads', 'chamados-publicos');
if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });

@Controller('api/chamados/publico')
export class ChamadosPublicoController {
  constructor(private readonly svc: AcademicoService) {}

  @Post()
  @Public()
  @UseInterceptors(FilesInterceptor('arquivos', 3, {
    storage: diskStorage({
      destination: uploadDir,
      filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
        cb(null, `${unique}${extname(file.originalname)}`);
      },
    }),
    limits: { fileSize: MAX_TAMANHO },
    fileFilter: (_req, file, cb) => {
      if (TIPOS_PERMITIDOS.includes(file.mimetype)) cb(null, true);
      else cb(new BadRequestException(`Tipo não permitido: ${file.mimetype}`), false);
    },
  }))
  async criar(
    @Body() body: any,
    @UploadedFiles() arquivos?: Express.Multer.File[],
  ) {
    const { nome, email, telefone, nome_aluno, assunto, mensagem } = body;
    if (!nome?.trim() || !email?.trim() || !telefone?.trim() || !assunto?.trim() || !mensagem?.trim()) {
      throw new BadRequestException('Campos obrigatórios: nome, email, telefone, assunto, mensagem');
    }

    const baseUrl = process.env.APP_URL?.replace(/\/$/, '') ?? 'https://itp.institutotiapretinha.org';
    const urlsArquivos = (arquivos ?? []).map(f => `${baseUrl}/uploads/chamados-publicos/${f.filename}`);

    return this.svc.criarChamadoPublico({ nome, email, telefone, nome_aluno, assunto, mensagem, arquivos: urlsArquivos });
  }

  @Get('consultar')
  @Public()
  async consultar(@Query('q') q: string) {
    if (!q?.trim() || q.trim().length < 3) {
      throw new BadRequestException('Informe pelo menos 3 caracteres para buscar');
    }
    return this.svc.consultarChamadoPublico(q);
  }
}
