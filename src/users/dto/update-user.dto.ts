import { NormalizeEmail } from '../../common/validation/normalize-email';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import {
  IsOptionalUpdate,
  TrimString,
} from '../../common/validation/update-validation';
import { IsCpf } from '../../common/validation/cpf';
import { IsNotFutureDate } from '../../common/validation/not-future-date';

export class UpdateUserDto {
  @TrimString()
  @IsOptionalUpdate()
  @IsString()
  @IsNotEmpty({ message: 'O nome completo é obrigatório' })
  @Length(1, 200)
  fullName?: string;

  @NormalizeEmail()
  @IsOptionalUpdate()
  @IsEmail({}, { message: 'Forneça um e-mail válido' })
  email?: string;

  @IsOptional()
  @IsNumberString({}, { message: 'O telefone deve conter apenas números' })
  phone?: string;

  @IsOptionalUpdate()
  @IsString()
  @IsNotEmpty()
  @Length(6, 20, { message: 'A senha deve ter entre 6 e 20 caracteres' })
  password?: string;

  @TrimString()
  @IsOptionalUpdate()
  @IsNumberString({}, { message: 'O CPF deve conter apenas números' })
  @Length(11, 11, { message: 'O CPF deve ter 11 dígitos' })
  @IsCpf()
  cpf?: string;

  @IsOptionalUpdate()
  @IsDateString({}, { message: 'Data de nascimento inválida' })
  @IsNotFutureDate({
    message: 'A data de nascimento não pode estar no futuro',
  })
  birthDate?: string;

  @IsOptional()
  @IsIn(['BUY', 'ORGANIZE'])
  signupIntent?: 'BUY' | 'ORGANIZE';
}
