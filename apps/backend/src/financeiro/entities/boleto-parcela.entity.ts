import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('boleto_parcelas')
export class BoletoParcela {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  boleto_id: string;

  @Column()
  numero_parcela: number;

  @Column({ type: 'numeric', precision: 15, scale: 2 })
  valor: number;

  @Column({ type: 'date' })
  data_vencimento: string;

  @Column({ type: 'date', nullable: true })
  data_pagamento: string | null;

  @Column({ default: false })
  pago: boolean;

  @Column({ type: 'uuid', nullable: true })
  movimentacao_id: string | null;

  @Column({ type: 'text', nullable: true })
  cod_barras: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
