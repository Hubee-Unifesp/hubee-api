import { ApiProperty } from '@nestjs/swagger';
import { paymentMethodEnum, paymentStatusEnum } from '../../database/schema';

/** Contrato de saída (público) de um pagamento. */
export class PaymentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  orderId: string;

  @ApiProperty({ enum: paymentMethodEnum.enumValues })
  paymentMethod: string;

  @ApiProperty({ enum: paymentStatusEnum.enumValues })
  status: string;

  @ApiProperty({ type: Number })
  amount: number;

  @ApiProperty({ nullable: true, required: false })
  paidAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
