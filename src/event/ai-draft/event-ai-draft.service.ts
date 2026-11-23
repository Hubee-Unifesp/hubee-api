import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { AiService } from '../../ai/ai.service';
import { toResponse } from '../../common/serialization/to-response';
import {
  EVENT_AI_DRAFT_FIELDS,
  EventAiDraftResponseDto,
  type EventAiDraftField,
} from '../dto/event-ai-draft-response.dto';
import type { GenerateEventDraftDto } from '../dto/generate-event-draft.dto';
import {
  buildEventAiDraftUserPrompt,
  EVENT_AI_DRAFT_SYSTEM_PROMPT,
  EVENT_AI_DRAFT_TIME_ZONE,
} from './event-ai-draft.prompt';
import { EVENT_AI_DRAFT_SCHEMA } from './event-ai-draft.schema';

const INVALID_DRAFT_MESSAGE =
  'Não foi possível gerar o rascunho do evento com IA. Tente novamente em instantes.';

@Injectable()
export class EventAiDraftService {
  private readonly logger = new Logger(EventAiDraftService.name);

  constructor(private readonly ai: AiService) {}

  async generate(
    { prompt }: GenerateEventDraftDto,
    now: Date = new Date(),
  ): Promise<EventAiDraftResponseDto> {
    const raw = await this.ai.generateStructured({
      system: EVENT_AI_DRAFT_SYSTEM_PROMPT,
      prompt: buildEventAiDraftUserPrompt(prompt, now),
      schema: EVENT_AI_DRAFT_SCHEMA,
      feature: 'event-ai-draft',
    });

    const draft = await this.parse(raw);
    return toResponse(EventAiDraftResponseDto, this.normalize(draft));
  }

  private async parse(raw: unknown): Promise<EventAiDraftResponseDto> {
    if (!isPlainObject(raw)) {
      this.logger.error('Rascunho da IA não é um objeto JSON');
      throw new ServiceUnavailableException(INVALID_DRAFT_MESSAGE);
    }

    const draft = plainToInstance(EventAiDraftResponseDto, repair(raw));
    const errors = await validate(draft, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    });

    if (errors.length > 0) {
      this.logger.error(
        `Rascunho da IA fora do schema: ${describeErrors(errors).join('; ')}`,
      );
      throw new ServiceUnavailableException(INVALID_DRAFT_MESSAGE);
    }

    return draft;
  }

  private normalize(draft: EventAiDraftResponseDto): EventAiDraftResponseDto {
    const normalized: EventAiDraftResponseDto = {
      name: text(draft.name),
      description: text(draft.description),
      category: draft.category ?? null,
      ageRating: draft.ageRating ?? null,
      edition: text(draft.edition),
      startDate: draft.startDate ?? null,
      endDate: draft.endDate ?? null,
      salesStartDate: draft.salesStartDate ?? null,
      venueSuggestion: normalizeVenue(draft.venueSuggestion),
      suggestedTicketTypes: draft.suggestedTicketTypes.map((ticketType) => ({
        batch: ticketType.batch.trim(),
        price: ticketType.price ?? null,
        quantity: ticketType.quantity ?? null,
        modality: ticketType.modality ?? null,
      })),
      missingFields: [],
    };

    const { startDate, endDate, salesStartDate } = normalized;

    if (startDate && endDate && !endsAfterStart(startDate, endDate)) {
      this.logger.warn('Rascunho da IA com endDate anterior a startDate');
      normalized.startDate = null;
      normalized.endDate = null;
    }

    if (
      salesStartDate &&
      normalized.startDate &&
      compareDates(salesStartDate, normalized.startDate) > 0
    ) {
      this.logger.warn('Rascunho da IA com salesStartDate depois de startDate');
      normalized.salesStartDate = null;
    }

    normalized.missingFields = EVENT_AI_DRAFT_FIELDS.filter((field) =>
      isMissing(normalized, field),
    );

    return normalized;
  }
}

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function repair(raw: PlainObject): PlainObject {
  const repaired: PlainObject = {
    ...raw,
    name: clip(raw.name, 255),
    edition: clip(raw.edition, 100),
  };

  const venue = raw.venueSuggestion;
  if (isPlainObject(venue)) {
    repaired.venueSuggestion = {
      ...venue,
      name: clip(venue.name, 255),
      address: clip(venue.address, 255),
      city: clip(venue.city, 100),
      state: stateCode(venue.state),
    };
  }

  const ticketTypes = raw.suggestedTicketTypes;
  if (Array.isArray(ticketTypes)) {
    repaired.suggestedTicketTypes = ticketTypes.map((ticketType: unknown) =>
      isPlainObject(ticketType)
        ? {
            ...ticketType,
            batch: clip(ticketType.batch, 100),
            price: price(ticketType.price),
            quantity: quantity(ticketType.quantity),
          }
        : ticketType,
    );
  }

  return repaired;
}

function clip(value: unknown, maxLength: number): unknown {
  if (typeof value !== 'string') return value;
  return Array.from(value.trim()).slice(0, maxLength).join('').trim();
}

function stateCode(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return /^[A-Za-z]{2}$/.test(trimmed) ? trimmed.toUpperCase() : null;
}

function price(value: unknown): unknown {
  if (typeof value !== 'number' || !Number.isFinite(value)) return value;
  if (value < 0) return null;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function quantity(value: unknown): unknown {
  if (typeof value !== 'number' || !Number.isInteger(value)) return value;
  return value < 0 ? null : value;
}

function normalizeVenue(
  venue: EventAiDraftResponseDto['venueSuggestion'] | undefined,
): EventAiDraftResponseDto['venueSuggestion'] {
  if (!venue) return null;

  const normalized = {
    name: text(venue.name),
    address: text(venue.address),
    city: text(venue.city),
    state: text(venue.state),
  };

  return Object.values(normalized).every((value) => value === null)
    ? null
    : normalized;
}

const DATE_FIELDS = new Set<EventAiDraftField>([
  'startDate',
  'endDate',
  'salesStartDate',
]);

const localDayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: EVENT_AI_DRAFT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function isDateOnly(value: string): boolean {
  return !value.includes('T');
}

function localDay(value: string): string {
  return isDateOnly(value) ? value : localDayFormat.format(new Date(value));
}

function compareDates(a: string, b: string): number {
  if (isDateOnly(a) || isDateOnly(b)) {
    return localDay(a).localeCompare(localDay(b));
  }
  return Date.parse(a) - Date.parse(b);
}

function endsAfterStart(start: string, end: string): boolean {
  const diff = compareDates(end, start);
  if (isDateOnly(start) || isDateOnly(end)) return diff >= 0;
  return diff > 0;
}

function isMissing(
  draft: EventAiDraftResponseDto,
  field: EventAiDraftField,
): boolean {
  if (field === 'suggestedTicketTypes') {
    return draft.suggestedTicketTypes.length === 0;
  }
  const value = draft[field];
  if (value === null) return true;
  return (
    DATE_FIELDS.has(field) && typeof value === 'string' && isDateOnly(value)
  );
}

function text(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function describeErrors(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((error) => {
    const path = parent ? `${parent}.${error.property}` : error.property;
    const own = error.constraints
      ? [`${path} (${Object.keys(error.constraints).join(', ')})`]
      : [];
    return [...own, ...describeErrors(error.children ?? [], path)];
  });
}
