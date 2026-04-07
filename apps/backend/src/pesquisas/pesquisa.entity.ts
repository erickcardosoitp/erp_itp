import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export interface PerguntaPesquisa {
  id: string;
  texto: string;
  tipo: 'nota' | 'texto'; // nota = estrelas 1-5, texto = campo aberto
}

@Entity('pesquisas')
export class Pesquisa {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  titulo: string;

  @Column({ type: 'text' })
  tipo: string; // 'Academica' | 'Interna' | 'Programa'

  @Column({ type: 'text', nullable: true })
  categoria: string | null; // 'Academico' | 'Financeiro' | 'Estoque' | 'Matriculas' | 'Institucional' | 'Operacional'

  @Column({ type: 'jsonb', nullable: true })
  perguntas: PerguntaPesquisa[];

  @Column({ name: 'data_limite', type: 'timestamptz', nullable: true })
  data_limite: Date;

  @Column({ type: 'text', default: 'aberta' })
  status: string; // 'aberta' | 'encerrada'

  @Column({ name: 'link_unico', type: 'text', unique: true })
  link_unico: string;

  @Column({ name: 'criado_por_id', type: 'text', nullable: true })
  criado_por_id: string;

  @Column({ name: 'criado_por_nome', type: 'text', nullable: true })
  criado_por_nome: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
