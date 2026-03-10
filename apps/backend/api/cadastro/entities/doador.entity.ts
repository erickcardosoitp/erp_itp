import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('doadores')
export class Doador {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nome: string;

  @Column({ default: 'PF' })
  tipo: string;

  @Column({ nullable: true })
  cpf_cnpj: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  telefone: string;

  @Column({ nullable: true })
  cidade: string;

  @Column({ nullable: true, type: 'text' })
  observacoes: string;

  @Column({ default: true })
  ativo: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
