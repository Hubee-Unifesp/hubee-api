import { ApiProperty } from '@nestjs/swagger';

/** Contrato de saída (público) de um endereço. */
export class AddressResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  zipCode: string;

  @ApiProperty()
  street: string;

  @ApiProperty()
  number: string;

  @ApiProperty({ nullable: true, required: false })
  complement: string | null;

  @ApiProperty()
  neighborhood: string;

  @ApiProperty()
  city: string;

  @ApiProperty()
  state: string;

  @ApiProperty()
  country: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
