import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { expensePaymentStatus } from '../../database/schema';

/** Contrato de saída (público) de uma despesa. */
export class ExpenseResponseDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id: string;

  @Expose()
  @ApiProperty({ format: 'uuid' })
  eventId: string;

  @Expose()
  @ApiProperty({ format: 'uuid' })
  supplierId: string;

  @Expose()
  @ApiProperty()
  description: string;

  @Expose()
  @ApiProperty({ type: Number })
  amount: number;

  @Expose()
  @ApiProperty()
  costType: string;

  @Expose()
  @ApiProperty()
  dueDate: Date;

  @Expose()
  @ApiProperty({ enum: expensePaymentStatus.enumValues })
  paymentStatus: string;

  @Expose()
  @ApiProperty()
  createdAt: Date;

  @Expose()
  @ApiProperty()
  updatedAt: Date;
}
