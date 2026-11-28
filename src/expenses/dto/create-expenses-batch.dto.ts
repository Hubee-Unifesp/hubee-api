import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsObject } from 'class-validator';
import { CreateExpenseDto } from './create-expense.dto';

export const MAX_EXPENSES_PER_BATCH = 50;

/**
 * Os itens são validados no service, um a um, com as mesmas regras do
 * `CreateExpenseDto`: assim a mensagem de erro aponta qual item está inválido.
 */
export class CreateExpensesBatchDto {
  @ApiProperty({
    type: () => CreateExpenseDto,
    isArray: true,
    minItems: 1,
    maxItems: MAX_EXPENSES_PER_BATCH,
  })
  @IsArray({ message: 'Envie as despesas em uma lista no campo items.' })
  @ArrayMinSize(1, { message: 'Envie ao menos uma despesa.' })
  @ArrayMaxSize(MAX_EXPENSES_PER_BATCH, {
    message: `Envie no máximo ${MAX_EXPENSES_PER_BATCH} despesas por vez.`,
  })
  @IsObject({ each: true, message: 'Cada item deve ser uma despesa.' })
  items: Record<string, unknown>[];
}
