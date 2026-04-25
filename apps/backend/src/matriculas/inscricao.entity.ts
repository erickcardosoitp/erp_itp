import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn,
  OneToOne,
  JoinColumn
} from 'typeorm';
import { Aluno } from '../alunos/aluno.entity';

export enum StatusMatricula {
  PENDENTE = 'Pendente',
  INCOMPLETO = 'Incompleto',
  AGUARDANDO_LGPD = 'Aguardando Assinatura LGPD',
  EM_VALIDACAO = 'Em Validação',
  AGUARDANDO_DOCUMENTOS = 'Aguardando Documentos',
  DOCUMENTOS_ENVIADOS = 'Documentos Enviados',
  MATRICULADO = 'Matriculado',
  DESISTENTE = 'Desistente',
  CANCELADA = 'Cancelada'
}

@Entity('inscricoes')
export class Inscricao {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'nome_completo', type: 'varchar' }) 
  nome_completo: string;

  @Column({ type: 'varchar', nullable: true })
  cpf: string;

  @Column({ type: 'varchar', nullable: true })
  email: string;

  @Column({ type: 'varchar', nullable: true })
  celular: string;

  @Column({ name: 'data_nascimento', type: 'date', nullable: true }) 
  data_nascimento: string;

  @Column({ name: 'idade', nullable: true, type: 'int' }) 
  idade: number; 

  @Column({ name: 'sexo', type: 'varchar', nullable: true }) 
  sexo: string;

  @Column({ name: 'escolaridade', type: 'varchar', nullable: true }) 
  escolaridade: string;

  @Column({ name: 'turno_escolar', type: 'varchar', nullable: true }) 
  turno_escolar: string;

  @Column({ name: 'logradouro', type: 'varchar', nullable: true }) 
  logradouro: string;

  @Column({ name: 'numero', type: 'varchar', nullable: true }) 
  numero: string;

  @Column({ name: 'complemento', type: 'varchar', nullable: true }) 
  complemento: string;

  @Column({ name: 'cidade', type: 'varchar', nullable: true }) 
  cidade: string;

  @Column({ name: 'bairro', type: 'varchar', nullable: true }) 
  bairro: string;

  @Column({ name: 'estado_uf', type: 'varchar', nullable: true }) 
  estado_uf: string;

  @Column({ name: 'cep', type: 'varchar', nullable: true }) 
  cep: string;

  @Column({ name: 'maior_18_anos', type: 'boolean', nullable: true }) 
  maior_18_anos: boolean;

  @Column({ name: 'nome_responsavel', type: 'varchar', nullable: true }) 
  nome_responsavel: string;

  @Column({ name: 'email_responsavel', type: 'varchar', nullable: true }) 
  email_responsavel: string;

  @Column({ name: 'grau_parentesco', type: 'varchar', nullable: true }) 
  grau_parentesco: string;

  @Column({ name: 'cpf_responsavel', type: 'varchar', nullable: true }) 
  cpf_responsavel: string;

  @Column({ name: 'telefone_alternativo', type: 'varchar', nullable: true }) 
  telefone_alternativo: string;

  @Column({ name: 'possui_alergias', type: 'varchar', nullable: true }) 
  possui_alergias: string;

  @Column({ name: 'cuidado_especial', type: 'varchar', nullable: true }) 
  cuidado_especial: string;

  @Column({ name: 'detalhes_cuidado', type: 'text', nullable: true }) 
  detalhes_cuidado: string;

  @Column({ name: 'uso_medicamento', type: 'varchar', nullable: true }) 
  uso_medicamento: string;

  @Column({ name: 'cursos_desejados', type: 'text', nullable: true }) 
  cursos_desejados: string;

  @Column({ name: 'autoriza_imagem', type: 'boolean', default: false }) 
  autoriza_imagem: boolean;

  @Column({ name: 'nome_assinatura_imagem', type: 'varchar', nullable: true }) 
  nome_assinatura_imagem: string;

  @Column({ name: 'lgpd_aceito', type: 'boolean', default: false }) 
  lgpd_aceito: boolean;

  @Column({ name: 'data_assinatura_lgpd', type: 'timestamp', nullable: true }) 
  data_assinatura_lgpd: Date;

  @Column({ name: 'data_inscricao', type: 'timestamp', nullable: true })
  data_inscricao: Date;

  @Column({ name: 'status_matricula', type: 'varchar', default: StatusMatricula.PENDENTE })
  status_matricula: string;

  @Column({ name: 'origem_inscricao', type: 'varchar', nullable: true, default: 'Manual' })
  origem_inscricao: string;

  @Column({ name: 'motivo_status', type: 'text', nullable: true })
  motivo_status: string;

  @Column({ name: 'url_documentos_zip', type: 'varchar', nullable: true }) 
  url_documentos_zip: string;

  @Column({ name: 'url_termo_lgpd', type: 'varchar', nullable: true }) 
  url_termo_lgpd: string;

  @Column({ name: 'lgpd_token', type: 'varchar', nullable: true })
  lgpd_token: string | null;

  @Column({ name: 'lgpd_token_expires_at', type: 'timestamp', nullable: true })
  lgpd_token_expires_at: Date | null;

  @Column({ name: 'lgpd_ip', type: 'varchar', nullable: true })
  lgpd_ip: string | null;

  /** Token para a página pública de envio de documentos */
  @Column({ name: 'doc_token', type: 'varchar', nullable: true, unique: true })
  doc_token: string | null;

  @Column({ name: 'doc_token_expires_at', type: 'timestamp', nullable: true })
  doc_token_expires_at: Date | null;

  // RELACIONAMENTO: Aponta para o aluno que foi gerado a partir desta inscrição
  @OneToOne(() => Aluno, { nullable: true })
  @JoinColumn({ name: 'aluno_id' })
  aluno: Aluno;

  @CreateDateColumn({ name: 'created_at' }) 
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' }) 
  updatedAt: Date;
}