import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn, 
  ManyToOne, 
  JoinColumn 
} from 'typeorm';
import { Grupo } from '../grupos/grupo.entity';

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nome: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false }) // Proteção contra vazamento de hash
  password: string;

  @Column({ type: 'varchar', default: 'assistente' }) 
  role: string;

  // ✅ Coluna física foto_url no Neon
  @Column({ name: 'foto_url', nullable: true })
  fotoUrl: string;

  // Matrícula do funcionário vinculado — usada também como identificador de login
  @Column({ nullable: true, unique: true })
  matricula: string;

  // ✅ Relação ManyToOne com Grupo
  @ManyToOne(() => Grupo, (grupo) => grupo.usuarios, { 
    nullable: true, 
    onDelete: 'SET NULL' 
  })
  @JoinColumn({ name: 'grupo_id' })
  grupo: Grupo;

  // ✅ Ajustado para snake_case 'created_at' para bater com a tabela grupos e Neon
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  /** Token de reset de senha (UUID, expira em 1h) */
  @Column({ name: 'reset_token', nullable: true, select: false })
  resetToken: string;

  /** Data de expiração do token de reset */
  @Column({ name: 'reset_token_expires', type: 'timestamptz', nullable: true, select: false })
  resetTokenExpires: Date;
}