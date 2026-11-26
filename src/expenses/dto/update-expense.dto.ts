import {
  IsBoolean,
  IsDate,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  IsOptionalUpdate,
  ToDate,
  TrimString,
} from '../../common/validation/update-validation';
import {
  expenseGroup,
  expensePaymentStatus,
  type ExpenseGroup,
  type ExpensePaymentStatus,
} from '../../database/schema';
import { MAX_EXPENSE_AMOUNT } from './create-expense.dto';

/**
 * Atualização parcial de despesa: campos NOT NULL usam `@IsOptionalUpdate()`
 * para rejeitar `null` com 400; opcionais aceitam `null` para limpar o valor.
 */
export class UpdateExpenseDto {
  @IsOptionalUpdate()
  @TrimString()
  @IsString({ message: 'A descrição deve ser um texto.' })
  @IsNotEmpty({ message: 'A descrição da despesa é obrigatória.' })
  @MaxLength(500, {
    message: 'A descrição deve ter no máximo 500 caracteres.',
  })
  description?: string;

  @IsOptionalUpdate()
  @IsIn(expenseGroup.enumValues, {
    message: 'Grupo de despesa inválido. Use: fixed, variable ou marketing.',
  })
  group?: ExpenseGroup;

  @IsOptionalUpdate()
  @TrimString()
  @IsString({ message: 'A categoria deve ser um texto.' })
  @IsNotEmpty({ message: 'A categoria da despesa é obrigatória.' })
  @MaxLength(100, {
    message: 'A categoria deve ter no máximo 100 caracteres.',
  })
  category?: string;

  @IsOptionalUpdate()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'A quantidade deve ter no máximo 2 casas decimais.' },
  )
  @Min(0, { message: 'A quantidade não pode ser negativa.' })
  @Max(MAX_EXPENSE_AMOUNT, {
    message: 'A quantidade excede o limite permitido.',
  })
  quantity?: number;

  @IsOptionalUpdate()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'O valor unitário deve ter no máximo 2 casas decimais.' },
  )
  @Min(0, { message: 'O valor unitário não pode ser negativo.' })
  @Max(MAX_EXPENSE_AMOUNT, {
    message: 'O valor unitário excede o limite permitido.',
  })
  unitPrice?: number;

  @IsOptional()
  @IsUUID(undefined, { message: 'Fornecedor inválido.' })
  supplierId?: string | null;

  @IsOptional()
  @ToDate()
  @IsDate({ message: 'Data de vencimento inválida.' })
  dueDate?: Date | null;

  @IsOptional()
  @TrimString()
  @IsString({ message: 'O responsável deve ser um texto.' })
  @MaxLength(255, {
    message: 'O responsável deve ter no máximo 255 caracteres.',
  })
  responsible?: string | null;

  @IsOptionalUpdate()
  @IsBoolean({ message: 'O campo cotado deve ser verdadeiro ou falso.' })
  quoted?: boolean;

  @IsOptional()
  @TrimString()
  @IsString({ message: 'As observações devem ser um texto.' })
  @MaxLength(1000, {
    message: 'As observações devem ter no máximo 1000 caracteres.',
  })
  notes?: string | null;

  @IsOptionalUpdate()
  @IsIn(expensePaymentStatus.enumValues, {
    message: 'Status de pagamento inválido.',
  })
  paymentStatus?: ExpensePaymentStatus;
}
