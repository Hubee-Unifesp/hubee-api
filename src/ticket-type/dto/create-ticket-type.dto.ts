import { IsNotEmpty, IsNumber, IsPositive, IsString, MaxLength } from 'class-validator';

/** O evento vem da rota (`/eventos/:eventId/tipos-ingresso`), não do corpo. */
export class CreateTicketTypeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  batch: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price: number;
}
