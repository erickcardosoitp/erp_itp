import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum UserRole {
  ADMIN = 'admin',
  PROFESSOR = 'professor',
  ASSISTENTE = 'assistente'
}

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nome: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false }) // A senha não deve aparecer em buscas comuns por segurança
  password: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.ASSISTENTE,
  })
  role: UserRole;

  @CreateDateColumn()
  createdAt: Date;
}