import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('controles_futebol')
export class ControleFutebol {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  aluno_id: string;

  @Column({ type: 'text', nullable: true })
  tamanho_camisa: string | null;

  @Column({ type: 'text', nullable: true })
  tamanho_short: string | null;

  @Column({ type: 'text', nullable: true })
  numero_chuteira: string | null;

  @Column({ type: 'text', nullable: true })
  estoque_uniforme_id: string | null;

  @Column({ type: 'text', nullable: true })
  estoque_chuteira_id: string | null;

  @Column({ default: false })
  uniforme_recebido: boolean;

  @Column({ default: false })
  chuteira_recebida: boolean;

  @Column({ type: 'text', default: 'Pendente' })
  status: string;

  @Column({ type: 'text', nullable: true })
  observacoes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
