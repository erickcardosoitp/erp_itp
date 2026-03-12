import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('estoque_categorias')
export class CategoriaInsumo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', unique: true })
  nome: string;

  /** Código-prefixo curto definido pelo usuário (ex: CZNH, ALIM, HGNE) */
  @Column({ type: 'text', nullable: true, unique: true })
  codigo: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
