import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private readonly client: SupabaseClient;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const url = config.get<string>('SUPABASE_URL') ?? '';
    const key = config.get<string>('SUPABASE_SERVICE_KEY') ?? '';
    this.bucket = config.get<string>('SUPABASE_BUCKET') ?? 'arquivos';
    this.client = createClient(url, key);
  }

  async upload(buffer: Buffer, path: string, mimetype: string): Promise<string> {
    const MAX_BYTES = 5 * 1024 * 1024;
    if (buffer.length > MAX_BYTES) {
      throw new Error('Arquivo excede o limite de 5 MB');
    }

    let processedBuffer = buffer;
    let actualMimetype = mimetype;
    if (mimetype.startsWith('image/')) {
      processedBuffer = await sharp(buffer)
        .rotate()
        .resize({ width: 1920, withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      actualMimetype = 'image/jpeg';
    }

    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(path, processedBuffer, {
        contentType: actualMimetype,
        upsert: true,
      });

    if (error) {
      this.logger.error(`Supabase upload error: ${error.message}`);
      throw new Error(`Falha no upload: ${error.message}`);
    }

    return path;
  }

  /** Resolve storage path or passthrough if already a full URL / data URL */
  async resolveUrl(urlOrPath: string | null | undefined, expiresIn = 3600): Promise<string | null> {
    if (!urlOrPath) return null;
    if (urlOrPath.startsWith('data:') || urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
      return urlOrPath;
    }
    try {
      return await this.getSignedUrl(urlOrPath, expiresIn);
    } catch (e: any) {
      this.logger.error(`resolveUrl falhou para "${urlOrPath}": ${e?.message}`);
      return null;
    }
  }

  async getSignedUrl(path: string, expiresIn = 3600): Promise<string> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(path, expiresIn);

    if (error || !data?.signedUrl) {
      throw new Error(`Falha ao gerar URL assinada: ${error?.message}`);
    }

    return data.signedUrl;
  }

  async delete(path: string): Promise<void> {
    const { error } = await this.client.storage
      .from(this.bucket)
      .remove([path]);

    if (error) {
      this.logger.warn(`Supabase delete warning: ${error.message}`);
    }
  }

  /** Checagem de conectividade — usada pelo cron de monitoramento. */
  async checkHealth(): Promise<{ ok: boolean; error?: string }> {
    try {
      const { error } = await this.client.storage.from(this.bucket).list('', { limit: 1 });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'Erro desconhecido' };
    }
  }
}
