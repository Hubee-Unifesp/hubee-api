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
import {
  buildEventAiDraftUserPrompt,
  EVENT_AI_DRAFT_SYSTEM_PROMPT,
} from './event-ai-draft.prompt';
import { EVENT_AI_DRAFT_SCHEMA } from './event-ai-draft.schema';

const INVALID_DRAFT_MESSAGE =
  'Não foi possível gerar o rascunho do evento com IA. Tente novamente em instantes.';

@Injectable()
export class EventAiDraftService {
  private readonly logger = new Logger(EventAiDraftService.name);

  constructor(private readonly ai: AiService) {}

  async generate(
    description: string,
    now: Date = new Date(),
  ): Promise<EventAiDraftResponseDto> {
    const raw = await this.ai.generateStructured({
      system: EVENT_AI_DRAFT_SYSTEM_PROMPT,
      prompt: buildEventAiDraftUserPrompt(description, now),
      schema: EVENT_AI_DRAFT_SCHEMA,
    });

    const draft = await this.parse(raw);
    return toResponse(EventAiDraftResponseDto, this.normalize(draft));
  }

  private async parse(raw: unknown): Promise<EventAiDraftResponseDto> {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      this.logger.error('Rascunho da IA não é um objeto JSON');
      throw new ServiceUnavailableException(INVALID_DRAFT_MESSAGE);
    }

    const draft = plainToInstance(EventAiDraftResponseDto, raw);
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
      venueSuggestion: normalizeVenue(draft.venueSuggestion),
      suggestedTicketTypes: draft.suggestedTicketTypes.map((ticketType) => ({
        batch: ticketType.batch.trim(),
        price: ticketType.price ?? null,
        quantity: ticketType.quantity ?? null,
        modality: ticketType.modality ?? null,
      })),
      missingFields: [],
    };

    if (
      normalized.startDate &&
      normalized.endDate &&
      Date.parse(normalized.endDate) <= Date.parse(normalized.startDate)
    ) {
      this.logger.warn('Rascunho da IA com endDate anterior a startDate');
      normalized.startDate = null;
      normalized.endDate = null;
    }

    normalized.missingFields = EVENT_AI_DRAFT_FIELDS.filter((field) =>
      isMissing(normalized, field),
    );

    return normalized;
  }
}

function normalizeVenue(
  venue: EventAiDraftResponseDto['venueSuggestion'] | undefined,
): EventAiDraftResponseDto['venueSuggestion'] {
  if (!venue) return null;

  const normalized = {
    name: text(venue.name),
    address: text(venue.address),
    city: text(venue.city),
    state: text(venue.state)?.toUpperCase() ?? null,
  };

  return Object.values(normalized).every((value) => value === null)
    ? null
    : normalized;
}

function isMissing(
  draft: EventAiDraftResponseDto,
  field: EventAiDraftField,
): boolean {
  if (field === 'suggestedTicketTypes') {
    return draft.suggestedTicketTypes.length === 0;
  }
  return draft[field] === null;
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
