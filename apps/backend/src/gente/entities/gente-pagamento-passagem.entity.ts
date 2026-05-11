import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('gente_pagamentos_passagem')
export class GentePagamentoPassagem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  colaborador_id: string;

  @Column({ type: 'uuid' })
  funcionario_id: string;

  @Column({ type: 'date' })
  data: string; // YYYY-MM-DD

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  valor: number;

  @Column({ type: 'varchar', default: 'pago' })
  status: string; // 'pago' | 'pendente'

  @Column({ type: 'varchar', length: 7 })
  mes_referencia: string; // YYYY-MM

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
