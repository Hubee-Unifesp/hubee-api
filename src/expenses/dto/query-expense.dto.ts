import { IsIn, IsOptional } from 'class-validator';
import { expensePaymentStatus } from '../../database/schema';
import type { ExpensePaymentStatus } from '../../database/schema';

export class QueryExpenseDto {
  @IsOptional()
  @IsIn(expensePaymentStatus.enumValues)
  paymentStatus?: ExpensePaymentStatus;
}
