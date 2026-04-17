import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('gente_codigos_ajuda')
export class GenteCodigoAjuda {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', unique: true })
  codigo: string; // VR001, VR002...

  @Column({ type: 'text' })
  descricao: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  valor_base: number;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
