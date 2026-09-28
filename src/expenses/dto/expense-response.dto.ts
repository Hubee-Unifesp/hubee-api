import { ApiProperty } from '@nestjs/swagger';
import { expensePaymentStatus } from '../../database/schema';

/** Contrato de saída (público) de uma despesa. */
export class ExpenseResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  eventId: string;

  @ApiProperty({ format: 'uuid' })
  supplierId: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ type: Number })
  amount: number;

  @ApiProperty()
  costType: string;

  @ApiProperty()
  dueDate: Date;

  @ApiProperty({ enum: expensePaymentStatus.enumValues })
  paymentStatus: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
