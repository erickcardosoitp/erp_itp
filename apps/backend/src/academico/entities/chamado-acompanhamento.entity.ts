import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('chamados_acompanhamentos')
export class ChamadoAcompanhamento {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'chamado_id', type: 'uuid' })
  chamado_id: string;

  @Column({ type: 'text' })
  conteudo: string;

  @Column({ name: 'autor_nome', type: 'varchar', nullable: true })
  autor_nome: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
