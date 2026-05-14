import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, OneToMany,
} from 'typeorm';
import { Projeto } from './projeto.entity';
import { ProjetoInscricao } from './projeto-inscricao.entity';

@Entity('projeto_equipes')
export class ProjetoEquipe {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'projeto_id', type: 'uuid' })
  projeto_id: string;

  @ManyToOne(() => Projeto, p => p.equipes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projeto_id' })
  projeto: Projeto;

  @Column({ type: 'varchar' })
  nome: string;

  @Column({ type: 'varchar', default: '#7c3aed' })
  cor: string;

  @Column({ name: 'imagem_template', type: 'text', nullable: true })
  imagem_template: string | null;

  @Column({ name: 'faixa_min', type: 'int', nullable: true })
  faixa_min: number | null;

  @Column({ name: 'faixa_max', type: 'int', nullable: true })
  faixa_max: number | null;

  @OneToMany(() => ProjetoInscricao, i => i.equipe)
  inscricoes: ProjetoInscricao[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
