import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn
} from 'typeorm';
import { Inscricao } from './inscricao.entity';

@Entity('inscricao_movimentacoes')
export class InscricaoMovimentacao {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'inscricao_id' })
  inscricao_id: number;

  @ManyToOne(() => Inscricao, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inscricao_id' })
  inscricao: Inscricao;

  @Column({ name: 'usuario_id', type: 'varchar', nullable: true })
  usuario_id: string | null;

  @Column({ name: 'usuario_nome', type: 'varchar', nullable: true })
  usuario_nome: string;

  // 'Edição', 'Status', 'Exclusão', etc.
  @Column({ name: 'tipo', type: 'varchar' })
  tipo: string;

  // Ex: 'status_matricula', 'nome_completo', etc.
  @Column({ name: 'categoria', type: 'varchar', nullable: true })
  categoria: string;

  @Column({ name: 'valor_antes', type: 'text', nullable: true })
  valor_antes: string;

  @Column({ name: 'valor_depois', type: 'text', nullable: true })
  valor_depois: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
