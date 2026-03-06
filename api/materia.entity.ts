// backend/src/materias/entities/materia.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum Prioridade {
  ALTA = 'Alta',
  MEDIA = 'Média',
  BAIXA = 'Baixa'
}

@Entity('materias')
export class Materia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nome: string;

  @Column({ nullable: true })
  conceito: string;

  @Column({ unique: true })
  sigla: string;

  @Column({ type: 'enum', enum: Prioridade, default: Prioridade.MEDIA })
  prioridade: Prioridade;

  @Column()
  periodo: string; // Ex: '2026.1'

  @Column({ type: 'int' })
  cargaHorariaEmenta: number;

  @Column()
  professor: string;

  @Column({ default: 'Pendente' })
  status: string; // Pendente, Em Curso, Concluída

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  media: number;

  @Column({ type: 'int', default: 0 })
  acertos: number;

  @Column({ type: 'int', default: 0 })
  totalQuestoes: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  progresso: number; // Porcentagem 0-100

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}