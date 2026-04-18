import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('gente_folga_solicitacoes')
export class GenteFolgaSolicitacao {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  colaborador_id: string;

  @Column({ type: 'date' })
  data: string; // YYYY-MM-DD

  @Column({ type: 'text', default: 'pendente' })
  status: string; // 'pendente' | 'aprovada' | 'negada'

  @Column({ type: 'text', nullable: true })
  motivo: string;

  @Column({ type: 'text', nullable: true })
  respondido_por: string;

  @Column({ type: 'timestamptz', nullable: true })
  respondido_em: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
