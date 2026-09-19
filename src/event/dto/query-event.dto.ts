import { IsIn, IsOptional, IsUUID } from 'class-validator';
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
}
