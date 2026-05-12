import { IsString, IsOptional, IsBoolean, IsInt } from 'class-validator';

export class CreateProjetoDto {
  @IsString()
  nome: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsString()
  data_inicio: string;

  @IsString()
  data_fim: string;

  @IsOptional()
  @IsInt()
  pulseira_largura_mm?: number;

  @IsOptional()
  @IsInt()
  pulseira_altura_mm?: number;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
