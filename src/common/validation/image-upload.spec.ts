import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import {
  Controller,
  INestApplication,
  Patch,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  ImageFileInterceptor,
  type ImageUploadFile,
  MAX_IMAGE_BYTES,
} from './image-upload';

@Controller()
class UploadController {
  @Patch('upload')
  @UseInterceptors(ImageFileInterceptor)
  upload(@UploadedFile() file?: ImageUploadFile) {
    return { size: file?.buffer?.length };
  }
}

describe('ImageFileInterceptor', () => {
  let app: INestApplication;
  const png = { filename: 'capa.png', contentType: 'image/png' };
  const upload = () => request(app.getHttpServer()).patch('/upload');

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [UploadController],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('aceita imagem de exatamente 2MB', async () => {
    const response = await upload()
      .attach('file', Buffer.alloc(MAX_IMAGE_BYTES), png)
      .expect(200);

    expect(response.body.size).toBe(MAX_IMAGE_BYTES);
  });

  it('rejeita imagem acima de 2MB com 400 em português', async () => {
    const response = await upload()
      .attach('file', Buffer.alloc(MAX_IMAGE_BYTES + 1), png)
      .expect(400);

    expect(response.body.message).toBe('A imagem deve ter no máximo 2MB.');
  });

  it.each([
    [
      'campo de texto extra',
      () => upload().field('extra', 'x').attach('file', Buffer.from('a'), png),
    ],
    [
      'segundo arquivo',
      () =>
        upload()
          .attach('file', Buffer.from('a'), png)
          .attach('file', Buffer.from('b'), png),
    ],
    [
      'outro campo de arquivo',
      () => upload().attach('outro', Buffer.from('a'), png),
    ],
  ])('rejeita %s com 400 em português', async (_name, send) => {
    const response = await send().expect(400);

    expect(response.body.message).toBe(
      'Envie apenas um arquivo de imagem no campo "file".',
    );
  });
});
