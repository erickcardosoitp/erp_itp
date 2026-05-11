import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Aluno } from '../aluno.entity';

export enum TipoDocumentoValidacao {
  COMPROVANTE_INSCRICAO = 'comprovante_inscricao',
  COMPROVANTE_BANCARIO  = 'comprovante_bancario',
  SELFIE                = 'selfie',
  IDENTIDADE_FRENTE     = 'identidade_frente',
  IDENTIDADE_VERSO      = 'identidade_verso',
}

export enum StatusDocumento {
  PENDENTE    = 'pendente',       // Aluno ainda não enviou
  AGUARDANDO  = 'aguardando',     // Enviado, aguardando validação
  APROVADO    = 'aprovado',       // Validado pelo admin
  PENDENCIA   = 'pendencia',      // Reprovado — aluno deve reenviar
}

export const LABELS_DOCUMENTO: Record<TipoDocumentoValidacao, string> = {
  comprovante_inscricao: 'Comprovante de Inscrição',
  comprovante_bancario:  'Comprovante Bancário',
  selfie:                'Selfie',
  identidade_frente:     'Identidade (Frente)',
  identidade_verso:      'Identidade (Verso)',
};

@Entity('documentos_validacao')
@Index(['aluno_id', 'tipo'], { unique: true })
export class DocumentoValidacao {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  aluno_id: string;

  @ManyToOne(() => Aluno, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'aluno_id' })
  aluno: Aluno;

  @Column({ type: 'varchar' })
  tipo: string;

  @Column({ type: 'text', nullable: true })
  url_drive: string | null;

  @Column({ type: 'varchar', default: StatusDocumento.PENDENTE })
  status: string;

  @Column({ type: 'text', nullable: true })
  motivo_pendencia: string | null;

  // Quem validou / invalidou
  @Column({ type: 'text', nullable: true })
  validado_por_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  validado_por_nome: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  validado_em: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
