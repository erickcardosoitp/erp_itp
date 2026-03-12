import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('estoque_categorias')
export class CategoriaInsumo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', unique: true })
  nome: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
