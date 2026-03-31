import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('notificacoes')
export class Notificacao {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Tipo da notificação para ícone/cor automáticos:
   * estoque_minimo | nova_matricula | novo_aluno | nova_doacao | pix_recebido |
   * presenca_pendente | sistema
   */
  @Column({ type: 'text' })
  tipo: string;

  @Column({ type: 'text' })
  titulo: string;

  @Column({ type: 'text' })
  mensagem: string;

  @Column({ type: 'boolean', default: false })
  lida: boolean;

  /** ID da entidade relacionada (produto, aluno, etc.) */
  @Column({ name: 'referencia_id', type: 'text', nullable: true })
  referencia_id: string | null;

  /** Tipo da entidade relacionada */
  @Column({ name: 'referencia_tipo', type: 'text', nullable: true })
  referencia_tipo: string | null;

  /** Se NULL, é global; se preenchido, é só para este usuário */
  @Column({ name: 'usuario_id', type: 'text', nullable: true })
  usuario_id: string | null;

  /** Nível mínimo de role para ver esta notificação (0=todos, 8=drt+). NULL = sem restrição. */
  @Column({ name: 'cargo_minimo', type: 'int', nullable: true })
  cargo_minimo: number | null;

  @CreateDateColumn({ name: 'criado_em' })
  criado_em: Date;
}
