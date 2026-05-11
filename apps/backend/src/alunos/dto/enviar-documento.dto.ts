import { IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';
import { TipoDocumentoValidacao } from '../entities/documento-validacao.entity';

export class EnviarDocumentoDto {
  @IsEnum(TipoDocumentoValidacao)
  tipo: TipoDocumentoValidacao;

  @IsString()
  url_drive: string;
}

export class ValidarDocumentoDto {
  @IsOptional() @IsString()
  validado_por_nome?: string;
}

export class InvalidarDocumentoDto {
  @IsString()
  motivo_pendencia: string;

  @IsOptional() @IsString()
  validado_por_nome?: string;
}
