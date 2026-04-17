import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
} from 'typeorm';

@Entity('gente_suspensoes')
export class GenteSuspensao {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  colaborador_id: string;

  @Column({ type: 'date' })
  data_inicio: string;

  @Column({ type: 'date' })
  data_fim: string;

  @Column({ type: 'text' })
  motivo: string;

  @Column({ type: 'boolean', default: true })
  com_desconto: boolean;

  @Column({ type: 'text', nullable: true })
  criado_por_id: string;

  @Column({ type: 'text', nullable: true })
  criado_por_nome: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
