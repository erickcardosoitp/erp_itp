import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GruposService } from './grupos.service';
import { GruposController } from './grupos.controller';
import { Grupo } from './grupo.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Grupo])], // ✅ Registra a entidade no TypeORM
  controllers: [GruposController],               // ✅ Ativa as rotas
  providers: [GruposService],                 // ✅ Ativa a lógica de negócio
  exports: [GruposService],                   // ✅ Permite que outros módulos usem este serviço
})
export class GruposModule {}