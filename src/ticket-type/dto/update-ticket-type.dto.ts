import { Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ticketTypeModality } from '../../database/schema';
import type { TicketTypeModality } from '../../database/schema';

/**
 * Não estende `PartialType(CreateTicketTypeDto)` de propósito: o evento de um
 * tipo de ingresso já existente não é uma operação válida, e aqui as datas de
 * venda aceitam `null` para serem apagadas.
 *
 * Os campos NOT NULL usam `@ValidateIf` em vez de `@IsOptional()`, para que
 * `null` responda 400 em vez de chegar ao banco e virar erro 500.
 */
export class UpdateTicketTypeDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty({ message: 'O nome do lote é obrigatório.' })
  @MaxLength(100, {
    message: 'O nome do lote deve ter no máximo 100 caracteres.',
  })
  batch?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'O preço do ingresso não pode ser negativo.' })
  price?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0, { message: 'A quantidade de ingressos não pode ser negativa.' })
  quantity?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsIn(ticketTypeModality.enumValues, {
    message: 'Modalidade de ingresso inválida.',
  })
  modality?: TicketTypeModality;

  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'Data de início das vendas inválida.' })
  salesStartDate?: Date | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'Data de fim das vendas inválida.' })
  salesEndDate?: Date | null;
}
