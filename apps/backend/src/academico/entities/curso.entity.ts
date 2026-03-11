import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('materias')
export class Curso {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Código único gerado automaticamente: CRS-YYYYMMX */
  @Column({ nullable: true })
  codigo: string;

  @Column()
  nome: string;

  @Column({ unique: true })
  sigla: string;

  @Column({ type: 'text', nullable: true })
  descricao: string;

  @Column({ nullable: true })
  conceito: string;

  @Column({ default: '2026.1' })
  periodo: string;

  @Column({ name: 'professor_id', nullable: true })
  professor_id: string;

  @Column({ default: 'Ativo' })
  status: string;

  @Column({ default: 'Média' })
  prioridade: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  media: number;

  @Column({ type: 'int', default: 0 })
  acertos: number;

  @Column({ type: 'int', default: 0 })
  totalQuestoes: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  progresso: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
