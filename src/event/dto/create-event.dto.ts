import { Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  IsBoolean,
} from 'class-validator';
import { EVENT_CATEGORIES, eventAgeRating } from '../../database/schema';
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
}
