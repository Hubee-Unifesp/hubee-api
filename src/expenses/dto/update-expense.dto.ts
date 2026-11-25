import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import {
  IsOptionalUpdate,
  TrimString,
} from '../../common/validation/update-validation';
import {
  expenseGroup,
  expensePaymentStatus,
  type ExpenseGroup,
  type ExpensePaymentStatus,
} from '../../database/schema';

const toNullableDate = ({ value }: { value: unknown }) => {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value);
  }
  return value;
};

/**
 * Atualização parcial de uma despesa do evento.
 * Campos obrigatórios no banco usam `IsOptionalUpdate()` para rejeitar `null`
 * com 400; campos opcionais (`supplierId`, `dueDate`, `responsible`, `notes`)
 * usam `@IsOptional()` e aceitam `null` para limpar o valor gravado.
 */
export class UpdateExpenseDto {
  @ApiPropertyOptional({
    description: 'Descrição do item de despesa do evento',
  })
  @IsOptionalUpdate()
  @TrimString()
  @IsString({ message: 'A descrição deve ser um texto.' })
  @IsNotEmpty({ message: 'A descrição da despesa é obrigatória.' })
  @MaxLength(500, {
    message: 'A descrição deve ter no máximo 500 caracteres.',
  })
  description?: string;

  @ApiPropertyOptional({
    enum: expenseGroup.enumValues,
    description: 'Grupo orçamentário da despesa',
  })
  @IsOptionalUpdate()
  @IsIn(expenseGroup.enumValues, {
    message: 'Grupo de despesa inválido. Use: fixed, variable ou marketing.',
  })
  group?: ExpenseGroup;

  @ApiPropertyOptional({
    description: 'Categoria da despesa dentro do orçamento',
  })
  @IsOptionalUpdate()
  @TrimString()
  @IsString({ message: 'A categoria deve ser um texto.' })
  @IsNotEmpty({ message: 'A categoria da despesa é obrigatória.' })
  @MaxLength(100, {
    message: 'A categoria deve ter no máximo 100 caracteres.',
  })
  category?: string;

  @ApiPropertyOptional({
    type: Number,
    minimum: 0,
    description: 'Quantidade de unidades do item',
  })
  @IsOptionalUpdate()
  @IsNumber(
    { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false },
    { message: 'A quantidade deve ser um número com até 2 casas decimais.' },
  )
  @Min(0, { message: 'A quantidade não pode ser negativa.' })
  quantity?: number;

  @ApiPropertyOptional({
    type: Number,
    minimum: 0,
    description: 'Valor unitário do item em reais',
  })
  @IsOptionalUpdate()
  @IsNumber(
    { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false },
    {
      message: 'O valor unitário deve ser um número com até 2 casas decimais.',
    },
  )
  @Min(0, { message: 'O valor unitário não pode ser negativo.' })
  unitPrice?: number;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Identificador do fornecedor associado (envie null para limpar)',
  })
  @IsOptional()
  @IsUUID('4', {
    message: 'O identificador do fornecedor deve ser um UUID válido.',
  })
  supplierId?: string | null;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Data de vencimento prevista (envie null para limpar)',
  })
  @IsOptional()
  @Transform(toNullableDate)
  @IsDate({ message: 'A data de vencimento é inválida.' })
  dueDate?: Date | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Pessoa ou equipe responsável (envie null para limpar)',
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'O responsável deve ser um texto.' })
  @MaxLength(255, {
    message: 'O responsável deve ter no máximo 255 caracteres.',
  })
  responsible?: string | null;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Indica se o item já foi cotado',
  })
  @IsOptionalUpdate()
  @IsBoolean({ message: 'O campo cotado deve ser verdadeiro ou falso.' })
  quoted?: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Observações livres (envie null para limpar)',
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'As observações devem ser um texto.' })
  notes?: string | null;

  @ApiPropertyOptional({
    enum: expensePaymentStatus.enumValues,
    description: 'Status de pagamento da despesa',
  })
  @IsOptionalUpdate()
  @IsIn(expensePaymentStatus.enumValues, {
    message: 'Status de pagamento inválido.',
  })
  paymentStatus?: ExpensePaymentStatus;
}
