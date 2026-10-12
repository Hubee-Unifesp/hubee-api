import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { eventAgeRating, eventStatus } from '../../database/schema';

/** Contrato de saída (público) de um evento. */
export class EventResponseDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id: string;

  @Expose()
  @ApiProperty()
  name: string;

  @Expose()
  @ApiProperty({ nullable: true, required: false })
  description: string | null;

  @Expose()
  @ApiProperty({
    enum: eventAgeRating.enumValues,
    nullable: true,
    required: false,
  })
  ageRating: string | null;

  @Expose()
  @ApiProperty({ format: 'uuid' })
  organizerId: string;

  @Expose()
  @ApiProperty({ format: 'uuid' })
  venueId: string;

  @Expose()
  @ApiProperty()
  startDate: Date;

  @Expose()
  @ApiProperty()
  endDate: Date;

  @Expose()
  @ApiProperty({ nullable: true, required: false })
  salesStartDate: Date | null;

  @Expose()
  @ApiProperty({ enum: eventStatus.enumValues })
  status: string;

  @Expose()
  @ApiProperty({ nullable: true, required: false })
  category: string | null;

  @Expose()
  @ApiProperty({ nullable: true, required: false })
  edition: string | null;

  @Expose()
  @ApiProperty({ nullable: true, required: false })
  photoUrl: string | null;

  @Expose()
  @ApiProperty()
  featured: boolean;

  @Expose()
  @ApiProperty()
  createdAt: Date;

  @Expose()
  @ApiProperty()
  updatedAt: Date;
}
