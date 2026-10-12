import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { paymentMethodEnum, paymentStatusEnum } from '../../database/schema';

/** Contrato de saída (público) de um pagamento. */
export class PaymentResponseDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id: string;

  @Expose()
  @ApiProperty({ format: 'uuid' })
  orderId: string;

  @Expose()
  @ApiProperty({ enum: paymentMethodEnum.enumValues })
  paymentMethod: string;

  @Expose()
  @ApiProperty({ enum: paymentStatusEnum.enumValues })
  status: string;

  @Expose()
  @ApiProperty({ type: Number })
  amount: number;

  @Expose()
  @ApiProperty({ nullable: true, required: false })
  paidAt: Date | null;

  @Expose()
  @ApiProperty()
  createdAt: Date;

  @Expose()
  @ApiProperty()
  updatedAt: Date;
}
