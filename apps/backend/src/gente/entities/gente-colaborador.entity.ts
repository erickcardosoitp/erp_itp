import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('gente_colaboradores')
export class GenteColaborador {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  funcionario_id: string;

  @Column({ type: 'text', default: 'funcionario' })
  tipo: string; // 'funcionario' | 'voluntario'

  @Column({ type: 'text', nullable: true })
  horario_entrada: string; // HH:MM

  @Column({ type: 'text', nullable: true })
  horario_saida: string; // HH:MM

  @Column({ type: 'jsonb', nullable: true })
  dias_trabalho: string[]; // ['seg','ter','qua','qui','sex']

  @Column({ type: 'numeric', nullable: true, precision: 10, scale: 7 })
  latitude_permitida: number;

  @Column({ type: 'numeric', nullable: true, precision: 10, scale: 7 })
  longitude_permitida: number;

  @Column({ type: 'int', nullable: true, default: 100 })
  raio_metros: number;

  @Column({ type: 'numeric', nullable: true, precision: 10, scale: 2 })
  salario_base: number;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
