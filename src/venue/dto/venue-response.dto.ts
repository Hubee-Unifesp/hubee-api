import { Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { AddressResponseDto } from '../../address/dto/address-response.dto';

/**
 * Contrato de saída (público) de um local. Inclui o endereço aninhado, igual
 * ao GET (ver fix da task GOL-82: create/update também retornam `address`).
 */
export class VenueResponseDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id: string;

  @Expose()
  @ApiProperty()
  name: string;

  @Expose()
  @ApiProperty({ type: Number })
  maxCapacity: number;

  @Expose()
  @ApiProperty()
  active: boolean;

  @Expose()
  @ApiProperty({ format: 'uuid' })
  addressId: string;

  @Expose()
  @ApiProperty({ type: AddressResponseDto })
  @Type(() => AddressResponseDto)
  address: AddressResponseDto;

  @Expose()
  @ApiProperty()
  createdAt: Date;

  @Expose()
  @ApiProperty()
  updatedAt: Date;
}
