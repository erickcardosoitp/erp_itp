import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Aluno } from './aluno.entity';
import { AlunoComplemento } from './entities/aluno-complemento.entity';
import { DocumentoValidacao, StatusDocumento, TipoDocumentoValidacao, LABELS_DOCUMENTO } from './entities/documento-validacao.entity';
import { UpsertComplementoDto } from './dto/upsert-complemento.dto';
import { EnviarDocumentoDto, ValidarDocumentoDto, InvalidarDocumentoDto } from './dto/enviar-documento.dto';

@Injectable()
export class AlunosService {
  constructor(
    @InjectRepository(Aluno)
    private readonly alunoRepo: Repository<Aluno>,

    @InjectRepository(AlunoComplemento)
    private readonly complementoRepo: Repository<AlunoComplemento>,

    @InjectRepository(DocumentoValidacao)
    private readonly docRepo: Repository<DocumentoValidacao>,
  ) {}

  // ── Helpers ───────────────────────────────────────────────────────

  private async assertAluno(id: string): Promise<Aluno> {
    const aluno = await this.alunoRepo.findOne({ where: { id } });
    if (!aluno) throw new NotFoundException(`Aluno ${id} não encontrado`);
    return aluno;
  }

  private async assertDoc(alunoId: string, docId: string): Promise<DocumentoValidacao> {
    const doc = await this.docRepo.findOne({ where: { id: docId, aluno_id: alunoId } });
    if (!doc) throw new NotFoundException(`Documento ${docId} não encontrado`);
    return doc;
  }

  // ── Complemento ───────────────────────────────────────────────────

  async upsertComplemento(alunoId: string, dto: UpsertComplementoDto): Promise<AlunoComplemento> {
    await this.assertAluno(alunoId);

    let complemento = await this.complementoRepo.findOne({ where: { aluno_id: alunoId } });
    if (!complemento) {
      complemento = this.complementoRepo.create({ aluno_id: alunoId });
    }

    Object.assign(complemento, dto);
    return this.complementoRepo.save(complemento);
  }

  async getComplemento(alunoId: string): Promise<AlunoComplemento | null> {
    await this.assertAluno(alunoId);
    return this.complementoRepo.findOne({ where: { aluno_id: alunoId } });
  }

  // ── Documentos de Validação ───────────────────────────────────────

  async listarDocumentos(alunoId: string): Promise<DocumentoValidacao[]> {
    await this.assertAluno(alunoId);

    // Garante que todos os tipos existam como registro (lazy-create)
    const existentes = await this.docRepo.find({ where: { aluno_id: alunoId } });
    const existentesTipos = new Set(existentes.map(d => d.tipo));

    const faltando = Object.values(TipoDocumentoValidacao)
      .filter(t => !existentesTipos.has(t))
      .map(tipo => this.docRepo.create({ aluno_id: alunoId, tipo, status: StatusDocumento.PENDENTE }));

    if (faltando.length > 0) {
      await this.docRepo.save(faltando);
    }

    return this.docRepo.find({
      where: { aluno_id: alunoId },
      order: { tipo: 'ASC' },
    });
  }

  async enviarDocumento(alunoId: string, dto: EnviarDocumentoDto): Promise<DocumentoValidacao> {
    await this.assertAluno(alunoId);

    let doc = await this.docRepo.findOne({ where: { aluno_id: alunoId, tipo: dto.tipo } });

    if (!doc) {
      doc = this.docRepo.create({ aluno_id: alunoId, tipo: dto.tipo });
    }

    if (doc.status === StatusDocumento.APROVADO) {
      throw new BadRequestException('Documento já aprovado não pode ser substituído');
    }

    doc.url_drive       = dto.url_drive;
    doc.status          = StatusDocumento.AGUARDANDO;
    doc.motivo_pendencia = null;

    return this.docRepo.save(doc);
  }

  async validarDocumento(
    alunoId: string,
    docId: string,
    usuarioId: string,
    dto: ValidarDocumentoDto,
  ): Promise<DocumentoValidacao> {
    const doc = await this.assertDoc(alunoId, docId);

    if (!doc.url_drive) {
      throw new BadRequestException('Documento sem URL — aluno deve enviar primeiro');
    }

    doc.status           = StatusDocumento.APROVADO;
    doc.motivo_pendencia = null;
    doc.validado_por_id  = usuarioId;
    doc.validado_por_nome = dto.validado_por_nome ?? null;
    doc.validado_em      = new Date();

    return this.docRepo.save(doc);
  }

  async invalidarDocumento(
    alunoId: string,
    docId: string,
    usuarioId: string,
    dto: InvalidarDocumentoDto,
  ): Promise<DocumentoValidacao> {
    const doc = await this.assertDoc(alunoId, docId);

    doc.status           = StatusDocumento.PENDENCIA;
    doc.motivo_pendencia = dto.motivo_pendencia;
    doc.validado_por_id  = usuarioId;
    doc.validado_por_nome = dto.validado_por_nome ?? null;
    doc.validado_em      = new Date();
    doc.url_drive        = null; // força reenvio

    return this.docRepo.save(doc);
  }

  // ── Auto-declaração (campo global em alunos) ──────────────────────

  async atualizarAutoDeclaracao(alunoId: string, autoDeclaracao: string): Promise<void> {
    await this.assertAluno(alunoId);
    await this.alunoRepo
      .createQueryBuilder()
      .update(Aluno)
      .set({ auto_declaracao: autoDeclaracao } as any)
      .where('id = :id', { id: alunoId })
      .execute();
  }

  // ── Sumário de validação para o painel admin ──────────────────────

  async sumarioValidacao(alunoId: string) {
    const docs = await this.listarDocumentos(alunoId);
    const total    = docs.length;
    const aprovados  = docs.filter(d => d.status === StatusDocumento.APROVADO).length;
    const pendencias = docs.filter(d => d.status === StatusDocumento.PENDENCIA).length;
    const aguardando = docs.filter(d => d.status === StatusDocumento.AGUARDANDO).length;
    const concluido  = aprovados === total;

    return { total, aprovados, pendencias, aguardando, concluido, docs };
  }
}
