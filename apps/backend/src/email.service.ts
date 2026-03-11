import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private isEthereal = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const host = this.config.get<string>('SMTP_HOST');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.config.get<number>('SMTP_PORT') ?? 587,
        secure: (this.config.get<number>('SMTP_PORT') ?? 587) === 465,
        auth: {
          user: this.config.get<string>('SMTP_USER'),
          pass: this.config.get<string>('SMTP_PASS'),
        },
      });
      this.logger.log(`📧 SMTP configurado: ${host}`);
    } else {
      // Cria conta Ethereal automática para desenvolvimento
      try {
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: { user: testAccount.user, pass: testAccount.pass },
        });
        this.isEthereal = true;
        this.logger.warn('⚠️  SMTP_HOST não configurado. Usando Ethereal (SMTP de teste).');
        this.logger.warn(`📬 Caixa de entrada: https://ethereal.email/login`);
        this.logger.warn(`    Usuário: ${testAccount.user}  |  Senha: ${testAccount.pass}`);
      } catch (err: any) {
        this.logger.error(`❌ Falha ao criar conta Ethereal: ${err.message}. E-mails serão apenas logados.`);
      }
    }
  }

  async enviarTermoLGPD(email: string, nome: string, token: string): Promise<void> {
    const appUrl = (this.config.get<string>('APP_URL') || 'http://localhost:3000').replace(/\/$/, '');
    const link = `${appUrl}/lgpd/${token}`;

    if (!this.transporter) {
      this.logger.warn(`📧 [SEM-SMTP] Termo LGPD para ${nome} <${email}>`);
      this.logger.warn(`🔗 Link de assinatura: ${link}`);
      return;
    }

    const primeiroNome = nome.split(' ')[0];
    const html = `
<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Termo LGPD – Instituto Tia Pretinha</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08)">
        
        <!-- Header -->
        <tr>
          <td style="background:#1e3a5f;padding:32px 40px;text-align:center">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700">Instituto Tia Pretinha</h1>
            <p style="margin:6px 0 0;color:#a8c4e0;font-size:14px">CNPJ nº 11.759.851/0001-39</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px">
            <p style="margin:0 0 16px;color:#374151;font-size:16px">Olá, <strong>${primeiroNome}</strong>!</p>
            <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6">
              Para avançar no processo de matrícula no Instituto Tia Pretinha, precisamos que você 
              leia e assine eletronicamente o <strong>Termo de Autorização de Uso de Imagem, Voz e 
              Tratamento de Dados Pessoais (LGPD)</strong>.
            </p>

            <!-- CTA Button -->
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px">
              <tr>
                <td style="background:#1e3a5f;border-radius:8px;padding:16px 36px;text-align:center">
                  <a href="${link}" style="color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;display:block">
                    Assinar Termo LGPD
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 8px;color:#6b7280;font-size:13px;text-align:center">
              Ou copie e cole o link abaixo no seu navegador:
            </p>
            <p style="margin:0 0 32px;font-size:12px;word-break:break-all;text-align:center;color:#9ca3af">
              ${link}
            </p>

            <!-- Info box -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#fef9e7;border:1px solid #f59e0b;border-radius:8px;padding:16px">
                  <p style="margin:0;color:#92400e;font-size:13px;line-height:1.6">
                    ⏰ <strong>Este link é válido por 72 horas</strong> a partir do envio desta mensagem.<br>
                    Se o prazo expirar, solicite um novo link à equipe do Instituto.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 40px;text-align:center">
            <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6">
              Este e-mail foi enviado automaticamente pelo sistema do Instituto Tia Pretinha.<br>
              Se você não se inscreveu, desconsidere esta mensagem.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
    `.trim();

    const info = await this.transporter.sendMail({
      from: `"Instituto Tia Pretinha" <${this.config.get<string>('SMTP_FROM_ADDRESS') || this.config.get<string>('SMTP_USER')}>`  ,
      to: email,
      subject: '📋 Assine seu Termo LGPD – Instituto Tia Pretinha',
      html,
    });

    this.logger.log(`📧 E-mail LGPD enviado para ${email}`);

    if (this.isEthereal) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      this.logger.warn('─────────────────────────────────────────────────────');
      this.logger.warn(`👁️  VISUALIZAR E-MAIL (Ethereal): ${previewUrl}`);
      this.logger.warn(`🔗  Link de assinatura: ${link}`);
      this.logger.warn('─────────────────────────────────────────────────────');
    }
  }

  async enviarLinkDocumentos(email: string, nome: string, token: string): Promise<void> {
    const appUrl = (this.config.get<string>('APP_URL') || 'http://localhost:3000').replace(/\/$/, '');
    const link = `${appUrl}/documentos/${token}`;

    if (!this.transporter) {
      this.logger.warn(`📧 [SEM-SMTP] Link de documentos para ${nome} <${email}>`);
      this.logger.warn(`🔗 Link: ${link}`);
      return;
    }

    const primeiroNome = nome.split(' ')[0];
    const html = `
<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Envio de Documentos – Instituto Tia Pretinha</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08)">

        <!-- Header -->
        <tr>
          <td style="background:#1e3a5f;padding:32px 40px;text-align:center">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700">Instituto Tia Pretinha</h1>
            <p style="margin:6px 0 0;color:#a8c4e0;font-size:14px">CNPJ nº 11.759.851/0001-39</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px">
            <p style="margin:0 0 16px;color:#374151;font-size:16px">Olá, <strong>${primeiroNome}</strong>!</p>
            <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6">
              Sua inscrição no Instituto Tia Pretinha está em validação! 🎉<br><br>
              Para continuar o processo de matrícula, precisamos que você envie os documentos necessários
              através do link abaixo:
            </p>

            <!-- CTA Button -->
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px">
              <tr>
                <td style="background:#1e3a5f;border-radius:8px;padding:16px 36px;text-align:center">
                  <a href="${link}" style="color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;display:block">
                    Enviar Documentos
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 8px;color:#6b7280;font-size:13px;text-align:center">
              Ou copie e cole o link abaixo no seu navegador:
            </p>
            <p style="margin:0 0 32px;font-size:12px;word-break:break-all;text-align:center;color:#9ca3af">
              ${link}
            </p>

            <!-- Documentos necessários -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
              <tr>
                <td style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:20px">
                  <p style="margin:0 0 12px;color:#1e40af;font-size:14px;font-weight:700">📄 Documentos necessários:</p>
                  <ul style="margin:0;padding-left:20px;color:#374151;font-size:13px;line-height:2">
                    <li>RG ou CPF (frente e verso)</li>
                    <li>Comprovante de residência recente</li>
                    <li>Foto 3x4 recente</li>
                    <li>Certidão de nascimento ou casamento</li>
                    <li>Comprovante de escolaridade</li>
                  </ul>
                </td>
              </tr>
            </table>

            <!-- Aviso de prazo -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#fef9e7;border:1px solid #f59e0b;border-radius:8px;padding:16px">
                  <p style="margin:0;color:#92400e;font-size:13px;line-height:1.6">
                    ⏰ <strong>Este link é válido por 7 dias</strong> a partir do envio desta mensagem.<br>
                    Se o prazo expirar, entre em contato com o Instituto para solicitar um novo link.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 40px;text-align:center">
            <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6">
              Este e-mail foi enviado automaticamente pelo sistema do Instituto Tia Pretinha.<br>
              Se você não se inscreveu, desconsidere esta mensagem.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
    `.trim();

    const info = await this.transporter.sendMail({
      from: `"Instituto Tia Pretinha" <${this.config.get<string>('SMTP_FROM_ADDRESS') || this.config.get<string>('SMTP_USER')}>`,
      to: email,
      subject: '📎 Envie seus documentos – Instituto Tia Pretinha',
      html,
    });

    this.logger.log(`📧 E-mail de documentos enviado para ${email}`);

    if (this.isEthereal) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      this.logger.warn('─────────────────────────────────────────────────────');
      this.logger.warn(`👁️  VISUALIZAR E-MAIL (Ethereal): ${previewUrl}`);
      this.logger.warn(`🔗  Link de documentos: ${link}`);
      this.logger.warn('─────────────────────────────────────────────────────');
    }
  }

  /**
   * MATRÍCULA DE FUNCIONÁRIO: Envia a matrícula e dados de acesso por e-mail.
   */
  async enviarMatriculaFuncionario(email: string, nome: string, matricula: string): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(`📧 [SEM-SMTP] Matrícula de funcionário para ${nome} <${email}>`);
      this.logger.warn(`🪪 Matrícula: ${matricula}`);
      return;
    }

    const primeiroNome = nome.split(' ')[0];
    const html = `
<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Matrícula ITP – Instituto Tia Pretinha</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08)">
        <tr>
          <td style="background:#1e3a5f;padding:32px 40px;text-align:center">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700">Instituto Tia Pretinha</h1>
            <p style="margin:6px 0 0;color:#a8c4e0;font-size:14px">CNPJ nº 11.759.851/0001-39</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px">
            <p style="margin:0 0 16px;color:#374151;font-size:16px">Olá, <strong>${primeiroNome}</strong>!</p>
            <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6">
              Bem-vindo(a) à equipe do Instituto Tia Pretinha! 🎉<br><br>
              Sua conta de acesso ao sistema foi criada. Abaixo estão suas informações de acesso:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
              <tr>
                <td style="background:#f0fdf4;border:2px solid #86efac;border-radius:12px;padding:24px;text-align:center">
                  <p style="margin:0 0 8px;color:#15803d;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Sua Matrícula</p>
                  <p style="margin:0;color:#14532d;font-size:28px;font-weight:900;letter-spacing:3px;font-family:monospace">${matricula}</p>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
              <tr>
                <td style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px">
                  <p style="margin:0;color:#1e40af;font-size:13px;line-height:1.8">
                    ℹ️ Use sua <strong>matrícula</strong> ou <strong>e-mail</strong> para entrar no sistema.<br>
                    🔒 Sua senha inicial foi definida pelo administrador — altere-a no primeiro acesso.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 40px;text-align:center">
            <p style="margin:0;color:#9ca3af;font-size:12px">
              Instituto Tia Pretinha — Sistema Interno de Gestão
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

    const info = await this.transporter.sendMail({
      from: `"Instituto Tia Pretinha" <${this.config.get<string>('SMTP_FROM_ADDRESS') || this.config.get<string>('SMTP_USER')}>`,
      to: email,
      subject: `🪪 Sua matrícula ITP: ${matricula}`,
      html,
    });

    this.logger.log(`📧 E-mail de matrícula enviado para ${email} | Matrícula: ${matricula}`);

    if (this.isEthereal) {
      this.logger.warn(`👁️  Preview: ${nodemailer.getTestMessageUrl(info)}`);
    }
  }
}
