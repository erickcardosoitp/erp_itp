import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('contas_bancarias')
export class ContaBancaria {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  banco: string;

  @Column({ nullable: true })
  agencia: string;

  @Column()
  conta: string;

  @Column({ default: 'Corrente' })
  tipo: string;

  @Column()
  titular: string;

  @Column({ nullable: true })
  pix: string;

  @Column({ default: true })
  ativo: boolean;

  /** Código interno gerado automaticamente: ITP-BNCO-YYYYMM-NNN */
  @Column({ type: 'text', nullable: true, unique: true })
  codigo_interno: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
