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

/** O evento vem da rota (`/events/:eventId/ticket-types`), não do corpo. */
export class CreateTicketTypeDto {
  @IsString()
  @IsNotEmpty({ message: 'O nome do lote é obrigatório.' })
  @MaxLength(100, {
    message: 'O nome do lote deve ter no máximo 100 caracteres.',
  })
  batch: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'O preço do ingresso não pode ser negativo.' })
  price: number;

  @IsInt()
  @Min(0, { message: 'A quantidade de ingressos não pode ser negativa.' })
  quantity?: number = 0;

  /** Modalidade do ingresso; sem valor, o lote é de inteira. */
  @IsOptional()
  @IsIn(ticketTypeModality.enumValues, {
    message: 'Modalidade de ingresso inválida.',
  })
  modality?: TicketTypeModality;

  /** Início das vendas do lote; `null` segue o início das vendas do evento. */
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'Data de início das vendas inválida.' })
  salesStartDate?: Date | null;

  /** Fim das vendas do lote; `null` vende até o fim do evento. */
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'Data de fim das vendas inválida.' })
  salesEndDate?: Date | null;
}
