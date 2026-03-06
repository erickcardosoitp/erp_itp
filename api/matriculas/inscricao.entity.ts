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
  MATRICULADO = 'Matriculado',
  DESISTENTE = 'Desistente',
  CANCELADA = 'Cancelada'
}

@Entity('inscricoes')
export class Inscricao {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'nome_completo' }) 
  nome_completo: string;

  @Column({ unique: true }) 
  cpf: string;

  @Column() 
  email: string;

  @Column() 
  celular: string;

  @Column({ name: 'data_nascimento', nullable: true }) 
  data_nascimento: string;

  @Column({ name: 'idade', nullable: true, type: 'int' }) 
  idade: number; 

  @Column({ name: 'sexo', nullable: true }) 
  sexo: string;

  @Column({ name: 'escolaridade', nullable: true }) 
  escolaridade: string;

  @Column({ name: 'turno_escolar', nullable: true }) 
  turno_escolar: string;

  @Column({ name: 'logradouro', nullable: true }) 
  logradouro: string;

  @Column({ name: 'numero', nullable: true }) 
  numero: string;

  @Column({ name: 'complemento', nullable: true }) 
  complemento: string;

  @Column({ name: 'cidade', nullable: true }) 
  cidade: string;

  @Column({ name: 'bairro', nullable: true }) 
  bairro: string;

  @Column({ name: 'estado_uf', nullable: true }) 
  estado_uf: string;

  @Column({ name: 'cep', nullable: true }) 
  cep: string;

  @Column({ name: 'maior_18_anos', type: 'boolean', nullable: true }) 
  maior_18_anos: boolean;

  @Column({ name: 'nome_responsavel', nullable: true }) 
  nome_responsavel: string;

  @Column({ name: 'grau_parentesco', nullable: true }) 
  grau_parentesco: string;

  @Column({ name: 'cpf_responsavel', nullable: true }) 
  cpf_responsavel: string;

  @Column({ name: 'telefone_alternativo', nullable: true }) 
  telefone_alternativo: string;

  @Column({ name: 'possui_alergias', nullable: true }) 
  possui_alergias: string;

  @Column({ name: 'cuidado_especial', nullable: true }) 
  cuidado_especial: string;

  @Column({ name: 'detalhes_cuidado', type: 'text', nullable: true }) 
  detalhes_cuidado: string;

  @Column({ name: 'uso_medicamento', nullable: true }) 
  uso_medicamento: string;

  @Column({ name: 'cursos_desejados', type: 'text', nullable: true }) 
  cursos_desejados: string;

  @Column({ name: 'autoriza_imagem', type: 'boolean', default: false }) 
  autoriza_imagem: boolean;

  @Column({ name: 'nome_assinatura_imagem', nullable: true }) 
  nome_assinatura_imagem: string;

  @Column({ name: 'lgpd_aceito', type: 'boolean', default: false }) 
  lgpd_aceito: boolean;

  @Column({ name: 'data_assinatura_lgpd', type: 'timestamp', nullable: true }) 
  data_assinatura_lgpd: Date;

  @Column({ name: 'status_matricula', type: 'varchar', default: StatusMatricula.PENDENTE })
  status_matricula: string;

  @Column({ name: 'motivo_status', type: 'text', nullable: true })
  motivo_status: string;

  @Column({ name: 'url_documentos_zip', nullable: true }) 
  url_documentos_zip: string;

  @Column({ name: 'url_termo_lgpd', nullable: true }) 
  url_termo_lgpd: string;

  // RELACIONAMENTO: Aponta para o aluno que foi gerado a partir desta inscrição
  @OneToOne(() => Aluno, { nullable: true })
  @JoinColumn({ name: 'aluno_id' })
  aluno: Aluno;

  @CreateDateColumn({ name: 'created_at' }) 
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' }) 
  updatedAt: Date;
}