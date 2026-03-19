import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('doadores')
export class Doador {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  nome: string;

  @Column({ type: 'varchar', default: 'PF' })
  tipo: string;

  @Column({ type: 'varchar', nullable: true })
  cpf_cnpj: string;

  @Column({ type: 'varchar', nullable: true })
  email: string;

  @Column({ type: 'varchar', nullable: true })
  telefone: string;

  @Column({ type: 'varchar', nullable: true })
  cidade: string;

  @Column({ nullable: true, type: 'text' })
  observacoes: string;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  /** Código interno gerado automaticamente: ITP-DOAD-YYYYMM-NNN */
  @Column({ type: 'text', nullable: true, unique: true })
  codigo_interno: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
