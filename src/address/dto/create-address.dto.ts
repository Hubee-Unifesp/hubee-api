import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateAddressDto {
  @IsString()
  @Matches(/^\d{5}-?\d{3}$/, { message: 'CEP inválido' })
  zipCode: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  street: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  number: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  complement?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  neighborhood: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city: string;

  @IsString()
  @Length(2, 2)
  state: string;

  @IsOptional()
  @IsString()
  country?: string;
}
