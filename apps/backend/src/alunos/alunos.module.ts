import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Aluno } from './aluno.entity';
import { AlunoComplemento } from './entities/aluno-complemento.entity';
import { DocumentoValidacao } from './entities/documento-validacao.entity';
import { AlunosService } from './alunos.service';
import { AlunosController } from './alunos.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Aluno, AlunoComplemento, DocumentoValidacao]),
  ],
  controllers: [AlunosController],
  providers: [AlunosService],
  exports: [AlunosService],
})
export class AlunosModule {}
