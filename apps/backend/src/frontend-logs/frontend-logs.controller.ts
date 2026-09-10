import { Body, Controller, Logger, Post } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';

/**
 * Ponte entre erros de renderização do React (capturados no navegador pelo
 * PageErrorBoundary em ClientShell.tsx) e o docker logs do backend — sem
 * isso, um crash client-side nunca aparece em lugar nenhum que o coletor
 * de erros consiga ler (achado em teste real, 2026-09-10). @Public()
 * porque um crash pode acontecer até com sessão de auth quebrada.
 */
@Controller('frontend-logs')
export class FrontendLogsController {
  private readonly logger = new Logger('FrontendError');

  @Public()
  @Post()
  registrar(@Body() body: { message?: string; stack?: string; pathname?: string }) {
    this.logger.error(
      `Crash de UI em ${body.pathname ?? '(rota desconhecida)'}: ${body.message ?? '(sem mensagem)'}\n${body.stack ?? ''}`,
    );
    return { ok: true };
  }
}
