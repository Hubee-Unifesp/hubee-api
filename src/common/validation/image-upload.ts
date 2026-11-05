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
export const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png'] as const;

const TOO_LARGE_MESSAGE = 'A imagem deve ter no máximo 2MB.';

export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIMES)[number];

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

  if (
    !file.mimetype ||
    !ALLOWED_IMAGE_MIMES.includes(file.mimetype as AllowedImageMime)
  ) {
    throw new BadRequestException(
      'Formato inválido. Use uma imagem .jpg, .png ou .jpeg.',
    );
  }

  const fileSize = file.size ?? file.buffer.length;
  if (fileSize > MAX_IMAGE_BYTES || file.buffer.length > MAX_IMAGE_BYTES) {
    throw new BadRequestException(TOO_LARGE_MESSAGE);
  }

  return { mimetype: file.mimetype as AllowedImageMime, buffer: file.buffer };
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
