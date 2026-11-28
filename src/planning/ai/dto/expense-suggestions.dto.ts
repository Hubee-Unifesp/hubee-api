import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { TrimString } from '../../../common/validation/update-validation';
import { expenseGroup, type ExpenseGroup } from '../../../database/schema';

export const EXPENSE_SUGGESTIONS_NOTES_MAX_LENGTH = 1000;

export class ExpenseSuggestionsRequestDto {
  @ApiPropertyOptional({
    maxLength: EXPENSE_SUGGESTIONS_NOTES_MAX_LENGTH,
    example: 'open bar, 2 DJs, sem segurança contratada',
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'As observações devem ser um texto.' })
  @MaxLength(EXPENSE_SUGGESTIONS_NOTES_MAX_LENGTH, {
    message: `As observações devem ter no máximo ${EXPENSE_SUGGESTIONS_NOTES_MAX_LENGTH} caracteres.`,
  })
  notes?: string;
}

export class ExpenseSuggestionDto {
  @Expose()
  @ApiProperty({ maxLength: 500 })
  description: string;

  @Expose()
  @ApiProperty({ enum: expenseGroup.enumValues })
  group: ExpenseGroup;

  @Expose()
  @ApiProperty({ maxLength: 100 })
  category: string;

  @Expose()
  @ApiProperty()
  quantity: number;

  @Expose()
  @ApiProperty({ description: 'Valor unitário estimado pela IA, em reais' })
  unitPrice: number;

  @Expose()
  @ApiProperty({ nullable: true, maxLength: 1000 })
  notes: string | null;

  @Expose()
  @ApiProperty({ description: 'Por que o item entra no orçamento' })
  reason: string;
}

export class ExpenseSuggestionsResponseDto {
  @Expose()
  @ApiProperty({ type: ExpenseSuggestionDto, isArray: true })
  @Type(() => ExpenseSuggestionDto)
  suggestions: ExpenseSuggestionDto[];
}
