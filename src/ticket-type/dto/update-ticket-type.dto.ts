import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Não estende `PartialType(CreateTicketTypeDto)` de propósito: o evento de um
 * tipo de ingresso já existente não é uma operação válida, então `eventId`
 * fica fora do DTO.
 */
export class UpdateTicketTypeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  batch?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(0, { message: 'A quantidade de ingressos não pode ser negativa.' })
  quantity?: number;
}
