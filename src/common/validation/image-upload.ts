import { BadRequestException } from '@nestjs/common';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png'] as const;

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

/** Aceita JPG ou PNG de até 2MB, como o avatar e a capa de evento exigem. */
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
    throw new BadRequestException('A imagem deve ter no máximo 2MB.');
  }

  return { mimetype: file.mimetype as AllowedImageMime, buffer: file.buffer };
}
