import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GenteController } from './gente.controller';
import { GenteService } from './gente.service';
import { GenteColaborador } from './entities/gente-colaborador.entity';
import { GentePonto } from './entities/gente-ponto.entity';
import { GenteRecibo } from './entities/gente-recibo.entity';
import { GenteVale } from './entities/gente-vale.entity';
import { GenteAdvertencia } from './entities/gente-advertencia.entity';
import { GenteSuspensao } from './entities/gente-suspensao.entity';
import { GenteFalta } from './entities/gente-falta.entity';
import { GenteCodigoAjuda } from './entities/gente-codigo-ajuda.entity';
import { GenteColaboradorCodigo } from './entities/gente-colaborador-codigo.entity';
import { GenteColaboradorLocal } from './entities/gente-colaborador-local.entity';
import { GenteFolgaSolicitacao } from './entities/gente-folga-solicitacao.entity';
import { GenteTrabalhoExterno } from './entities/gente-trabalho-externo.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GenteColaborador, GentePonto, GenteRecibo, GenteVale,
      GenteAdvertencia, GenteSuspensao, GenteFalta,
      GenteCodigoAjuda, GenteColaboradorCodigo, GenteColaboradorLocal,
      GenteFolgaSolicitacao, GenteTrabalhoExterno,
    ]),
  ],
  controllers: [GenteController],
  providers: [GenteService],
  exports: [GenteService],
})
export class GenteModule {}
