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

export class UpdateUsuarioDto {
  @TrimString()
  @IsOptionalUpdate()
  @IsString()
  @IsNotEmpty({ message: 'O primeiro nome é obrigatório' })
  firstName?: string;

  @TrimString()
  @IsOptionalUpdate()
  @IsString()
  @IsNotEmpty({ message: 'O sobrenome é obrigatório' })
  lastName?: string;

  @TrimString()
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
  cpf?: string;

  @IsOptionalUpdate()
  @IsDateString({}, { message: 'Data de nascimento inválida' })
  birthDate?: string;

  @TrimString()
  @IsOptionalUpdate()
  @IsString()
  @IsNotEmpty({ message: 'O tipo de perfil é obrigatório' })
  profileType?: string;
}
