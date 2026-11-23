import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
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
  'salesStartDate',
  'venueSuggestion',
  'suggestedTicketTypes',
] as const;

export const EVENT_AI_DRAFT_DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?$/;

const dateDescription = (example: string) =>
  `Data/hora ISO 8601 com fuso, ex.: ${example}. Quando só o dia é conhecido, vem apenas a data (YYYY-MM-DD) e o campo também aparece em missingFields para completar o horário.`;

export type EventAiDraftField = (typeof EVENT_AI_DRAFT_FIELDS)[number];

export const EVENT_AI_DRAFT_DESCRIPTION_MAX_LENGTH = 5000;
export const EVENT_AI_DRAFT_MAX_TICKET_TYPES = 20;
export const EVENT_AI_DRAFT_MAX_QUESTIONS = 3;
export const EVENT_AI_DRAFT_QUESTION_MAX_LENGTH = 300;

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

export class EventAiDraftQuestionDto {
  @Expose()
  @ApiProperty({
    enum: EVENT_AI_DRAFT_FIELDS,
    description: 'Campo do rascunho que a pergunta ajuda a completar',
  })
  @IsIn(EVENT_AI_DRAFT_FIELDS)
  field: EventAiDraftField;

  @Expose()
  @ApiProperty({ maxLength: EVENT_AI_DRAFT_QUESTION_MAX_LENGTH })
  @IsString()
  @IsNotEmpty()
  @MaxLength(EVENT_AI_DRAFT_QUESTION_MAX_LENGTH)
  question: string;
}

export class EventAiDraftDto {
  @Expose()
  @ApiProperty({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name: string | null;

  @Expose()
  @ApiProperty({
    nullable: true,
    maxLength: EVENT_AI_DRAFT_DESCRIPTION_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(EVENT_AI_DRAFT_DESCRIPTION_MAX_LENGTH)
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
    description: dateDescription('2026-11-21T20:00:00-03:00'),
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(EVENT_AI_DRAFT_DATE_PATTERN)
  startDate: string | null;

  @Expose()
  @ApiProperty({
    nullable: true,
    description: dateDescription('2026-11-21T23:00:00-03:00'),
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(EVENT_AI_DRAFT_DATE_PATTERN)
  endDate: string | null;

  @Expose()
  @ApiProperty({
    nullable: true,
    description: `Início das vendas, nunca depois do início do evento. ${dateDescription('2026-11-10T10:00:00-03:00')}`,
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(EVENT_AI_DRAFT_DATE_PATTERN)
  salesStartDate: string | null;

  @Expose()
  @ApiProperty({ type: VenueSuggestionDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => VenueSuggestionDto)
  venueSuggestion: VenueSuggestionDto | null;

  @Expose()
  @ApiProperty({ type: [SuggestedTicketTypeDto] })
  @IsArray()
  @ArrayMaxSize(EVENT_AI_DRAFT_MAX_TICKET_TYPES)
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

  @Expose()
  @ApiProperty({
    type: [EventAiDraftQuestionDto],
    description:
      'Perguntas para o organizador completar o rascunho na próxima rodada',
  })
  @IsArray()
  @ArrayMaxSize(EVENT_AI_DRAFT_MAX_QUESTIONS)
  @ValidateNested({ each: true })
  @Type(() => EventAiDraftQuestionDto)
  questions: EventAiDraftQuestionDto[];
}

export class EventAiDraftResponseDto extends EventAiDraftDto {
  @Expose()
  @ApiProperty({
    description:
      'true quando a IA não tem mais perguntas e o organizador pode seguir pelo formulário',
  })
  @IsOptional()
  @IsBoolean()
  done: boolean;
}
