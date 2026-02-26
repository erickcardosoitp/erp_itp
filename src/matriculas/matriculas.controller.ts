import { Controller, Post, Body, Get, Param, Patch, BadRequestException } from '@nestjs/common';
import { MatriculasService } from './matriculas.service';

@Controller('matriculas') // A URL será: http://localhost:3000/matriculas
export class MatriculasController {
  constructor(private readonly matriculasService: MatriculasService) {}

  /**
   * WEBHOOK PARA O GOOGLE FORMS
   * Recebe os dados do script e inicia a esteira como PENDENTE
   */
  @Post('inscricao')
  async receberInscricao(@Body() dados: any) {
    // Validação básica: se o nome não vier, o formulário falhou
    if (!dados.nome_completo) {
      throw new BadRequestException('Dados do formulário incompletos.');
    }
    return await this.matriculasService.receberInscricao(dados);
  }

  /**
   * TRANSIÇÃO DE ESTEIRA: Concluir Matrícula
   * Transforma o registro de 'inscricoes' em um registro na tabela 'alunos'
   */
  @Patch(':id/concluir')
  async concluirMatricula(@Param('id') id: string) {
    return await this.matriculasService.finalizarMatricula(id);
  }

  /**
   * CONSULTA PARA O PAINEL DO FISCAL
   * Lista todos que estão na esteira de matrícula
   */
  @Get('todas')
  async listarInscricoes() {
    // Este método chamará uma função de listagem que criaremos no service
    return await this.matriculasService.listarTodas();
  }
}