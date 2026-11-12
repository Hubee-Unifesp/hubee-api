import { NormalizeEmail } from '../../common/validation/normalize-email';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MinLength,
  IsDateString,
  IsNumberString,
} from 'class-validator';
import { TrimString } from '../../common/validation/update-validation';
import { IsCpf } from '../../common/validation/cpf';
import { IsNotFutureDate } from '../../common/validation/not-future-date';
import {
  MaxByteLength,
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
} from '../../common/validation/max-byte-length';

export class CreateUserDto {
  @TrimString()
  @IsString()
  @IsNotEmpty({ message: 'O nome completo é obrigatório' })
  @Length(1, 200)
  fullName: string;

  @NormalizeEmail()
  @IsEmail({}, { message: 'Forneça um e-mail válido' })
  email: string;

  @IsOptional()
  @IsNumberString({}, { message: 'O telefone deve conter apenas números' })
  phone?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: 'A senha deve ter no mínimo 8 caracteres',
  })
  @MaxByteLength(PASSWORD_MAX_BYTES)
  password: string;

  @TrimString()
  @IsOptional()
  @IsNumberString({}, { message: 'O CPF deve conter apenas números' })
  @Length(11, 11, { message: 'O CPF deve ter 11 dígitos' })
  @IsCpf()
  cpf?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Data de nascimento inválida' })
  @IsNotFutureDate({
    message: 'A data de nascimento não pode estar no futuro',
  })
  birthDate?: string;

  @IsOptional()
  @IsIn(['BUY', 'ORGANIZE'])
  signupIntent?: 'BUY' | 'ORGANIZE';
}
