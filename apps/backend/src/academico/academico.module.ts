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
import { Aluno } from '../alunos/aluno.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Curso, Professor, Turma, TurmaAluno, GradeHoraria, DiarioAcademico, Aluno]),
  ],
  controllers: [AcademicoController],
  providers: [AcademicoService],
})
export class AcademicoModule {}
