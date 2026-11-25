import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
import { TrimString } from '../../common/validation/update-validation';
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

export class CreateExpenseDto {
  @ApiProperty({
    description: 'Descrição do item de despesa do evento',
    example: 'Palco e sonorização principal',
  })
  @TrimString()
  @IsString({ message: 'A descrição deve ser um texto.' })
  @IsNotEmpty({ message: 'A descrição da despesa é obrigatória.' })
  @MaxLength(500, {
    message: 'A descrição deve ter no máximo 500 caracteres.',
  })
  description: string;

  @ApiProperty({
    enum: expenseGroup.enumValues,
    description: 'Grupo orçamentário da despesa',
    example: 'fixed',
  })
  @IsIn(expenseGroup.enumValues, {
    message: 'Grupo de despesa inválido. Use: fixed, variable ou marketing.',
  })
  group: ExpenseGroup;

  @ApiProperty({
    description: 'Categoria da despesa dentro do orçamento',
    example: 'Estrutura',
  })
  @TrimString()
  @IsString({ message: 'A categoria deve ser um texto.' })
  @IsNotEmpty({ message: 'A categoria da despesa é obrigatória.' })
  @MaxLength(100, {
    message: 'A categoria deve ter no máximo 100 caracteres.',
  })
  category: string;

  @ApiPropertyOptional({
    type: Number,
    default: 1,
    minimum: 0,
    description: 'Quantidade de unidades do item (padrão 1)',
    example: 2,
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false },
    { message: 'A quantidade deve ser um número com até 2 casas decimais.' },
  )
  @Min(0, { message: 'A quantidade não pode ser negativa.' })
  quantity?: number = 1;

  @ApiProperty({
    type: Number,
    minimum: 0,
    description: 'Valor unitário do item em reais',
    example: 1500.5,
  })
  @IsNumber(
    { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false },
    {
      message: 'O valor unitário deve ser um número com até 2 casas decimais.',
    },
  )
  @Min(0, { message: 'O valor unitário não pode ser negativo.' })
  unitPrice: number;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Identificador do fornecedor associado (opcional)',
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
    description: 'Data de vencimento prevista (opcional)',
  })
  @IsOptional()
  @Transform(toNullableDate)
  @IsDate({ message: 'A data de vencimento é inválida.' })
  dueDate?: Date | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Pessoa ou equipe responsável pela despesa',
    example: 'Ana',
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
    default: false,
    description: 'Indica se o item já possui orçamento/cotação confirmada',
  })
  @IsOptional()
  @IsBoolean({ message: 'O campo cotado deve ser verdadeiro ou falso.' })
  quoted?: boolean = false;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Observações livres sobre a despesa ou cotação',
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'As observações devem ser um texto.' })
  notes?: string | null;

  @ApiPropertyOptional({
    enum: expensePaymentStatus.enumValues,
    default: 'pendente',
    description: 'Status de pagamento da despesa',
  })
  @IsOptional()
  @IsIn(expensePaymentStatus.enumValues, {
    message: 'Status de pagamento inválido.',
  })
  paymentStatus?: ExpensePaymentStatus;
}
