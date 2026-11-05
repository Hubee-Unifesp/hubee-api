import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { del, put } from '@vercel/blob';
import type { EnvironmentVariables } from '../config/env.validation';
import { StorageService, type StorageUpload } from './storage.service';

const BLOB_HOST_SUFFIX = '.public.blob.vercel-storage.com';

@Injectable()
export class VercelBlobStorageService extends StorageService {
  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {
    super();
  }

  async upload({
    pathname,
    buffer,
    contentType,
  }: StorageUpload): Promise<string> {
    const { url } = await put(pathname, buffer, {
      access: 'public',
      addRandomSuffix: true,
      contentType,
      token: this.token(),
    });
    return url;
  }

  async delete(url: string): Promise<void> {
    if (!this.isBlobUrl(url)) return;
    await del(url, { token: this.token() });
  }

  private token(): string {
    const token = this.config.get('BLOB_READ_WRITE_TOKEN', { infer: true });
    if (!token) {
      throw new ServiceUnavailableException(
        'O envio de imagens não está disponível no momento.',
      );
    }
    return token;
  }

  private isBlobUrl(url: string): boolean {
    try {
      return new URL(url).hostname.endsWith(BLOB_HOST_SUFFIX);
    } catch {
      return false;
    }
  }
}
