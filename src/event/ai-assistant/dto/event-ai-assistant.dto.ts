import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  EVENT_CATEGORIES,
  eventAgeRating,
  ticketTypeModality,
} from '../../../database/schema';
import type {
  EventAgeRating,
  EventCategory,
  TicketTypeModality,
} from '../../../database/schema';

export const ASSISTANT_FIELDS = [
  'name',
  'start',
  'end',
  'venue',
  'ticketTypes',
  'salesStart',
  'category',
  'ageRating',
  'description',
] as const;

export type AssistantField = (typeof ASSISTANT_FIELDS)[number];

export const ASSISTANT_REQUIRED_FIELDS: readonly AssistantField[] = [
  'name',
  'start',
  'end',
  'venue',
];

export const ASSISTANT_ANSWER_MAX_LENGTH = 2000;
export const ASSISTANT_DESCRIPTION_MAX_LENGTH = 5000;
export const ASSISTANT_MAX_TICKET_TYPES = 20;
export const ASSISTANT_REPLY_MAX_LENGTH = 300;
export const ASSISTANT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const ASSISTANT_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const dateMessage = 'A data deve estar no formato AAAA-MM-DD.';
const timeMessage = 'O horário deve estar no formato HH:mm.';

export class AssistantVenueDto {
  @Expose()
  @ApiProperty({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name: string | null;

  @Expose()
  @ApiProperty({ nullable: true, description: 'Endereço em texto livre' })
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
  @Matches(/^[A-Z]{2}$/, { message: 'A UF deve ter duas letras maiúsculas.' })
  state: string | null;
}

export class AssistantTicketTypeDto {
  @Expose()
  @ApiProperty({ maxLength: 100 })
  @IsString()
  @IsNotEmpty({ message: 'O nome do lote é obrigatório.' })
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

export class AssistantDraftDto {
  @Expose()
  @ApiProperty({ nullable: true, maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name: string | null;

  @Expose()
  @ApiProperty({
    nullable: true,
    maxLength: ASSISTANT_DESCRIPTION_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(ASSISTANT_DESCRIPTION_MAX_LENGTH)
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
  @ApiProperty({ nullable: true, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  edition: string | null;

  @Expose()
  @ApiProperty({ nullable: true, example: '2026-12-05' })
  @IsOptional()
  @Matches(ASSISTANT_DATE_PATTERN, { message: dateMessage })
  startDate: string | null;

  @Expose()
  @ApiProperty({ nullable: true, example: '20:00' })
  @IsOptional()
  @Matches(ASSISTANT_TIME_PATTERN, { message: timeMessage })
  startTime: string | null;

  @Expose()
  @ApiProperty({ nullable: true, example: '2026-12-06' })
  @IsOptional()
  @Matches(ASSISTANT_DATE_PATTERN, { message: dateMessage })
  endDate: string | null;

  @Expose()
  @ApiProperty({ nullable: true, example: '02:00' })
  @IsOptional()
  @Matches(ASSISTANT_TIME_PATTERN, { message: timeMessage })
  endTime: string | null;

  @Expose()
  @ApiProperty({ nullable: true, example: '2026-11-30' })
  @IsOptional()
  @Matches(ASSISTANT_DATE_PATTERN, { message: dateMessage })
  salesStartDate: string | null;

  @Expose()
  @ApiProperty({ nullable: true, example: '10:00' })
  @IsOptional()
  @Matches(ASSISTANT_TIME_PATTERN, { message: timeMessage })
  salesStartTime: string | null;

  @Expose()
  @ApiProperty({ type: AssistantVenueDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => AssistantVenueDto)
  venue: AssistantVenueDto | null;

  @Expose()
  @ApiProperty({ type: [AssistantTicketTypeDto] })
  @IsArray()
  @ArrayMaxSize(ASSISTANT_MAX_TICKET_TYPES)
  @ValidateNested({ each: true })
  @Type(() => AssistantTicketTypeDto)
  ticketTypes: AssistantTicketTypeDto[];

  @Expose()
  @ApiProperty({
    enum: ASSISTANT_FIELDS,
    isArray: true,
    description: 'Campos opcionais que o organizador preferiu pular',
  })
  @IsArray()
  @IsIn(ASSISTANT_FIELDS, { each: true })
  skipped: AssistantField[];
}

export class EventAiAssistantTurnDto {
  @ApiPropertyOptional({
    type: AssistantDraftDto,
    description:
      'Rascunho devolvido na rodada anterior. Ausente na primeira mensagem.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AssistantDraftDto)
  draft?: AssistantDraftDto;

  @ApiPropertyOptional({
    enum: ASSISTANT_FIELDS,
    description:
      'Campo da pergunta que está sendo respondida. Ausente na primeira mensagem.',
  })
  @IsOptional()
  @IsIn(ASSISTANT_FIELDS, { message: 'Campo da pergunta inválido.' })
  field?: AssistantField;

  @ApiPropertyOptional({
    maxLength: ASSISTANT_ANSWER_MAX_LENGTH,
    description:
      'Primeira descrição do evento ou resposta à pergunta. Obrigatória quando skip não é true.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ValidateIf((dto: EventAiAssistantTurnDto) => dto.skip !== true)
  @IsString({ message: 'A resposta deve ser um texto.' })
  @IsNotEmpty({ message: 'Escreva uma resposta para continuar.' })
  @MaxLength(ASSISTANT_ANSWER_MAX_LENGTH, {
    message: `A resposta deve ter no máximo ${ASSISTANT_ANSWER_MAX_LENGTH} caracteres.`,
  })
  answer?: string;

  @ApiPropertyOptional({
    description: 'true para pular a pergunta de um campo opcional',
  })
  @IsOptional()
  @IsBoolean()
  skip?: boolean;
}

export class AssistantQuestionDto {
  @Expose()
  @ApiProperty({ enum: ASSISTANT_FIELDS })
  field: AssistantField;

  @Expose()
  @ApiProperty()
  text: string;

  @Expose()
  @ApiProperty({ description: 'false quando o campo é obrigatório' })
  skippable: boolean;
}

export class EventAiAssistantTurnResponseDto {
  @Expose()
  @ApiProperty({ type: AssistantDraftDto })
  @Type(() => AssistantDraftDto)
  draft: AssistantDraftDto;

  @Expose()
  @ApiProperty({
    nullable: true,
    description: 'Confirmação curta do que foi entendido na resposta',
  })
  reply: string | null;

  @Expose()
  @ApiProperty({ type: AssistantQuestionDto, nullable: true })
  @Type(() => AssistantQuestionDto)
  question: AssistantQuestionDto | null;

  @Expose()
  @ApiProperty({
    enum: ASSISTANT_FIELDS,
    isArray: true,
    description: 'Campos obrigatórios ainda incompletos',
  })
  missingRequired: AssistantField[];

  @Expose()
  @ApiProperty({
    description:
      'true quando todos os obrigatórios estão completos e não há mais perguntas',
  })
  done: boolean;
}
