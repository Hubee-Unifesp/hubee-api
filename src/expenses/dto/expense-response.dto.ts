import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { expenseGroup, expensePaymentStatus } from '../../database/schema';

/** Contrato de saída (público) de uma despesa do evento. */
export class ExpenseResponseDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id: string;

  @Expose()
  @ApiProperty({ format: 'uuid' })
  eventId: string;

  @Expose()
  @ApiProperty({ format: 'uuid', nullable: true })
  supplierId: string | null;

  @Expose()
  @ApiProperty({ nullable: true })
  supplierName: string | null;

  @Expose()
  @ApiProperty()
  description: string;

  @Expose()
  @ApiProperty({ enum: expenseGroup.enumValues })
  group: string;

  @Expose()
  @ApiProperty()
  category: string;

  @Expose()
  @ApiProperty({ type: Number })
  quantity: number;

  @Expose()
  @ApiProperty({ type: Number })
  unitPrice: number;

  @Expose()
  @ApiProperty({ type: Number })
  amount: number;

  @Expose()
  @ApiProperty({ nullable: true })
  responsible: string | null;

  @Expose()
  @ApiProperty({ type: Boolean })
  quoted: boolean;

  @Expose()
  @ApiProperty({ nullable: true })
  notes: string | null;

  @Expose()
  @ApiProperty({ nullable: true })
  dueDate: Date | null;

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
