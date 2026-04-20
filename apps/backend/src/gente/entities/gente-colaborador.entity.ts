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

  @Column({ type: 'boolean', default: false })
  jornada_flexivel: boolean;

  // Minutos esperados por dia para jornada flexível (default = 420 = 7h)
  @Column({ type: 'int', nullable: true })
  horas_dia_flex: number;

  // Janela de horário permitida por dia da semana: { seg: { inicio: '08:00', fim: '20:00' }, ... }
  @Column({ type: 'jsonb', nullable: true })
  horario_flexivel_semana: Record<string, { inicio: string; fim: string }>;

  @Column({ type: 'numeric', nullable: true, precision: 10, scale: 2 })
  salario_base: number;

  // Custo diário do transporte ida+volta (VT)
  @Column({ type: 'numeric', nullable: true, precision: 10, scale: 2 })
  valor_passagem: number;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
