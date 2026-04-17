import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
} from 'typeorm';

@Entity('gente_faltas')
export class GenteFalta {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  colaborador_id: string;

  @Column({ type: 'date' })
  data: string;

  @Column({ type: 'boolean', default: false })
  justificada: boolean;

  @Column({ type: 'text', nullable: true })
  motivo: string;

  @Column({ type: 'boolean', default: true })
  com_desconto: boolean;

  @Column({ type: 'text', nullable: true })
  observacao: string;

  @Column({ type: 'text', nullable: true })
  criado_por_id: string;

  @Column({ type: 'text', nullable: true })
  criado_por_nome: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
