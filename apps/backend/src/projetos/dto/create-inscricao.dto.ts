export class CreateInscricaoDto {
  aluno_id?: string;
  equipe_id?: string;
  tipo?: string;
  nome_completo: string;
  data_nascimento?: string;
  nome_responsavel?: string;
  telefone_responsavel?: string;
  cuidado_especial?: string;
  detalhes_cuidado?: string;
  status?: string;
}
