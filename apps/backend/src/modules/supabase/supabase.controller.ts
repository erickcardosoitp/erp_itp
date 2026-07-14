import { Controller, Get, Headers, HttpCode, HttpStatus, Logger, UnauthorizedException } from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator';
import { SupabaseService } from './supabase.service';
import { NotificacoesService } from '../../notificacoes/notificacoes.service';
import { EmailService } from '../../email.service';

const ALERTA_TIPO = 'sistema';
const ALERTA_REFERENCIA = 'supabase_storage';
const EMAIL_ALERTA = 'dev.itp@institutotiapretinha.org';

@Controller('supabase')
export class SupabaseController {
  private readonly logger = new Logger(SupabaseController.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly notificacoes: NotificacoesService,
    private readonly email: EmailService,
  ) {}

  /**
   * Endpoint de Cron Job — verifica conectividade com o Supabase Storage.
   * Protegido pelo header x-cron-secret (local) ou Authorization Bearer (Vercel Cron).
   * Alerta (notificação + e-mail) quando detecta falha; some o alerta quando se recupera.
   */
  @Public()
  @Get('cron/health-check')
  @HttpCode(HttpStatus.OK)
  async cronHealthCheck(
    @Headers('x-cron-secret') cronSecret: string,
    @Headers('authorization') authHeader: string,
  ) {
    const expected = process.env.CRON_SECRET;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!expected || (cronSecret !== expected && bearerToken !== expected)) {
      throw new UnauthorizedException('Cron secret inválido.');
    }

    const resultado = await this.supabase.checkHealth();
    const alertaExistente = await this.notificacoes.buscarNaoLida(ALERTA_TIPO, ALERTA_REFERENCIA);

    if (!resultado.ok) {
      this.logger.error(`Supabase Storage indisponível: ${resultado.error}`);
      if (!alertaExistente) {
        await this.notificacoes.criar({
          tipo: ALERTA_TIPO,
          titulo: '🔴 Supabase Storage indisponível',
          mensagem: `O armazenamento de documentos parou de responder: ${resultado.error}. Uploads e visualização de documentos podem estar quebrados. Verifique se o projeto foi pausado em supabase.com/dashboard.`,
          referencia_tipo: ALERTA_REFERENCIA,
          cargo_minimo: 8, // drt e acima
        });
        await this.email.enviarGenerico(
          EMAIL_ALERTA,
          '🔴 ITP ERP — Supabase Storage indisponível',
          `<p>O armazenamento de documentos (Supabase Storage) parou de responder.</p>
           <p><strong>Erro:</strong> ${resultado.error}</p>
           <p>Uploads e visualização de documentos de alunos/projetos podem estar quebrados agora.</p>
           <p>Verifique em <a href="https://supabase.com/dashboard">supabase.com/dashboard</a> (conta dev.itp@institutotiapretinha.org, projeto erp-itp) se o projeto foi pausado.</p>`,
        ).catch(err => this.logger.error(`Falha ao enviar e-mail de alerta: ${err.message}`));
      }
    } else if (alertaExistente) {
      await this.notificacoes.marcarLida(alertaExistente.id);
      this.logger.log('Supabase Storage voltou a responder — alerta anterior marcado como lido.');
    }

    return { ok: resultado.ok, error: resultado.error ?? null, checkedAt: new Date().toISOString() };
  }
}
