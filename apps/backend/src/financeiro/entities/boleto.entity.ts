import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('boletos')
export class Boleto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  recebedor: string;

  @Column({ type: 'text' })
  credor: string;

  @Column({ type: 'text', nullable: true })
  cnpj: string | null;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  valor: number;

  @Column({ type: 'text', nullable: true })
  cod_barras: string | null;

  @Column({ type: 'date' })
  data_emissao: string;

  @Column({ default: false })
  parcelado: boolean;

  @Column({ default: 1 })
  qtd_parcelas: number;

  @Column({ type: 'text', default: 'Pendente' })
  status: string;

  @Column({ type: 'text', nullable: true })
  arquivo_base64: string | null;

  @Column({ type: 'text', nullable: true })
  arquivo_nome: string | null;

  @Column({ type: 'text', nullable: true })
  descricao: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
