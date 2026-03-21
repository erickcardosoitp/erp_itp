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
  @Column({ type: 'varchar', unique: true })
  @Index()
  numero_matricula: string;

  // ── Identificação ────────────────────────────────────────────────
  @Column({ type: 'varchar' })
  nome_completo: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  cpf: string;

  @Column({ type: 'varchar', nullable: true })
  email: string;

  @Column({ type: 'varchar', nullable: true })
  celular: string;

  @Column({ type: 'date', nullable: true })
  data_nascimento: string;

  @Column({ nullable: true, type: 'int' })
  idade: number;

  @Column({ type: 'varchar', nullable: true })
  sexo: string;

  @Column({ type: 'varchar', nullable: true })
  escolaridade: string;

  @Column({ type: 'varchar', nullable: true })
  turno_escolar: string;

  // ── Endereço ─────────────────────────────────────────────────────
  @Column({ type: 'varchar', nullable: true })
  logradouro: string;

  @Column({ type: 'varchar', nullable: true })
  numero: string;

  @Column({ type: 'varchar', nullable: true })
  complemento: string;

  @Column({ type: 'varchar', nullable: true })
  cidade: string;

  @Column({ type: 'varchar', nullable: true })
  bairro: string;

  @Column({ type: 'varchar', nullable: true })
  estado_uf: string;

  @Column({ type: 'varchar', nullable: true })
  cep: string;

  // ── Responsável ──────────────────────────────────────────────────
  @Column({ type: 'boolean', nullable: true })
  maior_18_anos: boolean;

  @Column({ type: 'varchar', nullable: true })
  nome_responsavel: string;

  @Column({ type: 'varchar', nullable: true })
  email_responsavel: string;

  @Column({ type: 'varchar', nullable: true })
  grau_parentesco: string;

  @Column({ type: 'varchar', nullable: true })
  cpf_responsavel: string;

  @Column({ type: 'varchar', nullable: true })
  telefone_alternativo: string;

  // ── Saúde ────────────────────────────────────────────────────────
  @Column({ type: 'varchar', nullable: true })
  possui_alergias: string;

  @Column({ type: 'varchar', nullable: true })
  cuidado_especial: string;

  @Column({ type: 'text', nullable: true })
  detalhes_cuidado: string;

  @Column({ type: 'varchar', nullable: true })
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
  @Column({ type: 'boolean', default: true })
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
