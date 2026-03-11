import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('movimentacoes_financeiras')
export class MovimentacaoFinanceira {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  data: string;

  @Column()
  nome: string;

  @Column({ nullable: true })
  competencia: string;

  @Column({ nullable: true })
  tipo_movimentacao: string;

  @Column({ nullable: true, type: 'text' })
  descricao: string;

  @Column({ nullable: true })
  plano_contas: string;

  @Column({ nullable: true })
  categoria: string;

  @Column({ default: 'Pendente' })
  status: string;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  valor: number;

  @Column({ nullable: true })
  tipo_pessoa: string;

  @Column({ nullable: true })
  forma_pagamento: string;

  @Column({ nullable: true })
  recorrencia: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
