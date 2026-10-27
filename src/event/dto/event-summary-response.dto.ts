import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/** Contrato de resposta usado pela listagem resumida de eventos da home. */
export class EventSummaryResponseDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id: string;

  @Expose()
  @ApiProperty()
  name: string;

  @Expose()
  @ApiProperty({ nullable: true })
  description: string | null;

  @Expose()
  @ApiProperty({ nullable: true })
  category: string | null;

  @Expose()
  @ApiProperty()
  startDate: Date;

  @Expose()
  @ApiProperty()
  endDate: Date;

  @Expose()
  @ApiProperty()
  featured: boolean;

  @Expose()
  @ApiProperty()
  organizerName: string;

  @Expose()
  @ApiProperty()
  venueName: string;

  @Expose()
  @ApiProperty()
  venueCity: string;

  @Expose()
  @ApiProperty({ type: Number, nullable: true })
  minPrice: number | null;

  @Expose()
  @ApiProperty({ nullable: true })
  minPriceBatch: string | null;

  @Expose()
  @ApiProperty({ type: Number })
  capacity: number;

  @Expose()
  @ApiProperty({ type: Number })
  ticketsSold: number;
}
