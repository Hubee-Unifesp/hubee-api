import {
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { min } from 'drizzle-orm';

/** O evento vem da rota (`/eventos/:eventId/tipos-ingresso`), não do corpo. */
export class CreateTicketTypeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  batch: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'O preço do ingresso não pode ser negativo.' })
  price: number;

  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(0, { message: 'A quantidade de ingressos não pode ser negativa.' })
  quantity: number;
}
