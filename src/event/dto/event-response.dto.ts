import { ApiProperty } from '@nestjs/swagger';
import { eventAgeRating, eventStatus } from '../../database/schema';

/** Contrato de saída (público) de um evento. */
export class EventResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true, required: false })
  description: string | null;

  @ApiProperty({
    enum: eventAgeRating.enumValues,
    nullable: true,
    required: false,
  })
  ageRating: string | null;

  @ApiProperty({ format: 'uuid' })
  organizerId: string;

  @ApiProperty({ format: 'uuid' })
  venueId: string;

  @ApiProperty()
  startDate: Date;

  @ApiProperty()
  endDate: Date;

  @ApiProperty({ nullable: true, required: false })
  salesStartDate: Date | null;

  @ApiProperty({ enum: eventStatus.enumValues })
  status: string;

  @ApiProperty({ nullable: true, required: false })
  category: string | null;

  @ApiProperty({ nullable: true, required: false })
  edition: string | null;

  @ApiProperty({ nullable: true, required: false })
  photoUrl: string | null;

  @ApiProperty()
  featured: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
