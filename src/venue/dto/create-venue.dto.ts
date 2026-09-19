import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { CreateAddressDto } from '../../address/dto/create-address.dto';
import { TrimString } from '../../common/validation/update-validation';

export class CreateVenueDto {
  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsInt()
  @IsPositive()
  maxCapacity: number;

  @ValidateIf((dto: CreateVenueDto) => !dto.address)
  @IsUUID()
  addressId?: string;

  @ValidateIf((dto: CreateVenueDto) => !dto.addressId)
  @ValidateNested()
  @Type(() => CreateAddressDto)
  address?: CreateAddressDto;
}
