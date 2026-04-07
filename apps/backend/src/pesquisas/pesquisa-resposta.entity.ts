import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export interface RespostaPergunta {
  pergunta_id: string;
  nota?: number;   // 1-5 para tipo 'nota'
  texto?: string;  // para tipo 'texto'
  opcoes_selecionadas?: string[]; // para multipla_escolha e checkbox
}

@Entity('pesquisas_respostas')
export class PesquisaResposta {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'pesquisa_id', type: 'uuid' })
  pesquisa_id: string;

  @Column({ type: 'jsonb' })
  respostas: RespostaPergunta[];

  @Column({ type: 'boolean', default: false })
  expurgado: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
