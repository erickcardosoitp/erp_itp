import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('presenca_sessoes')
export class PresencaSessao {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'turma_id', type: 'uuid' })
  turma_id: string;

  @Column({ name: 'turma_nome', type: 'varchar', nullable: true })
  turma_nome: string;

  @Column({ type: 'date' })
  data: string;

  @Column({ name: 'tema_aula', type: 'varchar', nullable: true })
  tema_aula: string;

  @Column({ name: 'conteudo_abordado', type: 'text', nullable: true })
  conteudo_abordado: string;

  @Column({ name: 'ip_address', type: 'varchar', nullable: true })
  ip_address: string;

  @Column({ name: 'usuario_id', type: 'uuid', nullable: true })
  usuario_id: string;

  @Column({ name: 'usuario_nome', type: 'varchar', nullable: true })
  usuario_nome: string;

  @Column({ name: 'total_presentes', type: 'int', default: 0 })
  total_presentes: number;

  @Column({ name: 'total_ausentes', type: 'int', default: 0 })
  total_ausentes: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
