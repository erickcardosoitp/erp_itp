import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('insumos')
export class Insumo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  nome: string;

  @Column({ type: 'varchar', nullable: true })
  categoria: string;

  @Column({ nullable: true, type: 'text' })
  descricao: string;

  @Column({ type: 'numeric', default: 0 })
  quantidade: number;

  @Column({ type: 'varchar', default: 'un' })
  unidade: string;

  @Column({ type: 'varchar', nullable: true })
  fornecedor: string;

  @Column({ type: 'varchar', default: 'ok' })
  status: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
