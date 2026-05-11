import { IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';
import { Genero, TipoConta } from '../entities/aluno-complemento.entity';

export class UpsertComplementoDto {
  // ── Documentação ──────────────────────────────────────────────────
  @IsOptional() @IsString()
  rg?: string;

  @IsOptional() @IsString()
  orgao_expedidor?: string;

  @IsOptional() @IsString() @Length(2, 2)
  uf_expedicao?: string;

  @IsOptional() @IsEnum(Genero)
  genero?: Genero;

  // ── Dados Bancários ───────────────────────────────────────────────
  @IsOptional() @IsString()
  banco?: string;

  @IsOptional() @IsString()
  agencia?: string;

  @IsOptional() @IsString()
  agencia_digito?: string;

  @IsOptional() @IsString()
  conta_corrente?: string;

  @IsOptional() @IsString()
  conta_digito?: string;

  @IsOptional() @IsEnum(TipoConta)
  tipo_conta?: TipoConta;
}
