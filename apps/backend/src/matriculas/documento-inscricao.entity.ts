import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Inscricao } from './inscricao.entity';

export enum TipoDocumento {
  FOTO_ALUNO          = 'foto_aluno',
  IDENTIDADE          = 'identidade',
  COMPROVANTE_RESID   = 'comprovante_residencia',
  CERTIDAO_NASCIMENTO = 'certidao_nascimento',
  IDENTIDADE_RESP     = 'identidade_responsavel',
  DECLARACAO_ESCOLAR  = 'declaracao_escolaridade',
  EXTRA               = 'extra',
}

@Entity('documentos_inscricao')
@Index(['inscricao_id', 'tipo'])
export class DocumentoInscricao {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'inscricao_id' })
  inscricao_id: number;

  @ManyToOne(() => Inscricao, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inscricao_id' })
  inscricao: Inscricao;

  /** Tipo canônico — EXTRA para documentos adicionais */
  @Column({ type: 'varchar', enum: TipoDocumento })
  tipo: TipoDocumento;

  /** Label exibida para documentos do tipo EXTRA */
  @Column({ type: 'varchar', nullable: true })
  nome_extra: string | null;

  /** data URL base64 ou caminho relativo: data:<mime>;base64,... */
  @Column({ type: 'text' })
  url_arquivo: string;

  /** Mimetype original validado no backend */
  @Column({ type: 'varchar', nullable: true })
  mimetype: string | null;

  /** Tamanho em bytes */
  @Column({ type: 'int', nullable: true })
  tamanho_bytes: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
