import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateVenueDto } from './create-venue.dto';
import { ValidateNested } from 'class-validator';
import { UpdateAddressDto } from '../../address/dto/update-address.dto';
import { Type } from 'class-transformer';


export class UpdateVenueDto extends PartialType(
    OmitType(CreateVenueDto, ['address'] as const),
) {
    @ValidateNested()
    @Type(() => UpdateAddressDto)
    address?: UpdateAddressDto;
    
}
