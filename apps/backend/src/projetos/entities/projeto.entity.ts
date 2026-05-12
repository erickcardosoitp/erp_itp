import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToMany,
} from 'typeorm';
import { ProjetoEquipe } from './projeto-equipe.entity';
import { ProjetoInscricao } from './projeto-inscricao.entity';

@Entity('projetos')
export class Projeto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  nome: string;

  @Column({ type: 'text', nullable: true })
  descricao: string | null;

  @Column({ name: 'data_inicio', type: 'date' })
  data_inicio: string;

  @Column({ name: 'data_fim', type: 'date' })
  data_fim: string;

  @Column({ name: 'pulseira_largura_mm', type: 'int', default: 54 })
  pulseira_largura_mm: number;

  @Column({ name: 'pulseira_altura_mm', type: 'int', default: 25 })
  pulseira_altura_mm: number;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @OneToMany(() => ProjetoEquipe, e => e.projeto)
  equipes: ProjetoEquipe[];

  @OneToMany(() => ProjetoInscricao, i => i.projeto)
  inscricoes: ProjetoInscricao[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
