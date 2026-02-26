import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';

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
  periodo: string;

  @Column({ type: 'int' })
  cargaHorariaEmenta: number;

  @Column()
  professor: string;

  @Column({ default: 'Pendente' })
  status: string;

  @Column({ type: 'float', default: 0 })
  media: number;

  @Column({ type: 'int', default: 0 })
  acertos: number;

  @Column({ type: 'int', default: 0 })
  totalQuestoes: number;

  @Column({ type: 'float', default: 0 })
  progresso: number; // Barra evolutiva

  @CreateDateColumn()
  createdAt: Date;
}