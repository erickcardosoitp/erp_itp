import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { ProjetoInscricao } from './projeto-inscricao.entity';

export const TIPOS_DOCUMENTO_PROJETO = [
  'foto_aluno',
  'identidade_aluno',
  'identidade_responsavel',
  'comprovante_residencia',
  'certidao_nascimento',
  'declaracao_escolar',
] as const;

export const TIPOS_OBRIGATORIOS_PROJETO: readonly string[] = [];

export type TipoDocumentoProjeto = typeof TIPOS_DOCUMENTO_PROJETO[number];

@Entity('projeto_inscricao_documentos')
export class ProjetoInscricaoDocumento {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'inscricao_id', type: 'uuid' })
  inscricao_id: string;

  @ManyToOne(() => ProjetoInscricao, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inscricao_id' })
  inscricao: ProjetoInscricao;

  @Column({ type: 'varchar' })
  tipo: string;

  @Column({ type: 'text' })
  url_arquivo: string;

  @Column({ type: 'int', nullable: true, name: 'tamanho_bytes' })
  tamanho_bytes: number | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
