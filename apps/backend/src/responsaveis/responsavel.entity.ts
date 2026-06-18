import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('responsaveis')
export class Responsavel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'nome_completo', type: 'varchar' })
  nome_completo: string;

  @Column({ type: 'varchar', nullable: true })
  cpf: string | null;

  @Column({ name: 'data_nascimento', type: 'date', nullable: true })
  data_nascimento: string | null;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ type: 'varchar', nullable: true })
  telefone: string | null;

  @Column({ type: 'varchar', nullable: true })
  cep: string | null;

  @Column({ type: 'varchar', nullable: true })
  logradouro: string | null;

  @Column({ type: 'varchar', nullable: true })
  numero: string | null;

  @Column({ type: 'varchar', nullable: true })
  complemento: string | null;

  @Column({ type: 'varchar', nullable: true })
  bairro: string | null;

  @Column({ type: 'varchar', nullable: true })
  cidade: string | null;

  @Column({ name: 'estado_uf', type: 'varchar', length: 2, nullable: true })
  estado_uf: string | null;

  @Column({ type: 'varchar', default: 'Brasil' })
  pais: string;

  @Column({ name: 'foto_url', type: 'varchar', nullable: true })
  foto_url: string | null;

  @Column({ name: 'eh_aluno', type: 'boolean', default: false })
  eh_aluno: boolean;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
