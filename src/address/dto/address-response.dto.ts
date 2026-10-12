import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/** Contrato de saída (público) de um endereço. */
export class AddressResponseDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id: string;

  @Expose()
  @ApiProperty()
  zipCode: string;

  @Expose()
  @ApiProperty()
  street: string;

  @Expose()
  @ApiProperty()
  number: string;

  @Expose()
  @ApiProperty({ nullable: true, required: false })
  complement: string | null;

  @Expose()
  @ApiProperty()
  neighborhood: string;

  @Expose()
  @ApiProperty()
  city: string;

  @Expose()
  @ApiProperty()
  state: string;

  @Expose()
  @ApiProperty()
  country: string;

  @Expose()
  @ApiProperty()
  createdAt: Date;

  @Expose()
  @ApiProperty()
  updatedAt: Date;
}
