import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('gente_trabalho_externo')
export class GenteTrabalhoExterno {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  colaborador_id: string;

  @Column({ type: 'date' })
  data: string; // YYYY-MM-DD

  @Column({ type: 'text' })
  autorizado_por: string;

  @Column({ type: 'uuid', nullable: true })
  autorizado_por_id: string;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
