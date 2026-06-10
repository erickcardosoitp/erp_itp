import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Projeto } from './entities/projeto.entity';
import { ProjetoEquipe } from './entities/projeto-equipe.entity';
import { ProjetoInscricao } from './entities/projeto-inscricao.entity';
import { ProjetoPresenca } from './entities/projeto-presenca.entity';
import { ProjetoInscricaoDocumento } from './entities/projeto-inscricao-documento.entity';
import { ProjetosService } from './projetos.service';
import { ProjetosController } from './projetos.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Projeto, ProjetoEquipe, ProjetoInscricao, ProjetoPresenca, ProjetoInscricaoDocumento])],
  controllers: [ProjetosController],
  providers: [ProjetosService],
  exports: [ProjetosService],
})
export class ProjetosModule {}
