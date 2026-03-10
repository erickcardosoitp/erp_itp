import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('insumos')
export class Insumo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nome: string;

  @Column({ nullable: true })
  categoria: string;

  @Column({ nullable: true, type: 'text' })
  descricao: string;

  @Column({ type: 'numeric', default: 0 })
  quantidade: number;

  @Column({ default: 'un' })
  unidade: string;

  @Column({ nullable: true })
  fornecedor: string;

  @Column({ default: 'ok' })
  status: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
