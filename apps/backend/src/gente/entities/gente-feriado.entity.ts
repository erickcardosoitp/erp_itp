import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('gente_feriados')
export class GenteFeriado {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  data: string;

  @Column({ type: 'text' })
  descricao: string;

  @Column({ type: 'text', default: 'institucional' })
  tipo: string; // 'nacional' | 'municipal' | 'institucional'

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
