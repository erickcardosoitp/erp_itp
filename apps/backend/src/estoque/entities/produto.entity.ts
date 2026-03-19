import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('estoque_produtos')
export class Produto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  nome: string;

  @Column({ type: 'text', nullable: true, default: 'Geral' })
  categoria: string;

  @Column({ type: 'text', default: 'un' })
  unidade_medida: string;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  quantidade_atual: number;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  estoque_minimo: number;

  @Column({ name: 'codigo_interno', type: 'text', nullable: true, unique: true })
  codigo_interno: string | null;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
