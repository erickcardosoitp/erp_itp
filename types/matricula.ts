// types/matricula.ts

export type StatusMatricula = 'Pendente' | 'Incompleto' | 'Desistente' | 'Matriculado';

export interface IMatriculaUpdate {
  nome_completo?: string;
  cpf?: string;
  data_nascimento?: string;
  idade?: number;
  escolaridade?: string;
  turno_escolar?: string;
  possui_alergias?: string;
  uso_medicamento?: string;
  detalhes_cuidado?: string;
  nome_responsavel?: string;
  cpf_responsavel?: string;
}

export interface IStatusUpdate {
  status: StatusMatricula;
  motivo?: string;
}