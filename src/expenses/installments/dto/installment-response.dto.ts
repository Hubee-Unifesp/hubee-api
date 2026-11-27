import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import {
  expenseGroup,
  expensePaymentStatus,
  type ExpenseGroup,
  type ExpensePaymentStatus,
} from '../../../database/schema';

export class InstallmentResponseDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id: string;

  @Expose()
  @ApiProperty({ format: 'uuid' })
  expenseId: string;

  @Expose()
  @ApiProperty()
  expenseDescription: string;

  @Expose()
  @ApiProperty({ enum: expenseGroup.enumValues })
  expenseGroup: ExpenseGroup;

  @Expose()
  @ApiProperty()
  expenseCategory: string;

  @Expose()
  @ApiProperty({ nullable: true })
  supplierName: string | null;

  @Expose()
  @ApiProperty()
  dueDate: Date;

  @Expose()
  @ApiProperty({ type: Number })
  amount: number;

  @Expose()
  @ApiProperty({ enum: expensePaymentStatus.enumValues })
  status: ExpensePaymentStatus;

  @Expose()
  @ApiProperty({ nullable: true })
  paidBy: string | null;

  @Expose()
  @ApiProperty({ nullable: true })
  paymentMethod: string | null;

  @Expose()
  @ApiProperty()
  createdAt: Date;

  @Expose()
  @ApiProperty()
  updatedAt: Date;
}
