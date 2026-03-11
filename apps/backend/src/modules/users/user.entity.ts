import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('users') // Nome da tabela no Postgres
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string; // erick_cardoso

  @Column({ unique: true })
  email: string; // goncalvecardoso@gmail.com

  @Column({ default: 'ADMIN' })
  role: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}