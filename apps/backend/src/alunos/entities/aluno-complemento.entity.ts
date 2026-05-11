import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  OneToOne, JoinColumn, Index,
} from 'typeorm';
import { Aluno } from '../aluno.entity';

export enum TipoConta {
  CORRENTE  = 'corrente',
  POUPANCA  = 'poupanca',
}

export enum Genero {
  MASCULINO          = 'masculino',
  FEMININO           = 'feminino',
  NAO_BINARIO        = 'nao_binario',
  PREFIRO_NAO        = 'prefiro_nao_informar',
}

@Entity('alunos_complemento')
export class AlunoComplemento {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'uuid' })
  aluno_id: string;

  @OneToOne(() => Aluno, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'aluno_id' })
  aluno: Aluno;

  // ── Documentação ──────────────────────────────────────────────────
  @Column({ type: 'varchar', nullable: true })
  rg: string | null;

  @Column({ type: 'varchar', nullable: true })
  orgao_expedidor: string | null;

  @Column({ type: 'char', length: 2, nullable: true })
  uf_expedicao: string | null;

  @Column({ type: 'varchar', nullable: true })
  genero: string | null;

  // ── Dados Bancários ───────────────────────────────────────────────
  @Column({ type: 'varchar', nullable: true })
  banco: string | null;

  @Column({ type: 'varchar', nullable: true })
  agencia: string | null;

  @Column({ type: 'varchar', nullable: true })
  agencia_digito: string | null;

  @Column({ type: 'varchar', nullable: true })
  conta_corrente: string | null;

  @Column({ type: 'varchar', nullable: true })
  conta_digito: string | null;

  @Column({ type: 'varchar', nullable: true })
  tipo_conta: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
