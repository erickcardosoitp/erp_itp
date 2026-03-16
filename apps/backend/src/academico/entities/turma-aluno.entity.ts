import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('turma_alunos')
export class TurmaAluno {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** null = backlog (sem turma definida) */
  @Column({ name: 'turma_id', type: 'uuid', nullable: true })
  turma_id: string | null;

  /** null quando tipo_vinculo = 'candidato' */
  @Column({ name: 'aluno_id', nullable: true })
  aluno_id: string | null;

  /** ID da Inscricao quando tipo_vinculo = 'candidato' */
  @Column({ name: 'inscricao_id', type: 'int', nullable: true })
  inscricao_id: number | null;

  /** Nome do candidato (cache para exibição rápida) */
  @Column({ name: 'nome_candidato', nullable: true })
  nome_candidato: string | null;

  /** 'aluno' | 'candidato' */
  @Column({ name: 'tipo_vinculo', default: 'aluno' })
  tipo_vinculo: string;

  /** 'backlog' | 'ativo' */
  @Column({ default: 'backlog' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
