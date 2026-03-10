import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('turmas')
export class Turma {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Código único gerado automaticamente: TRM-[SIGLA]-YYYYMMX */
  @Column({ nullable: true })
  codigo: string;

  @Column()
  nome: string;

  @Column({ name: 'curso_id', nullable: true })
  curso_id: string;

  @Column({ name: 'professor_id', nullable: true })
  professor_id: string;

  @Column({ nullable: true })
  turno: string;

  @Column({ default: '2026' })
  ano: string;

  @Column({ name: 'max_alunos', type: 'int', default: 30 })
  max_alunos: number;

  @Column({ default: true })
  ativo: boolean;

  @Column({ name: 'hora_inicio', type: 'time', nullable: true })
  hora_inicio: string;

  @Column({ name: 'hora_fim', type: 'time', nullable: true })
  hora_fim: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
