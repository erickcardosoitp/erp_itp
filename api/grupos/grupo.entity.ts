import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Usuario } from '../usuarios/usuario.entity';

@Entity('grupos')
export class Grupo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  nome: string;

  // ✅ Sincronizado com a coluna JSONB no Neon
  @Column({ type: 'jsonb', name: 'grupo_permissoes', nullable: true })
  grupo_permissoes: any;

  // ✅ Relação inversa para o TypeScript e TypeORM
  @OneToMany(() => Usuario, (usuario) => usuario.grupo)
  usuarios: Usuario[];

  // ✅ Padronizado para snake_case para evitar erros de coluna inexistente
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}