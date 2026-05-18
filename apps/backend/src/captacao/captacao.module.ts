import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaptacaoOpportunity } from './entities/captacao-opportunity.entity';
import { PipelineEvent } from './entities/pipeline-event.entity';
import { CaptacaoService } from './captacao.service';
import { CaptacaoController } from './captacao.controller';
import { GeminiService } from './gemini.service';

@Module({
  imports: [TypeOrmModule.forFeature([CaptacaoOpportunity, PipelineEvent])],
  controllers: [CaptacaoController],
  providers: [CaptacaoService, GeminiService],
  exports: [CaptacaoService],
})
export class CaptacaoModule {}
