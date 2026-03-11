import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn, Index,
} from 'typeorm';
import { Usuario } from '../usuarios/usuario.entity';
import { Inscricao } from '../matriculas/inscricao.entity';

@Entity('alunos')
export class Aluno {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** ITP-YYYY-MMDDX  ex: ITP-2026-03081 */
  @Column({ unique: true })
  @Index()
  numero_matricula: string;

  // ── Identificação ────────────────────────────────────────────────
  @Column()
  nome_completo: string;

  @Column({ unique: true, nullable: true })
  cpf: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  celular: string;

  @Column({ nullable: true })
  data_nascimento: string;

  @Column({ nullable: true, type: 'int' })
  idade: number;

  @Column({ nullable: true })
  sexo: string;

  @Column({ nullable: true })
  escolaridade: string;

  @Column({ nullable: true })
  turno_escolar: string;

  // ── Endereço ─────────────────────────────────────────────────────
  @Column({ nullable: true })
  logradouro: string;

  @Column({ nullable: true })
  numero: string;

  @Column({ nullable: true })
  complemento: string;

  @Column({ nullable: true })
  cidade: string;

  @Column({ nullable: true })
  bairro: string;

  @Column({ nullable: true })
  estado_uf: string;

  @Column({ nullable: true })
  cep: string;

  // ── Responsável ──────────────────────────────────────────────────
  @Column({ type: 'boolean', nullable: true })
  maior_18_anos: boolean;

  @Column({ nullable: true })
  nome_responsavel: string;

  @Column({ nullable: true })
  grau_parentesco: string;

  @Column({ nullable: true })
  cpf_responsavel: string;

  @Column({ nullable: true })
  telefone_alternativo: string;

  // ── Saúde ────────────────────────────────────────────────────────
  @Column({ nullable: true })
  possui_alergias: string;

  @Column({ nullable: true })
  cuidado_especial: string;

  @Column({ type: 'text', nullable: true })
  detalhes_cuidado: string;

  @Column({ nullable: true })
  uso_medicamento: string;

  // ── Cursos ───────────────────────────────────────────────────────
  /** Cursos efetivamente matriculados (pode diferir do desejado) */
  @Column({ type: 'text', nullable: true })
  cursos_matriculados: string;

  // ── Termos ───────────────────────────────────────────────────────
  @Column({ type: 'boolean', default: false })
  lgpd_aceito: boolean;

  @Column({ type: 'boolean', default: false })
  autoriza_imagem: boolean;

  // ── Status ───────────────────────────────────────────────────────
  @Column({ default: true })
  ativo: boolean;

  @Column({ type: 'timestamp', nullable: true })
  data_matricula: Date;

  // ── Vínculos ─────────────────────────────────────────────────────
  /** Inscrição de origem */
  @OneToOne(() => Inscricao, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'inscricao_id' })
  inscricao: Inscricao;

  /** Conta de acesso ao sistema (opcional) */
  @OneToOne(() => Usuario, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
