import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { eventStatus } from '../../database/schema';
import type { EventStatus } from '../../database/schema';

export class QueryEventDto {
  @IsOptional()
  @IsUUID()
  organizerId?: string;

  @IsOptional()
  @IsUUID()
  venueId?: string;

  @IsOptional()
  @IsIn(eventStatus.enumValues)
  status?: EventStatus;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  featured?: boolean;
}
