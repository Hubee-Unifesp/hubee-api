import { PartialType } from '@nestjs/mapped-types';
import { CreateExpenseDto } from './create-expense.dto';

/**
 * Todos os campos de uma despesa podem ser atualizados via PATCH, inclusive
 * `supplierId` (ex.: corrigir um lançamento associado ao fornecedor errado)
 * e `paymentStatus` (ex.: marcar como paga).
 */
export class UpdateExpenseDto extends PartialType(CreateExpenseDto) {}
