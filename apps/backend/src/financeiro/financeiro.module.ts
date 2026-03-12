import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TipoMovimentacao } from './entities/tipo-movimentacao.entity';
import { PlanoContas } from './entities/plano-contas.entity';
import { CategoriaFinanceira } from './entities/categoria-financeira.entity';
import { TipoPessoa } from './entities/tipo-pessoa.entity';
import { FormaPagamento } from './entities/forma-pagamento.entity';
import { Recorrencia } from './entities/recorrencia.entity';
import { MovimentacaoFinanceira } from './entities/movimentacao-financeira.entity';
import { FinanceiroService } from './financeiro.service';
import { FinanceiroController } from './financeiro.controller';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TipoMovimentacao,
      PlanoContas,
      CategoriaFinanceira,
      TipoPessoa,
      FormaPagamento,
      Recorrencia,
      MovimentacaoFinanceira,
    ]),
    NotificacoesModule,
  ],
  controllers: [FinanceiroController],
  providers: [FinanceiroService],
  exports: [FinanceiroService],
})
export class FinanceiroModule {}
