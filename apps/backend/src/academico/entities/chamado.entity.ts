import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('chamados_academicos')
export class ChamadoAcademico {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  titulo: string;

  @Column({ type: 'text', nullable: true })
  descricao: string;

  /** 'Social' | 'Acadêmico' | 'Saúde' | 'Família' | 'Financeiro' | 'Outro' */
  @Column({ default: 'Social' })
  tipo: string;

  /** 'aberto' | 'em_andamento' | 'resolvido' */
  @Column({ default: 'aberto' })
  status: string;

  /** 'baixa' | 'normal' | 'alta' | 'urgente' */
  @Column({ default: 'normal' })
  prioridade: string;

  @Column({ name: 'aluno_id', type: 'uuid', nullable: true })
  aluno_id: string | null;

  @Column({ name: 'aluno_nome', type: 'varchar', nullable: true })
  aluno_nome: string | null;

  @Column({ name: 'turma_id', type: 'uuid', nullable: true })
  turma_id: string | null;

  @Column({ name: 'turma_nome', type: 'varchar', nullable: true })
  turma_nome: string | null;

  @Column({ name: 'responsavel_nome', type: 'varchar', nullable: true })
  responsavel_nome: string | null;

  @Column({ name: 'criado_por_nome', type: 'varchar', nullable: true })
  criado_por_nome: string | null;

  /** Histórico de atualizações / anotações do chamado */
  @Column({ type: 'text', nullable: true })
  observacoes: string | null;

  @Column({ name: 'data_resolucao', type: 'date', nullable: true })
  data_resolucao: string | null;

  @Column({ name: 'abertura', type: 'timestamptz', nullable: true })
  abertura: Date | null;

  @Column({ name: 'fechamento', type: 'timestamptz', nullable: true })
  fechamento: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
