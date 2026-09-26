import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  IsOptionalUpdate,
  TrimString,
} from '../../common/validation/update-validation';

export class UpdateAddressDto {
  @TrimString()
  @IsOptionalUpdate()
  @IsString()
  @Matches(/^\d{5}-?\d{3}$/, { message: 'CEP inválido' })
  zipCode?: string;

  @TrimString()
  @IsOptionalUpdate()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  street?: string;

  @TrimString()
  @IsOptionalUpdate()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  complement?: string | null;

  @TrimString()
  @IsOptionalUpdate()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  neighborhood?: string;

  @TrimString()
  @IsOptionalUpdate()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city?: string;

  @TrimString()
  @IsOptionalUpdate()
  @IsString()
  @Length(2, 2)
  state?: string;

  @TrimString()
  @IsOptionalUpdate()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  country?: string;
}
