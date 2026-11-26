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
  ValidateIf,
} from 'class-validator';
import {
  EVENT_CATEGORIES,
  eventAgeRating,
  eventStatus,
  MAX_EXPECTED_AUDIENCE,
} from '../../database/schema';
import type {
  EventAgeRating,
  EventCategory,
  EventStatus,
} from '../../database/schema';

/**
 * Campos opcionais do evento (`description`, `ageRating`, `salesStartDate`,
 * `category`, `edition`, `photoUrl` e `expectedAudience`) aceitam `null` para
 * serem apagados.
 *
 * Os campos NOT NULL usam `@ValidateIf` em vez de `@IsOptional()`: o
 * `@IsOptional()` também pula a validação para `null`, que chegaria ao banco
 * e viraria erro 500. Assim só são ignorados quando ausentes, e `null`
 * responde 400.
 */
export class UpdateEventDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsIn(eventAgeRating.enumValues)
  ageRating?: EventAgeRating | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsUUID()
  venueId?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @ValidateIf((_, value) => value !== undefined)
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  salesStartDate?: Date | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsIn(eventStatus.enumValues)
  status?: EventStatus;

  @IsOptional()
  @IsIn(EVENT_CATEGORIES)
  category?: EventCategory | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  edition?: string | null;

  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  photoUrl?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsInt({ message: 'O público esperado deve ser um número inteiro.' })
  @Min(1, { message: 'O público esperado deve ser de pelo menos 1 pessoa.' })
  @Max(MAX_EXPECTED_AUDIENCE, {
    message: `O público esperado deve ser de no máximo ${MAX_EXPECTED_AUDIENCE} pessoas.`,
  })
  expectedAudience?: number | null;
}
