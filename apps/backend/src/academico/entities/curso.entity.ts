import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('materias')
export class Curso {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Código único gerado automaticamente: CRS-YYYYMMX */
  @Column({ type: 'varchar', nullable: true })
  codigo: string;

  @Column({ type: 'varchar' })
  nome: string;

  @Column({ type: 'varchar', unique: true })
  sigla: string;

  @Column({ type: 'text', nullable: true })
  descricao: string;

  @Column({ type: 'varchar', nullable: true })
  conceito: string;

  @Column({ type: 'varchar', default: '2026.1' })
  periodo: string;

  @Column({ name: 'professor_id', type: 'uuid', nullable: true })
  professor_id: string;

  @Column({ type: 'varchar', default: 'Ativo' })
  status: string;

  @Column({ type: 'varchar', default: 'Média' })
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
