import {
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

export class UpdateFornecedorDto {
  @TrimString()
  @IsOptionalUpdate()
  @IsString()
  @IsNotEmpty({ message: 'O nome da empresa é obrigatório.' })
  companyName?: string;

  @TrimString()
  @IsOptionalUpdate()
  @IsString()
  @IsNotEmpty({ message: 'O CNPJ ou CPF é obrigatório.' })
  @IsNumberString({}, { message: 'O documento deve conter apenas números.' })
  @Length(11, 14, { message: 'O documento deve ter entre 11 e 14 caracteres.' })
  cnpjCpf?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Formato de e-mail inválido.' })
  email?: string;

  @IsOptional()
  @IsString()
  category?: string;
}
