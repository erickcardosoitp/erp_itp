import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('users') // Nome da tabela no Postgres
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  username: string; // erick_cardoso

  @Column({ type: 'varchar', unique: true })
  email: string; // goncalvecardoso@gmail.com

  @Column({ type: 'varchar', default: 'ADMIN' })
  role: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}