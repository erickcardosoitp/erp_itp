import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum StatusMatricula {
  PENDENTE = 'Pendente',
  AGUARDANDO_LGPD = 'Aguardando Assinatura do Termo',
  CONFIRMADA = 'Confirmada',
  MATRICULADO = 'Matriculado',
  DESISTENTE = 'Desistente'
}

@Entity('inscricoes')
export class Inscricao {
  @PrimaryGeneratedColumn() // Mantendo compatível com o seu banco (Integer)
  id: number;

  // Campos obrigatórios do Script
  @Column() nome_completo: string;
  @Column({ unique: true }) cpf: string;
  @Column() email: string;
  @Column() celular: string;

  // Outros campos importantes do Forms (Exemplos de mapeamento)
  @Column({ nullable: true }) data_nascimento: string;
  @Column({ nullable: true }) idade: number;
  @Column({ nullable: true }) sexo: string;
  @Column({ nullable: true }) escolaridade: string;
  @Column({ type: 'boolean', nullable: true }) maior_18_anos: boolean;
  @Column({ type: 'boolean', nullable: true }) autoriza_imagem: boolean;

  // Status ajustado para VARCHAR para evitar erros de Cast no Postgres
  @Column({
    type: 'varchar',
    default: StatusMatricula.PENDENTE
  })
  status_matricula: string;

  @Column({ nullable: true }) url_documentos_zip: string;
  @Column({ nullable: true }) url_termo_lgpd: string;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}