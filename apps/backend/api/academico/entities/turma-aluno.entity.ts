import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('turma_alunos')
export class TurmaAluno {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** null = backlog (sem turma definida) */
  @Column({ name: 'turma_id', type: 'uuid', nullable: true })
  turma_id: string | null;

  @Column({ name: 'aluno_id' })
  aluno_id: string;

  /** 'backlog' | 'ativo' */
  @Column({ default: 'backlog' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
