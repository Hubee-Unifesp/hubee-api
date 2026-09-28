import { Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { expensePaymentStatus } from '../../database/schema';
import type { ExpensePaymentStatus } from '../../database/schema';

export class CreateExpenseDto {
  @IsUUID()
  supplierId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  description: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  costType: string;

  @Type(() => Date)
  @IsDate()
  dueDate: Date;

  // Opcional: por padrão toda despesa nasce como 'pendente' (ver schema).
  @IsOptional()
  @IsIn(expensePaymentStatus.enumValues)
  paymentStatus?: ExpensePaymentStatus;
}
