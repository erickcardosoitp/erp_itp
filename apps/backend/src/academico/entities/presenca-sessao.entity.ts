import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('presenca_sessoes')
export class PresencaSessao {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'turma_id' })
  turma_id: string;

  @Column({ name: 'turma_nome', nullable: true })
  turma_nome: string;

  @Column({ type: 'date' })
  data: string;

  @Column({ name: 'tema_aula', nullable: true })
  tema_aula: string;

  @Column({ name: 'conteudo_abordado', type: 'text', nullable: true })
  conteudo_abordado: string;

  @Column({ name: 'hora_inicio', type: 'time', nullable: true })
  hora_inicio: string;

  @Column({ name: 'hora_fim', type: 'time', nullable: true })
  hora_fim: string;

  @Column({ name: 'ip_address', nullable: true })
  ip_address: string;

  @Column({ name: 'usuario_id', nullable: true })
  usuario_id: string;

  @Column({ name: 'usuario_nome', nullable: true })
  usuario_nome: string;

  @Column({ name: 'total_presentes', type: 'int', default: 0 })
  total_presentes: number;

  @Column({ name: 'total_ausentes', type: 'int', default: 0 })
  total_ausentes: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
