import {
  IsNotEmpty,
  IsInt,
  IsNumber,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/** O evento vem da rota (`/eventos/:eventId/tipos-ingresso`), não do corpo. */
export class CreateTicketTypeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  batch: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'O preço do ingresso não pode ser negativo.' })
  price: number;

  @IsInt()
  @Min(0, { message: 'A quantidade de ingressos não pode ser negativa.' })
  quantity?: number = 0;
}
