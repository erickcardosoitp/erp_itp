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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GenteColaborador,
      GentePonto,
      GenteRecibo,
      GenteVale,
      GenteAdvertencia,
      GenteSuspensao,
      GenteFalta,
    ]),
  ],
  controllers: [GenteController],
  providers: [GenteService],
  exports: [GenteService],
})
export class GenteModule {}
