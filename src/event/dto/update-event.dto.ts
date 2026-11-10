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
import { eventAgeRating, eventStatus } from '../../database/schema';
import type { EventAgeRating, EventStatus } from '../../database/schema';

/**
 * Campos opcionais do evento (`description`, `ageRating`, `salesStartDate`,
 * `category`, `edition` e `photoUrl`) aceitam `null` para serem apagados.
 */
export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsIn(eventAgeRating.enumValues)
  ageRating?: EventAgeRating | null;

  @IsOptional()
  @IsUUID()
  venueId?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  salesStartDate?: Date | null;

  @IsOptional()
  @IsIn(eventStatus.enumValues)
  status?: EventStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  edition?: string | null;

  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  photoUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;
}
