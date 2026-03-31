import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatriculasService } from './matriculas.service';
import { MatriculasController } from './matriculas.controller';
import { Inscricao } from './inscricao.entity';
import { InscricaoAnotacao } from './inscricao-anotacao.entity';
import { InscricaoMovimentacao } from './inscricao-movimentacao.entity';
import { DocumentoInscricao } from './documento-inscricao.entity';
import { Usuario } from '../usuarios/usuario.entity';
import { Curso } from '../academico/entities/curso.entity';
import { Turma } from '../academico/entities/turma.entity';
import { TurmaAluno } from '../academico/entities/turma-aluno.entity';
import { AcademicoModule } from '../academico/academico.module';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Inscricao,
      InscricaoAnotacao,
      InscricaoMovimentacao,
      DocumentoInscricao,
      Usuario,
      Curso,
      Turma,
      TurmaAluno,
    ]),
    AcademicoModule,
    NotificacoesModule,
  ],
  controllers: [MatriculasController],
  providers: [MatriculasService],
  exports: [MatriculasService],
})
export class MatriculasModule {}
