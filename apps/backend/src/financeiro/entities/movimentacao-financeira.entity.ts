import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('movimentacoes_financeiras')
export class MovimentacaoFinanceira {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  data: string;

  @Column({ type: 'varchar' })
  nome: string;

  @Column({ type: 'varchar', nullable: true })
  competencia: string;

  @Column({ type: 'varchar', nullable: true })
  tipo_movimentacao: string;

  @Column({ nullable: true, type: 'text' })
  descricao: string;

  @Column({ type: 'varchar', nullable: true })
  plano_contas: string;

  @Column({ type: 'varchar', nullable: true })
  categoria: string;

  @Column({ type: 'varchar', default: 'Pendente' })
  status: string;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  valor: number;

  @Column({ type: 'varchar', nullable: true })
  tipo_pessoa: string;

  @Column({ type: 'varchar', nullable: true })
  forma_pagamento: string;

  @Column({ type: 'varchar', nullable: true })
  recorrencia: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
