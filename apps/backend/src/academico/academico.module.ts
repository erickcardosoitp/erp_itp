import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicoController } from './academico.controller';
import { AcademicoService } from './academico.service';
import { Curso } from './entities/curso.entity';
import { Professor } from './entities/professor.entity';
import { Turma } from './entities/turma.entity';
import { TurmaAluno } from './entities/turma-aluno.entity';
import { GradeHoraria } from './entities/grade-horaria.entity';
import { DiarioAcademico } from './entities/diario.entity';
import { PresencaSessao } from './entities/presenca-sessao.entity';
import { Aluno } from '../alunos/aluno.entity';
import { Inscricao } from '../matriculas/inscricao.entity';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Curso, Professor, Turma, TurmaAluno, GradeHoraria, DiarioAcademico, PresencaSessao, Aluno, Inscricao]),
    NotificacoesModule,
  ],
  controllers: [AcademicoController],
  providers: [AcademicoService],
  exports: [AcademicoService],
})
export class AcademicoModule {}
