import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation';

const put = jest.fn<(...args: unknown[]) => Promise<{ url: string }>>();
const del = jest.fn<(...args: unknown[]) => Promise<void>>();

jest.unstable_mockModule('@vercel/blob', () => ({ put, del }));

const { VercelBlobStorageService } =
  await import('./vercel-blob-storage.service');

const BLOB_URL =
  'https://abc123.public.blob.vercel-storage.com/events/1/cover-x.png';

function makeService(token?: string) {
  return new VercelBlobStorageService({
    get: () => token,
  } as unknown as ConfigService<EnvironmentVariables, true>);
}

describe('VercelBlobStorageService', () => {
  beforeEach(() => {
    put.mockReset();
    del.mockReset();
  });

  it('envia como arquivo público com sufixo aleatório e devolve a URL', async () => {
    put.mockResolvedValue({ url: BLOB_URL });
    const buffer = Buffer.from('img');

    const url = await makeService('token').upload({
      pathname: 'events/1/cover.png',
      buffer,
      contentType: 'image/png',
    });

    expect(url).toBe(BLOB_URL);
    expect(put).toHaveBeenCalledWith('events/1/cover.png', buffer, {
      access: 'public',
      addRandomSuffix: true,
      contentType: 'image/png',
      token: 'token',
    });
  });

  it('responde 503 sem chamar o provedor quando não há token', async () => {
    await expect(
      makeService().upload({
        pathname: 'events/1/cover.png',
        buffer: Buffer.from('img'),
        contentType: 'image/png',
      }),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(put).not.toHaveBeenCalled();
  });

  it('apaga URL do próprio storage', async () => {
    await makeService('token').delete(BLOB_URL);

    expect(del).toHaveBeenCalledWith(BLOB_URL, { token: 'token' });
  });

  it.each([
    'https://cdn.hubee.com.br/eventos/festa-junina.jpg',
    'https://public.blob.vercel-storage.com.evil.com/x.png',
    'nao-e-url',
  ])('ignora %s ao apagar', async (url) => {
    await makeService('token').delete(url);

    expect(del).not.toHaveBeenCalled();
  });
});
