import { ApiProperty } from '@nestjs/swagger';
import { AddressResponseDto } from '../../address/dto/address-response.dto';

/**
 * Contrato de saída (público) de um local. Inclui o endereço aninhado, igual
 * ao GET (ver fix da task GOL-82: create/update também retornam `address`).
 */
export class VenueResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: Number })
  maxCapacity: number;

  @ApiProperty()
  active: boolean;

  @ApiProperty({ format: 'uuid' })
  addressId: string;

  @ApiProperty({ type: AddressResponseDto })
  address: AddressResponseDto;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
