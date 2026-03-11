import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Insumo } from './entities/insumo.entity';
import { Doador } from './entities/doador.entity';
import { ContaBancaria } from './entities/conta-bancaria.entity';
import { CadastroService } from './cadastro.service';
import { CadastroController } from './cadastro.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Insumo, Doador, ContaBancaria])],
  controllers: [CadastroController],
  providers: [CadastroService],
})
export class CadastroModule {}
