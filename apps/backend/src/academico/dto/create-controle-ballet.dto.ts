import { IsNotEmpty, IsOptional, IsString, IsBoolean, IsNumber, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateControleBallétDto {
  @IsNotEmpty()
  @IsString()
  aluno_id: string;

  @IsOptional() @IsString() tamanho_roupa?: string;
  @IsOptional() @IsString() numero_sapatilha?: string;
  @IsOptional() @IsString() tamanho_meia?: string;
  @IsOptional() @IsString() estoque_roupa_id?: string;
  @IsOptional() @IsString() estoque_sapatilha_id?: string;
  @IsOptional() @IsBoolean() roupa_encomendada?: boolean;
  @IsOptional() @IsBoolean() sapatilha_encomendada?: boolean;
  @IsOptional() @IsBoolean() roupa_entregue?: boolean;
  @IsOptional() @IsBoolean() sapatilha_entregue?: boolean;
  @IsOptional() @IsString() itens_pendentes?: string;

  @IsOptional() @IsNumber() @Type(() => Number) valor_total?: number;
  @IsOptional() @IsNumber() @Type(() => Number) valor_entrada?: number;
  @IsOptional() @IsString() data_entrada?: string;
  @IsOptional() @IsString() forma_pagamento?: string;
  @IsOptional() @IsInt() @Type(() => Number) num_parcelas?: number;
  @IsOptional() @IsNumber() @Type(() => Number) valor_parcela?: number;
  @IsOptional() @IsString() venc_1?: string;
  @IsOptional() @IsString() venc_2?: string;
  @IsOptional() @IsString() venc_3?: string;
  @IsOptional() @IsString() status_pagamento?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() observacoes?: string;
}
