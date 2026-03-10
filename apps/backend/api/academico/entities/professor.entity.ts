import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('professores')
export class Professor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  nome: string;

  @Column({ type: 'text', nullable: true })
  especialidade: string;

  @Column({ type: 'text', nullable: true })
  email: string;

  @Column({ nullable: true, default: true })
  ativo: boolean;
}
