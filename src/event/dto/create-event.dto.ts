import { Type } from 'class-transformer';
import {
  IsDate,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  IsBoolean,
} from 'class-validator';
import {
  EVENT_CATEGORIES,
  eventAgeRating,
  MAX_EXPECTED_AUDIENCE,
} from '../../database/schema';
import type { EventAgeRating, EventCategory } from '../../database/schema';

export class CreateEventDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(eventAgeRating.enumValues)
  ageRating?: EventAgeRating;

  @IsUUID()
  organizerId: string;

  @IsUUID()
  venueId: string;

  @Type(() => Date)
  @IsDate()
  startDate: Date;

  @Type(() => Date)
  @IsDate()
  endDate: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  salesStartDate?: Date;

  @IsOptional()
  @IsIn(EVENT_CATEGORIES)
  category?: EventCategory;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  edition?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  photoUrl?: string;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsInt({ message: 'O público esperado deve ser um número inteiro.' })
  @Min(1, { message: 'O público esperado deve ser de pelo menos 1 pessoa.' })
  @Max(MAX_EXPECTED_AUDIENCE, {
    message: `O público esperado deve ser de no máximo ${MAX_EXPECTED_AUDIENCE} pessoas.`,
  })
  expectedAudience?: number;
}
