import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
} from 'typeorm';

@Entity('gente_vales')
export class GenteVale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  colaborador_id: string;

  @Column({ type: 'text', default: 'outro' })
  tipo: string; // 'alimentacao' | 'transporte' | 'adiantamento' | 'outro'

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  valor: number;

  @Column({ type: 'date' })
  data: string;

  @Column({ type: 'text', nullable: true })
  descricao: string;

  @Column({ type: 'boolean', default: false })
  descontado: boolean;

  @Column({ type: 'text', nullable: true })
  forma_pagamento: string;

  @Column({ type: 'text', nullable: true })
  movimentacao_saida_id: string;

  @Column({ type: 'text', nullable: true })
  movimentacao_entrada_id: string;

  @Column({ type: 'text', nullable: true })
  ficha_url: string;

  @Column({ type: 'text', nullable: true })
  criado_por_id: string;

  @Column({ type: 'text', nullable: true })
  criado_por_nome: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
