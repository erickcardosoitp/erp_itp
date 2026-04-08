import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('turmas')
export class Turma {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Código único gerado automaticamente: TRM-[SIGLA]-YYYYMMX */
  @Column({ type: 'varchar', nullable: true })
  codigo: string;

  @Column({ type: 'varchar' })
  nome: string;

  @Column({ name: 'curso_id', type: 'uuid', nullable: true })
  curso_id: string;

  @Column({ name: 'professor_id', type: 'uuid', nullable: true })
  professor_id: string;

  @Column({ type: 'varchar', nullable: true })
  turno: string;

  @Column({ type: 'varchar', default: '2026' })
  ano: string;

  @Column({ name: 'max_alunos', type: 'int', default: 30 })
  max_alunos: number;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @Column({ type: 'varchar', nullable: true, default: '#7c3aed' })
  cor: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
