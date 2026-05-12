import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { Projeto } from './projeto.entity';
import { ProjetoEquipe } from './projeto-equipe.entity';

export enum TipoInscricaoProjeto {
  REGULAR = 'regular',
  EXTERNO = 'externo',
}

export enum StatusInscricaoProjeto {
  INSCRITO   = 'inscrito',
  CONFIRMADO = 'confirmado',
  CANCELADO  = 'cancelado',
}

@Entity('projeto_inscricoes')
export class ProjetoInscricao {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'projeto_id', type: 'uuid' })
  projeto_id: string;

  @ManyToOne(() => Projeto, p => p.inscricoes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projeto_id' })
  projeto: Projeto;

  @Column({ name: 'equipe_id', type: 'uuid', nullable: true })
  equipe_id: string | null;

  @ManyToOne(() => ProjetoEquipe, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'equipe_id' })
  equipe: ProjetoEquipe | null;

  @Column({ name: 'aluno_id', type: 'uuid', nullable: true })
  aluno_id: string | null;

  @Column({ type: 'varchar', default: TipoInscricaoProjeto.EXTERNO })
  tipo: string;

  @Column({ name: 'nome_completo', type: 'varchar' })
  nome_completo: string;

  @Column({ name: 'data_nascimento', type: 'date', nullable: true })
  data_nascimento: string | null;

  @Column({ name: 'nome_responsavel', type: 'varchar', nullable: true })
  nome_responsavel: string | null;

  @Column({ name: 'telefone_responsavel', type: 'varchar', nullable: true })
  telefone_responsavel: string | null;

  @Column({ name: 'cuidado_especial', type: 'varchar', nullable: true })
  cuidado_especial: string | null;

  @Column({ name: 'detalhes_cuidado', type: 'text', nullable: true })
  detalhes_cuidado: string | null;

  @Column({ type: 'varchar', default: StatusInscricaoProjeto.INSCRITO })
  status: string;

  @Column({ name: 'convertido_em_aluno', type: 'boolean', default: false })
  convertido_em_aluno: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
