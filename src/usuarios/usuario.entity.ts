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
}