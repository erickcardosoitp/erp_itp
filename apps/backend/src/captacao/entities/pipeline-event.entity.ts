import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('captacao_pipeline_events')
export class PipelineEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  opportunity_id: string;

  @Column({ type: 'text', nullable: true })
  from_status?: string;

  @Column({ type: 'text' })
  to_status: string;

  @Column({ type: 'uuid', nullable: true })
  changed_by?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
