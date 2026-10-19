import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { EventResponseDto } from './event-response.dto';

export class EventListItemResponseDto extends EventResponseDto {
  @Expose()
  @ApiProperty()
  venueName: string;

  @Expose()
  @ApiProperty()
  venueCity: string;

  @Expose()
  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Menor preço entre os lotes (null quando não há lotes)',
  })
  minPrice: number | null;

  @Expose()
  @ApiProperty({
    nullable: true,
    description: 'Lote que tem o menor preço',
  })
  minPriceBatch: string | null;
}
