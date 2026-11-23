import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  EVENT_CATEGORIES,
  eventAgeRating,
  ticketTypeModality,
} from '../../database/schema';
import type {
  EventAgeRating,
  EventCategory,
  TicketTypeModality,
} from '../../database/schema';

export const EVENT_AI_DRAFT_FIELDS = [
  'name',
  'description',
  'category',
  'ageRating',
  'edition',
  'startDate',
  'endDate',
  'venueSuggestion',
  'suggestedTicketTypes',
] as const;

export type EventAiDraftField = (typeof EVENT_AI_DRAFT_FIELDS)[number];

export class VenueSuggestionDto {
  @Expose()
  @ApiProperty({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name: string | null;

  @Expose()
  @ApiProperty({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address: string | null;

  @Expose()
  @ApiProperty({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city: string | null;

  @Expose()
  @ApiProperty({ nullable: true, description: 'Sigla da UF, ex.: SP' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  state: string | null;
}

export class SuggestedTicketTypeDto {
  @Expose()
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  batch: string;

  @Expose()
  @ApiProperty({ nullable: true, description: 'Preço em reais' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number | null;

  @Expose()
  @ApiProperty({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  quantity: number | null;

  @Expose()
  @ApiProperty({ enum: ticketTypeModality.enumValues, nullable: true })
  @IsOptional()
  @IsIn(ticketTypeModality.enumValues)
  modality: TicketTypeModality | null;
}

export class EventAiDraftResponseDto {
  @Expose()
  @ApiProperty({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name: string | null;

  @Expose()
  @ApiProperty({ nullable: true })
  @IsOptional()
  @IsString()
  description: string | null;

  @Expose()
  @ApiProperty({ enum: EVENT_CATEGORIES, nullable: true })
  @IsOptional()
  @IsIn(EVENT_CATEGORIES)
  category: EventCategory | null;

  @Expose()
  @ApiProperty({ enum: eventAgeRating.enumValues, nullable: true })
  @IsOptional()
  @IsIn(eventAgeRating.enumValues)
  ageRating: EventAgeRating | null;

  @Expose()
  @ApiProperty({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  edition: string | null;

  @Expose()
  @ApiProperty({
    nullable: true,
    description: 'Data/hora ISO 8601 com fuso, ex.: 2026-11-21T20:00:00-03:00',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  startDate: string | null;

  @Expose()
  @ApiProperty({
    nullable: true,
    description: 'Data/hora ISO 8601 com fuso, ex.: 2026-11-21T23:00:00-03:00',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  endDate: string | null;

  @Expose()
  @ApiProperty({ type: VenueSuggestionDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => VenueSuggestionDto)
  venueSuggestion: VenueSuggestionDto | null;

  @Expose()
  @ApiProperty({ type: [SuggestedTicketTypeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SuggestedTicketTypeDto)
  suggestedTicketTypes: SuggestedTicketTypeDto[];

  @Expose()
  @ApiProperty({
    enum: EVENT_AI_DRAFT_FIELDS,
    isArray: true,
    description: 'Campos que a IA não conseguiu inferir e precisam de revisão',
  })
  @IsArray()
  @IsIn(EVENT_AI_DRAFT_FIELDS, { each: true })
  missingFields: EventAiDraftField[];
}
