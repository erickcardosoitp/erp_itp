import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CriarChamadoPublicoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nome: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  telefone: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  nome_aluno?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  assunto: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  mensagem: string;
}
