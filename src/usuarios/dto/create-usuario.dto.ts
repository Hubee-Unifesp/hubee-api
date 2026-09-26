import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  IsDateString,
  IsNumberString,
} from 'class-validator';
import { TrimString } from '../../common/validation/update-validation';

export class CreateUsuarioDto {
  @TrimString()
  @IsString()
  @IsNotEmpty({ message: 'O primeiro nome é obrigatório' })
  firstName: string;

  @TrimString()
  @IsString()
  @IsNotEmpty({ message: 'O sobrenome é obrigatório' })
  lastName: string;

  @TrimString()
  @IsEmail({}, { message: 'Forneça um e-mail válido' })
  email: string;

  @IsOptional()
  @IsNumberString({}, { message: 'O telefone deve conter apenas números' })
  phone?: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 20, { message: 'A senha deve ter entre 6 e 20 caracteres' })
  password: string;

  @TrimString()
  @IsNumberString({}, { message: 'O CPF deve conter apenas números' })
  @Length(11, 11, { message: 'O CPF deve ter 11 dígitos' })
  cpf: string;

  @IsDateString({}, { message: 'Data de nascimento inválida' })
  birthDate: string;

  @TrimString()
  @IsString()
  @IsNotEmpty({ message: 'O tipo de perfil é obrigatório' })
  profileType: string;
}
