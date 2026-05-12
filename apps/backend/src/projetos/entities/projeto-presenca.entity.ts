import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn, Unique,
} from 'typeorm';
import { Projeto } from './projeto.entity';
import { ProjetoEquipe } from './projeto-equipe.entity';
import { ProjetoInscricao } from './projeto-inscricao.entity';

@Entity('projeto_presencas')
@Unique(['inscricao_id', 'data'])
export class ProjetoPresenca {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'projeto_id', type: 'uuid' })
  projeto_id: string;

  @ManyToOne(() => Projeto, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projeto_id' })
  projeto: Projeto;

  @Column({ name: 'equipe_id', type: 'uuid', nullable: true })
  equipe_id: string | null;

  @ManyToOne(() => ProjetoEquipe, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'equipe_id' })
  equipe: ProjetoEquipe | null;

  @Column({ name: 'inscricao_id', type: 'uuid' })
  inscricao_id: string;

  @ManyToOne(() => ProjetoInscricao, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inscricao_id' })
  inscricao: ProjetoInscricao;

  @Column({ type: 'date' })
  data: string;

  @Column({ type: 'boolean', default: false })
  presente: boolean;

  @Column({ name: 'hora_entrada', type: 'time', nullable: true })
  hora_entrada: string | null;

  @Column({ name: 'hora_saida', type: 'time', nullable: true })
  hora_saida: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
