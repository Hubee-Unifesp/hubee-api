import { ApiProperty } from '@nestjs/swagger';

/** Contrato de resposta usado pela listagem resumida de eventos da home. */
export class EventSummaryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty({ nullable: true })
  category: string | null;

  @ApiProperty()
  startDate: Date;

  @ApiProperty()
  endDate: Date;

  @ApiProperty()
  featured: boolean;

  @ApiProperty()
  organizerName: string;

  @ApiProperty()
  venueName: string;

  @ApiProperty()
  venueCity: string;

  @ApiProperty({ type: Number, nullable: true })
  minPrice: number | null;

  @ApiProperty({ nullable: true })
  minPriceBatch: string | null;

  @ApiProperty({ type: Number })
  capacity: number;

  @ApiProperty({ type: Number })
  ticketsSold: number;
}
