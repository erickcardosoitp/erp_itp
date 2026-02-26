import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { Usuario } from '../usuarios/usuario.entity';

@Entity('alunos')
export class Aluno {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  matricula: string; // Ex: ITP-2026-001

  @Column()
  nome: string;

  @Column({ unique: true })
  email: string;

  @Column({ unique: true, nullable: true })
  cpf: string;

  @Column({ nullable: true })
  data_nascimento: string;

  @Column({ default: true })
  ativo: boolean;

  // Vínculo opcional: Nem todo aluno terá acesso ao sistema imediatamente
  @OneToOne(() => Usuario, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  usuario: Usuario;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}