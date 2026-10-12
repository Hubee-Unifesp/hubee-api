import { NormalizeEmail } from '../../common/validation/normalize-email';
import {
  IsDateString,
  IsEmail,
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

export class UpdateMeDto {
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
  @IsDateString({}, { message: 'Data de nascimento inválida' })
  birthDate?: string;
}
