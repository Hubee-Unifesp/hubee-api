import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { TrimString } from '../../common/validation/update-validation';
import {
  expenseGroup,
  expensePaymentStatus,
  type ExpenseGroup,
  type ExpensePaymentStatus,
} from '../../database/schema';

export class QueryExpenseDto {
  @ApiPropertyOptional({
    enum: expenseGroup.enumValues,
    description: 'Filtra despesas pelo grupo orçamentário',
  })
  @IsOptional()
  @IsIn(expenseGroup.enumValues, {
    message: 'Grupo de despesa inválido. Use: fixed, variable ou marketing.',
  })
  group?: ExpenseGroup;

  @ApiPropertyOptional({
    description: 'Filtra despesas pela categoria',
    example: 'Estrutura',
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'A categoria deve ser um texto.' })
  @IsNotEmpty({ message: 'A categoria não pode ser vazia.' })
  @MaxLength(100, {
    message: 'A categoria deve ter no máximo 100 caracteres.',
  })
  category?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Filtra despesas cotadas (true) ou pendentes de cotação (false)',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: 'O filtro cotado deve ser verdadeiro ou falso.' })
  quoted?: boolean;

  @ApiPropertyOptional({
    enum: expensePaymentStatus.enumValues,
    description: 'Filtra despesas pelo status de pagamento',
  })
  @IsOptional()
  @IsIn(expensePaymentStatus.enumValues, {
    message: 'Status de pagamento inválido.',
  })
  paymentStatus?: ExpensePaymentStatus;
}
