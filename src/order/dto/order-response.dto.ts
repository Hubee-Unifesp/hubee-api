import { ApiProperty } from '@nestjs/swagger';
import { orderStatus } from '../../database/schema';

/** Contrato de saída (público) de um pedido. */
export class OrderResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ type: Number })
  totalAmount: number;

  @ApiProperty({ enum: orderStatus.enumValues })
  status: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
