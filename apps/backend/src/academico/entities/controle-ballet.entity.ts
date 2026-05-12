import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('controles_ballet')
export class ControleBallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  aluno_id: string;

  // Tamanhos
  @Column({ type: 'text', nullable: true }) tamanho_roupa: string | null;
  @Column({ type: 'text', nullable: true }) numero_sapatilha: string | null;
  @Column({ type: 'text', nullable: true }) tamanho_meia: string | null;

  // Estoque
  @Column({ type: 'text', nullable: true }) estoque_roupa_id: string | null;
  @Column({ type: 'text', nullable: true }) estoque_sapatilha_id: string | null;

  // Entrega
  @Column({ default: false }) roupa_encomendada: boolean;
  @Column({ default: false }) sapatilha_encomendada: boolean;
  @Column({ default: false }) roupa_entregue: boolean;
  @Column({ default: false }) sapatilha_entregue: boolean;
  @Column({ type: 'text', nullable: true }) itens_pendentes: string | null;

  // Pagamento
  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true }) valor_total: number | null;
  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true }) valor_entrada: number | null;
  @Column({ type: 'date', nullable: true }) data_entrada: string | null;
  @Column({ type: 'text', nullable: true }) forma_pagamento: string | null;
  @Column({ type: 'int', nullable: true }) num_parcelas: number | null;
  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true }) valor_parcela: number | null;
  @Column({ type: 'date', nullable: true }) venc_1: string | null;
  @Column({ type: 'date', nullable: true }) venc_2: string | null;
  @Column({ type: 'date', nullable: true }) venc_3: string | null;
  @Column({ type: 'text', default: 'pendente' }) status_pagamento: string;

  // Link financeiro — IDs das movimentações criadas (JSON array)
  @Column({ type: 'jsonb', default: [] }) movimentacao_ids: string[];

  @Column({ type: 'text', default: 'Pendente' }) status: string;
  @Column({ type: 'text', nullable: true }) observacoes: string | null;

  @CreateDateColumn({ name: 'created_at' }) created_at: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updated_at: Date;
}
