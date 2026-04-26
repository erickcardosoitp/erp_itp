import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('diario_academico')
export class DiarioAcademico {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 'Avaliação' | 'Presença' | 'Incidente' | 'Observação' | 'Comunicado' */
  @Column({ type: 'varchar' })
  tipo: string;

  @Column({ type: 'varchar', nullable: true })
  titulo: string;

  @Column({ type: 'text', nullable: true })
  descricao: string;

  @Column({ name: 'aluno_id', type: 'uuid', nullable: true })
  aluno_id: string;

  @Column({ name: 'turma_id', type: 'uuid', nullable: true })
  turma_id: string;

  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  data: string;

  @Column({ name: 'usuario_id', type: 'uuid', nullable: true })
  usuario_id: string;

  @Column({ name: 'usuario_nome', type: 'varchar', nullable: true })
  usuario_nome: string;

  @Column({ name: 'sessao_id', type: 'uuid', nullable: true })
  sessao_id: string;

  /** ID da Inscricao (candidato sem matrícula) */
  @Column({ name: 'inscricao_id', type: 'int', nullable: true })
  inscricao_id: number | null;

  /** Nome em cache quando inscricao_id está preenchido */
  @Column({ name: 'pessoa_nome', type: 'varchar', nullable: true })
  pessoa_nome: string | null;

  /** Aluno isento: ainda não era matriculado nessa data — não conta como falta */
  @Column({ type: 'boolean', nullable: true, default: false })
  isento: boolean;

  /** Falta justificada — ausência com justificativa */
  @Column({ type: 'boolean', nullable: true, default: false })
  justificada: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
