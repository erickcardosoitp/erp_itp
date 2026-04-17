import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
} from 'typeorm';

@Entity('gente_advertencias')
export class GenteAdvertencia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  colaborador_id: string;

  @Column({ type: 'date' })
  data: string;

  @Column({ type: 'text' })
  motivo: string;

  @Column({ type: 'text', nullable: true })
  descricao: string;

  @Column({ type: 'text', default: 'escrita' })
  nivel: string; // 'verbal' | 'escrita' | 'grave'

  @Column({ type: 'text', nullable: true })
  criado_por_id: string;

  @Column({ type: 'text', nullable: true })
  criado_por_nome: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
