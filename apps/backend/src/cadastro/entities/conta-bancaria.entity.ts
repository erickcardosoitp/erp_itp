import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('contas_bancarias')
export class ContaBancaria {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  banco: string;

  @Column({ type: 'varchar', nullable: true })
  agencia: string;

  @Column({ type: 'varchar' })
  conta: string;

  @Column({ type: 'varchar', default: 'Corrente' })
  tipo: string;

  @Column({ type: 'varchar' })
  titular: string;

  @Column({ type: 'varchar', nullable: true })
  pix: string;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  /** Código interno gerado automaticamente: ITP-BNCO-YYYYMM-NNN */
  @Column({ type: 'text', nullable: true, unique: true })
  codigo_interno: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
