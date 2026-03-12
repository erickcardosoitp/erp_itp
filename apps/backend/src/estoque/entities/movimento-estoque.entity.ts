import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Produto } from './produto.entity';

@Entity('estoque_movimentos')
export class MovimentoEstoque {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  produto_id: string;

  @ManyToOne(() => Produto, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'produto_id' })
  produto: Produto;

  @Column({ type: 'text' })
  tipo: 'entrada' | 'baixa';

  @Column({ type: 'decimal', precision: 12, scale: 3 })
  quantidade: number;

  @Column({ type: 'text', nullable: true })
  observacao: string;

  @Column({ type: 'text', nullable: true })
  usuario_nome: string;

  @CreateDateColumn()
  createdAt: Date;
}
