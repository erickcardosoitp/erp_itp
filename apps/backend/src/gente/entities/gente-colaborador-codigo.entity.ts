import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('gente_colaborador_codigos')
export class GenteColaboradorCodigo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  colaborador_id: string;

  @Column({ type: 'uuid' })
  codigo_id: string;

  /** Sobrescreve o valor_base do código para este colaborador */
  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  valor_personalizado: number;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
