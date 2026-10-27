import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { orderStatus } from '../../database/schema';

/** Contrato de saída (público) de um pedido. */
export class OrderResponseDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id: string;

  @Expose()
  @ApiProperty({ format: 'uuid' })
  userId: string;

  @Expose()
  @ApiProperty({ type: Number })
  totalAmount: number;

  @Expose()
  @ApiProperty({ enum: orderStatus.enumValues })
  status: string;

  @Expose()
  @ApiProperty()
  createdAt: Date;

  @Expose()
  @ApiProperty()
  updatedAt: Date;
}
