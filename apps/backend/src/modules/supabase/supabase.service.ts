import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
} from '@azure/storage-blob';
import sharp from 'sharp';

/**
 * Storage de arquivos do erp_itp. Nome/arquivo "supabase" mantido por
 * compatibilidade (10+ arquivos injetam SupabaseService) — a implementacao
 * real migrou de Supabase Storage pra Azure Blob Storage em 2026-09-09.
 * Interface publica (upload/resolveUrl/getSignedUrl/delete/checkHealth)
 * inalterada de proposito, nenhum consumidor precisou mudar.
 */
@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private readonly client: BlobServiceClient;
  private readonly credential: StorageSharedKeyCredential;
  private readonly containerName: string;
  private readonly accountName: string;

  constructor(private readonly config: ConfigService) {
    this.accountName = config.get<string>('AZURE_STORAGE_ACCOUNT') ?? '';
    const accountKey = config.get<string>('AZURE_STORAGE_KEY') ?? '';
    this.containerName = config.get<string>('AZURE_STORAGE_CONTAINER') ?? 'arquivos';
    this.credential = new StorageSharedKeyCredential(this.accountName, accountKey);
    this.client = new BlobServiceClient(
      `https://${this.accountName}.blob.core.windows.net`,
      this.credential,
    );
  }

  private container() {
    return this.client.getContainerClient(this.containerName);
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

    try {
      const blockBlobClient = this.container().getBlockBlobClient(path);
      await blockBlobClient.uploadData(processedBuffer, {
        blobHTTPHeaders: { blobContentType: actualMimetype },
      });
      return path;
    } catch (error: any) {
      this.logger.error(`Azure Blob upload error: ${error.message}`);
      throw new Error(`Falha no upload: ${error.message}`);
    }
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
    const blobClient = this.container().getBlobClient(path);
    const sas = generateBlobSASQueryParameters(
      {
        containerName: this.containerName,
        blobName: path,
        permissions: BlobSASPermissions.parse('r'),
        startsOn: new Date(Date.now() - 60 * 1000),
        expiresOn: new Date(Date.now() + expiresIn * 1000),
      },
      this.credential,
    ).toString();
    return `${blobClient.url}?${sas}`;
  }

  async delete(path: string): Promise<void> {
    try {
      await this.container().getBlockBlobClient(path).deleteIfExists();
    } catch (error: any) {
      this.logger.warn(`Azure Blob delete warning: ${error.message}`);
    }
  }

  /** Checagem de conectividade — usada pelo cron de monitoramento. */
  async checkHealth(): Promise<{ ok: boolean; error?: string }> {
    try {
      const iter = this.container().listBlobsFlat().byPage({ maxPageSize: 1 });
      await iter.next();
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'Erro desconhecido' };
    }
  }
}
