import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

export type SourceType = 'edital' | 'grant' | 'patrocinio' | 'lei_incentivo' | 'outro';
export type PipelineStatus =
  | 'prospeccao' | 'qualificacao' | 'elaboracao'
  | 'submissao' | 'aprovado' | 'reprovado' | 'archived';

@Entity('captacao_opportunities')
export class CaptacaoOpportunity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  source_type: SourceType;

  @Column({ type: 'text', nullable: true })
  source_url?: string;

  @Column({ type: 'text', nullable: true })
  entity_name?: string;

  @Column({ type: 'timestamptz', nullable: true })
  deadline?: Date;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  estimated_value?: number;

  @Column({ type: 'text', default: 'prospeccao' })
  status: PipelineStatus;

  @Column({ type: 'smallint', nullable: true })
  ai_score?: number;

  @Column({ type: 'smallint', nullable: true })
  ai_confidence?: number;

  @Column({ type: 'text', nullable: true })
  summary?: string;

  @Column({ type: 'jsonb', nullable: true })
  match_reasons?: string[];

  @Column({ type: 'jsonb', nullable: true })
  search_metadata?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  gemini_raw?: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'uuid', nullable: true })
  created_by?: string;

  @Column({ type: 'timestamptz', nullable: true })
  deleted_at?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  expires_at?: Date;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  get score_label(): string {
    const s = this.ai_score ?? 0;
    if (s >= 90) return 'Excelente';
    if (s >= 75) return 'Alta';
    if (s >= 50) return 'Média';
    return 'Baixa';
  }
}
