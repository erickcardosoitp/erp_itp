import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { SupabaseController } from './supabase.controller';
import { NotificacoesModule } from '../../notificacoes/notificacoes.module';

@Global()
@Module({
  imports: [NotificacoesModule],
  controllers: [SupabaseController],
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class SupabaseModule {}
