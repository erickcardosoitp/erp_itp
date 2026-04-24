import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('gente_colaborador_documentos')
export class GenteColaboradorDocumento {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  colaborador_id: string;

  @Column({ type: 'text' })
  nome: string;

  @Column({ type: 'text', nullable: true })
  url: string;

  @Column({ type: 'date', nullable: true })
  vencimento: string;

  @Column({ type: 'text', nullable: true })
  observacao: string;

  @Column({ type: 'text', nullable: true, default: 'pessoal' })
  categoria: string; // 'pessoal' | 'outros' | 'vale'

  @Column({ type: 'text', nullable: true })
  criado_por_id: string;

  @Column({ type: 'text', nullable: true })
  criado_por_nome: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
