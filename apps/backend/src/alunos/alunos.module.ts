import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Aluno } from './aluno.entity';
import { AlunoComplemento } from './entities/aluno-complemento.entity';
import { DocumentoValidacao } from './entities/documento-validacao.entity';
import { AlunosService } from './alunos.service';
import { AlunosController } from './alunos.controller';
import { SupabaseModule } from '../modules/supabase/supabase.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Aluno, AlunoComplemento, DocumentoValidacao]),
    SupabaseModule,
  ],
  controllers: [AlunosController],
  providers: [AlunosService],
  exports: [AlunosService],
})
export class AlunosModule {}
