import { IsString, IsOptional } from 'class-validator';

export class CreateInscricaoDto {
  @IsOptional()
  @IsString()
  aluno_id?: string;

  @IsOptional()
  @IsString()
  equipe_id?: string;

  @IsOptional()
  @IsString()
  tipo?: string;

  @IsString()
  nome_completo: string;

  @IsOptional()
  @IsString()
  data_nascimento?: string;

  @IsOptional()
  @IsString()
  nome_responsavel?: string;

  @IsOptional()
  @IsString()
  telefone_responsavel?: string;

  @IsOptional()
  @IsString()
  cuidado_especial?: string;

  @IsOptional()
  @IsString()
  detalhes_cuidado?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
