import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
} from 'typeorm';

@Entity('gente_ponto')
export class GentePonto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  colaborador_id: string;

  @Column({ type: 'text' })
  tipo: string; // 'entrada' | 'saida'

  @Column({ type: 'timestamptz' })
  data_hora: Date;

  @Column({ type: 'numeric', nullable: true, precision: 10, scale: 7 })
  latitude: number;

  @Column({ type: 'numeric', nullable: true, precision: 10, scale: 7 })
  longitude: number;

  @Column({ type: 'numeric', nullable: true })
  distancia_metros: number;

  @Column({ type: 'boolean', nullable: true })
  dentro_area: boolean;

  @Column({ type: 'text', nullable: true })
  observacao: string;

  @Column({ type: 'text', nullable: true, default: 'system' })
  registrado_por: string; // 'self' | 'gestor' | 'system'

  @Column({ type: 'text', nullable: true })
  assinatura: string; // base64 PNG da assinatura

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
