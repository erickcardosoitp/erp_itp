import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('turma_alunos')
export class TurmaAluno {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'turma_id', type: 'varchar', nullable: true })
  turma_id: string | null;

  @Column({ name: 'aluno_id', type: 'varchar', nullable: true })
  aluno_id: string | null;

  @Column({ name: 'inscricao_id', type: 'int', nullable: true })
  inscricao_id: number | null;

  @Column({ name: 'nome_candidato', type: 'varchar', nullable: true })
  nome_candidato: string | null;

  @Column({ name: 'tipo_vinculo', type: 'varchar', default: 'aluno' })
  tipo_vinculo: string;

  @Column({ type: 'varchar', default: 'backlog' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}