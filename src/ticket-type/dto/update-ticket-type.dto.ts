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
} from 'class-validator';
import { ticketTypeModality } from '../../database/schema';
import type { TicketTypeModality } from '../../database/schema';

/**
 * Não estende `PartialType(CreateTicketTypeDto)` de propósito: o evento de um
 * tipo de ingresso já existente não é uma operação válida, e aqui as datas de
 * venda aceitam `null` para serem apagadas.
 */
export class UpdateTicketTypeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'O nome do lote é obrigatório.' })
  @MaxLength(100, {
    message: 'O nome do lote deve ter no máximo 100 caracteres.',
  })
  batch?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'O preço do ingresso não pode ser negativo.' })
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(0, { message: 'A quantidade de ingressos não pode ser negativa.' })
  quantity?: number;

  @IsOptional()
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
