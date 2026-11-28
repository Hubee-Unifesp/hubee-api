import {
  IsDate,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  IsOptionalUpdate,
  ToDate,
  TrimString,
} from '../../../common/validation/update-validation';
import {
  expensePaymentStatus,
  type ExpensePaymentStatus,
} from '../../../database/schema';
import { MAX_EXPENSE_AMOUNT } from '../../dto/create-expense.dto';

export class UpdateInstallmentDto {
  @IsOptionalUpdate()
  @ToDate()
  @IsDate({ message: 'Data da parcela inválida.' })
  dueDate?: Date;

  @IsOptionalUpdate()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'O valor da parcela deve ter no máximo 2 casas decimais.' },
  )
  @Min(0.01, { message: 'O valor da parcela deve ser maior que zero.' })
  @Max(MAX_EXPENSE_AMOUNT, {
    message: 'O valor da parcela excede o limite permitido.',
  })
  amount?: number;

  @IsOptionalUpdate()
  @IsIn(expensePaymentStatus.enumValues, {
    message: 'Status de pagamento inválido.',
  })
  status?: ExpensePaymentStatus;

  @IsOptional()
  @TrimString()
  @IsString({ message: 'Quem pagou deve ser um texto.' })
  @MaxLength(255, {
    message: 'Quem pagou deve ter no máximo 255 caracteres.',
  })
  paidBy?: string | null;

  @IsOptional()
  @TrimString()
  @IsString({ message: 'A forma de pagamento deve ser um texto.' })
  @MaxLength(100, {
    message: 'A forma de pagamento deve ter no máximo 100 caracteres.',
  })
  paymentMethod?: string | null;
}
