import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  IsDateString,
  IsNumberString,
} from 'class-validator';

export class CreateUsuarioDto {
  @IsString()
  @IsNotEmpty({ message: 'O primeiro nome é obrigatório' })
  primeiroNome: string;

  @IsString()
  @IsNotEmpty({ message: 'O sobrenome é obrigatório' })
  sobrenome: string;

  @IsEmail({}, { message: 'Forneça um e-mail válido' })
  email: string;

  @IsOptional()
  @IsNumberString({}, { message: 'O telefone deve conter apenas números' })
  telefone?: string;

  @IsString()
  @Length(6, 20, { message: 'A senha deve ter entre 6 e 20 caracteres' })
  senha: string;

  @IsNumberString({}, { message: 'O CPF deve conter apenas números' })
  @Length(11, 11, { message: 'O CPF deve ter 11 dígitos' })
  cpf: string;

  @IsDateString({}, { message: 'Data de nascimento inválida' })
  dataNascimento: string;

  @IsString()
  @IsNotEmpty({ message: 'O tipo de perfil é obrigatório' })
  tipoPerfil: string;
}
