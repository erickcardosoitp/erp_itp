import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn
} from 'typeorm';
import { Inscricao } from './inscricao.entity';

@Entity('inscricao_anotacoes')
export class InscricaoAnotacao {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'inscricao_id' })
  inscricao_id: number;

  @ManyToOne(() => Inscricao, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inscricao_id' })
  inscricao: Inscricao;

  @Column({ type: 'text' })
  texto_anotacao: string;

  @Column({ name: 'usuario_id', type: 'varchar', nullable: true })
  usuario_id: string | null;

  @Column({ name: 'usuario_nome', type: 'varchar', nullable: true })
  usuario_nome: string;

  @Column({ name: 'usuario_foto', type: 'varchar', nullable: true })
  usuario_foto: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
