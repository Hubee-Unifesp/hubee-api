import { PartialType } from '@nestjs/mapped-types';
import { CreateDespesaDto } from './create-despesa.dto';

/**
 * Todos os campos de uma despesa podem ser atualizados via PATCH, inclusive
 * `fornecedorId` (ex.: corrigir um lançamento associado ao fornecedor errado)
 * e `paymentStatus` (ex.: marcar como paga).
 */
export class UpdateDespesaDto extends PartialType(CreateDespesaDto) {}
