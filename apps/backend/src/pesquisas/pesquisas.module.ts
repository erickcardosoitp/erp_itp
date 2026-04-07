import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pesquisa } from './pesquisa.entity';
import { PesquisaResposta } from './pesquisa-resposta.entity';
import { PesquisasService } from './pesquisas.service';
import { PesquisasController } from './pesquisas.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Pesquisa, PesquisaResposta])],
  controllers: [PesquisasController],
  providers: [PesquisasService],
})
export class PesquisasModule {}
