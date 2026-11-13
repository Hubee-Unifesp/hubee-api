import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import {
  MaxByteLength,
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
} from '../../common/validation/max-byte-length';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'A senha atual é obrigatória' })
  currentPassword: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: 'A senha deve ter no mínimo 8 caracteres',
  })
  @MaxByteLength(PASSWORD_MAX_BYTES)
  newPassword: string;
}
