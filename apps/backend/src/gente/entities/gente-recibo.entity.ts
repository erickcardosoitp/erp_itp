import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('gente_recibos')
export class GenteRecibo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  colaborador_id: string;

  @Column({ type: 'text' })
  mes_referencia: string; // YYYY-MM

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  valor: number;

  @Column({ type: 'text', nullable: true })
  descricao: string;

  @Column({ type: 'date', nullable: true })
  data_pagamento: string;

  @Column({ type: 'text', default: 'pendente' })
  status: string; // 'pendente' | 'pago'

  @Column({ type: 'text', nullable: true })
  observacao: string;

  @Column({ type: 'text', nullable: true })
  criado_por_id: string;

  @Column({ type: 'text', nullable: true })
  criado_por_nome: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
