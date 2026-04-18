import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('gente_colaborador_locais')
export class GenteColaboradorLocal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  colaborador_id: string;

  @Column({ type: 'text' })
  nome: string; // ex: "Instituto", "Assoc. Rua Macunaíma"

  @Column({ type: 'numeric', precision: 10, scale: 7 })
  latitude: number;

  @Column({ type: 'numeric', precision: 10, scale: 7 })
  longitude: number;

  @Column({ type: 'int', default: 100 })
  raio_metros: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
