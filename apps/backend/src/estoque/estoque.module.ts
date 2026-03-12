import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Produto } from './entities/produto.entity';
import { MovimentoEstoque } from './entities/movimento-estoque.entity';
import { CategoriaInsumo } from './entities/categoria-insumo.entity';
import { EstoqueService } from './estoque.service';
import { EstoqueController } from './estoque.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Produto, MovimentoEstoque, CategoriaInsumo])],
  controllers: [EstoqueController],
  providers: [EstoqueService],
  exports: [EstoqueService],
})
export class EstoqueModule {}
