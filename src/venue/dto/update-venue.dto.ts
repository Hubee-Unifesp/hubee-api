import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsUUID,
  MaxLength,
  ValidateNested,
  IsString,
} from 'class-validator';
import { UpdateAddressDto } from '../../address/dto/update-address.dto';
import { Type } from 'class-transformer';
import {
  IsOptionalUpdate,
  TrimString,
} from '../../common/validation/update-validation';

export class UpdateVenueDto {
  @TrimString()
  @IsOptionalUpdate()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @IsOptionalUpdate()
  @IsInt()
  @IsPositive()
  maxCapacity?: number;

  @IsOptionalUpdate()
  @IsUUID()
  addressId?: string;

  @IsOptionalUpdate()
  @ValidateNested()
  @Type(() => UpdateAddressDto)
  address?: UpdateAddressDto;

  @IsOptionalUpdate()
  @IsBoolean()
  active?: boolean;
}
