import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  PayloadTooLargeException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const TOO_LARGE_MESSAGE = 'A imagem deve ter no máximo 2MB.';

export type AllowedImageMime = 'image/jpeg' | 'image/png';

export const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
export const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);

const SIGNATURES: [AllowedImageMime, Buffer][] = [
  ['image/png', PNG_SIGNATURE],
  ['image/jpeg', JPEG_SIGNATURE],
];

export function detectImageMime(buffer: Buffer): AllowedImageMime | undefined {
  return SIGNATURES.find(([, signature]) =>
    buffer.subarray(0, signature.length).equals(signature),
  )?.[0];
}

export interface ImageUploadFile {
  mimetype?: string;
  buffer?: Buffer;
  size?: number;
}

export interface ValidImageUpload {
  mimetype: AllowedImageMime;
  buffer: Buffer;
}

export function validateImageUpload(file?: ImageUploadFile): ValidImageUpload {
  if (!file || !file.buffer || file.buffer.length === 0) {
    throw new BadRequestException('Arquivo de imagem é obrigatório.');
  }

  const fileSize = file.size ?? file.buffer.length;
  if (fileSize > MAX_IMAGE_BYTES || file.buffer.length > MAX_IMAGE_BYTES) {
    throw new BadRequestException(TOO_LARGE_MESSAGE);
  }

  const mimetype = detectImageMime(file.buffer);
  if (!mimetype) {
    throw new BadRequestException(
      'Formato inválido. Use uma imagem .jpg, .png ou .jpeg.',
    );
  }

  return { mimetype, buffer: file.buffer };
}

const MultipartInterceptor = FileInterceptor('file', {
  limits: { fileSize: MAX_IMAGE_BYTES + 1, files: 1, fields: 0 },
});

@Injectable()
export class ImageFileInterceptor implements NestInterceptor {
  private readonly multipart = new MultipartInterceptor();

  async intercept(context: ExecutionContext, next: CallHandler) {
    try {
      return await this.multipart.intercept(context, next);
    } catch (error) {
      if (error instanceof PayloadTooLargeException) {
        throw new BadRequestException(TOO_LARGE_MESSAGE);
      }
      if (error instanceof BadRequestException) {
        throw new BadRequestException(
          'Envie apenas um arquivo de imagem no campo "file".',
        );
      }
      throw error;
    }
  }
}
