import { IsString, IsOptional, IsInt } from 'class-validator';

export class CreateEquipeDto {
  @IsString()
  nome: string;

  @IsOptional()
  @IsString()
  cor?: string;

  @IsOptional()
  @IsInt()
  faixa_min?: number;

  @IsOptional()
  @IsInt()
  faixa_max?: number;
}
