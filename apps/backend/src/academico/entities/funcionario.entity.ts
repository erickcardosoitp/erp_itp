import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';

@Entity('funcionarios')
export class Funcionario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  nome: string;

  @Column({ type: 'text', nullable: true })
  cargo: string;

  @Column({ type: 'text', nullable: true })
  email: string;

  @Column({ type: 'text', nullable: true })
  cpf: string;

  @Column({ type: 'date', nullable: true })
  data_nascimento: string;

  @Column({ type: 'text', nullable: true })
  celular: string;

  @Column({ type: 'text', nullable: true })
  sexo: string;

  @Column({ type: 'text', nullable: true })
  raca_cor: string;

  @Column({ type: 'text', nullable: true })
  escolaridade: string;

  @Column({ type: 'text', nullable: true })
  cep: string;

  @Column({ type: 'text', nullable: true })
  logradouro: string;

  @Column({ type: 'text', nullable: true })
  numero_residencia: string;

  @Column({ type: 'text', nullable: true })
  bairro: string;

  @Column({ type: 'text', nullable: true })
  cidade: string;

  @Column({ type: 'text', nullable: true })
  complemento: string;

  @Column({ type: 'text', nullable: true })
  estado: string;

  @Column({ type: 'text', nullable: true })
  telefone_emergencia_1: string;

  @Column({ type: 'text', nullable: true })
  telefone_emergencia_2: string;

  @Column({ type: 'boolean', nullable: true, default: false })
  possui_deficiencia: boolean;

  @Column({ type: 'text', nullable: true })
  deficiencia_descricao: string;

  @Column({ type: 'boolean', nullable: true, default: false })
  possui_alergias: boolean;

  @Column({ type: 'text', nullable: true })
  alergias_descricao: string;

  @Column({ type: 'boolean', nullable: true, default: false })
  usa_medicamentos: boolean;

  @Column({ type: 'text', nullable: true })
  medicamentos_descricao: string;

  @Column({ type: 'boolean', nullable: true, default: false })
  possui_plano_saude: boolean;

  @Column({ type: 'text', nullable: true })
  plano_saude: string;

  @Column({ type: 'text', nullable: true })
  numero_sus: string;

  @Column({ type: 'boolean', nullable: true, default: false })
  interesse_cursos: boolean;

  @Column({ nullable: true, default: true })
  ativo: boolean;

  @Column({ type: 'text', nullable: true, unique: true })
  matricula: string;

  /** UUID do usuário do sistema vinculado a este funcionário (preenchido quando o admin cria o login) */
  @Column({ type: 'uuid', nullable: true, unique: true, name: 'usuario_id' })
  usuario_id: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
