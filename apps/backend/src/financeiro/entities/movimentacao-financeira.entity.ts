import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';

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

  @Column({ name: 'usuario_nome', type: 'varchar', nullable: true })
  usuario_nome: string;

  // FK adicionadas na auditoria de banco (2026-09-08) em paralelo às colunas
  // varchar acima (mantidas por compatibilidade — ver app.module.ts v21).
  @Column({ type: 'uuid', nullable: true })
  categoria_id: string;

  @Column({ type: 'uuid', nullable: true })
  plano_contas_id: string;

  @Column({ type: 'uuid', nullable: true })
  tipo_movimentacao_id: string;

  @Column({ type: 'uuid', nullable: true })
  forma_pagamento_id: string;

  /** Soft delete — auditoria de banco 2026-09-08 (P0 #4). NULL = ativo. */
  @DeleteDateColumn({ name: 'deleted_at' })
  deleted_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
