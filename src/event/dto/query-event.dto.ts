import {
  IsBoolean,
  IsDate,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { eventStatus } from '../../database/schema';
import type { EventStatus } from '../../database/schema';

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const toEndDate = ({ value }: { value: unknown }) =>
  typeof value === 'string' && DATE_ONLY.test(value)
    ? new Date(`${value}T23:59:59.999-03:00`)
    : new Date(value as string);

const toStartDate = ({ value }: { value: unknown }) =>
  typeof value === 'string' && DATE_ONLY.test(value)
    ? new Date(`${value}T00:00:00.000-03:00`)
    : new Date(value as string);

export class QueryEventDto {
  @ApiPropertyOptional({
    description: 'Busca por nome ou descrição do evento',
  })
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'A busca deve ser um texto' })
  @IsNotEmpty({ message: 'A busca não pode ser vazia' })
  @MaxLength(255, { message: 'A busca deve ter no máximo 255 caracteres' })
  search?: string;

  @ApiPropertyOptional({ example: 'shows' })
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'A categoria deve ser um texto' })
  @IsNotEmpty({ message: 'A categoria não pode ser vazia' })
  category?: string;

  @ApiPropertyOptional({ example: 'São Paulo' })
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'A cidade deve ser um texto' })
  @IsNotEmpty({ message: 'A cidade não pode ser vazia' })
  city?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description:
      'Eventos que terminam a partir desta data (aceita só o dia: 2026-10-20)',
  })
  @IsOptional()
  @Transform(toStartDate)
  @IsDate({ message: 'A data inicial é inválida' })
  startDate?: Date;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description:
      'Eventos que começam até esta data (só o dia vale até 23:59 do dia)',
  })
  @IsOptional()
  @Transform(toEndDate)
  @IsDate({ message: 'A data final é inválida' })
  endDate?: Date;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  organizerId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  venueId?: string;

  @ApiPropertyOptional({ enum: eventStatus.enumValues })
  @IsOptional()
  @IsIn(eventStatus.enumValues)
  status?: EventStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({ minimum: 1, default: DEFAULT_PAGE })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'A página deve ser um número inteiro' })
  @Min(1, { message: 'A página deve ser no mínimo 1' })
  page?: number = DEFAULT_PAGE;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_LIMIT,
    default: DEFAULT_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'O limite deve ser um número inteiro' })
  @Min(1, { message: 'O limite deve ser no mínimo 1' })
  @Max(MAX_LIMIT, { message: `O limite deve ser no máximo ${MAX_LIMIT}` })
  limit?: number = DEFAULT_LIMIT;
}
