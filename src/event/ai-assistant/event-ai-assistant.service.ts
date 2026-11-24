import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiService } from '../../ai/ai.service';
import { toResponse } from '../../common/serialization/to-response';
import {
  EVENT_CATEGORIES,
  eventAgeRating,
  ticketTypeModality,
} from '../../database/schema';
import {
  ASSISTANT_DATE_PATTERN,
  ASSISTANT_DESCRIPTION_MAX_LENGTH,
  ASSISTANT_MAX_TICKET_TYPES,
  ASSISTANT_REPLY_MAX_LENGTH,
  ASSISTANT_TIME_PATTERN,
  EventAiAssistantTurnResponseDto,
  type AssistantDraftDto,
  type AssistantField,
  type AssistantTicketTypeDto,
  type AssistantVenueDto,
  type EventAiAssistantTurnDto,
} from './dto/event-ai-assistant.dto';
import {
  emptyDraft,
  enforceConsistency,
  isComplete,
  isRequired,
  missingRequired,
  nextQuestion,
  type AssistantNotices,
} from './event-ai-assistant.fields';
import {
  buildEventAiAssistantPrompt,
  EVENT_AI_ASSISTANT_SYSTEM_PROMPT,
} from './event-ai-assistant.prompt';
import { EVENT_AI_ASSISTANT_SCHEMA } from './event-ai-assistant.schema';

const INVALID_ANSWER_MESSAGE =
  'Não foi possível entender a resposta com IA. Tente novamente em instantes.';

type PlainObject = Record<string, unknown>;

interface AssistantPatch {
  fields: Partial<Omit<AssistantDraftDto, 'skipped'>>;
  declined: boolean;
  reply: string | null;
}

@Injectable()
export class EventAiAssistantService {
  private readonly logger = new Logger(EventAiAssistantService.name);

  constructor(private readonly ai: AiService) {}

  async turn(
    dto: EventAiAssistantTurnDto,
    now: Date = new Date(),
  ): Promise<EventAiAssistantTurnResponseDto> {
    const draft = cloneDraft(dto.draft ?? emptyDraft());
    const notices: AssistantNotices = {};
    let reply: string | null = null;

    if (dto.skip) {
      if (dto.field) this.decline(draft, dto.field, notices);
    } else {
      const patch = await this.interpret(
        draft,
        dto.field,
        dto.answer ?? '',
        now,
      );
      Object.assign(draft, patch.fields);
      reply = patch.reply;
      if (patch.declined && dto.field && !isComplete(draft, dto.field)) {
        this.decline(draft, dto.field, notices);
      }
    }

    Object.assign(notices, enforceConsistency(draft, now));
    draft.skipped = draft.skipped.filter((field) => !isComplete(draft, field));

    const question = nextQuestion(draft, notices);
    return toResponse(EventAiAssistantTurnResponseDto, {
      draft,
      reply,
      question,
      missingRequired: missingRequired(draft),
      done: question === null,
    });
  }

  private decline(
    draft: AssistantDraftDto,
    field: AssistantField,
    notices: AssistantNotices,
  ): void {
    if (isRequired(field)) {
      notices[field] = 'required';
      return;
    }
    if (!draft.skipped.includes(field)) draft.skipped.push(field);
  }

  private async interpret(
    draft: AssistantDraftDto,
    field: AssistantField | undefined,
    answer: string,
    now: Date,
  ): Promise<AssistantPatch> {
    const raw = await this.ai.generateStructured({
      system: EVENT_AI_ASSISTANT_SYSTEM_PROMPT,
      prompt: buildEventAiAssistantPrompt(draft, field, answer, now),
      schema: EVENT_AI_ASSISTANT_SCHEMA,
      feature: 'event-ai-assistant',
    });

    if (!isPlainObject(raw)) {
      this.logger.error('Resposta da IA do assistente não é um objeto JSON');
      throw new ServiceUnavailableException(INVALID_ANSWER_MESSAGE);
    }

    const { patch, dropped } = sanitizePatch(raw);
    if (dropped.length > 0) {
      this.logger.warn(
        `Campos inválidos descartados da resposta da IA: ${dropped.join(', ')}`,
      );
    }
    return patch;
  }
}

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneDraft(draft: AssistantDraftDto): AssistantDraftDto {
  return {
    ...draft,
    venue: draft.venue ? { ...draft.venue } : null,
    ticketTypes: draft.ticketTypes.map((ticketType) => ({ ...ticketType })),
    skipped: [...draft.skipped],
  };
}

function text(value: unknown, maxLength: number): string | null | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'string') return null;
  const trimmed = Array.from(value.trim()).slice(0, maxLength).join('').trim();
  return trimmed === '' ? undefined : trimmed;
}

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | null | undefined {
  if (value === null || value === undefined) return undefined;
  return allowed.includes(value as T) ? (value as T) : null;
}

function isRealDate(value: string): boolean {
  const date = new Date(`${value}T12:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function dateValue(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return ASSISTANT_DATE_PATTERN.test(trimmed) && isRealDate(trimmed)
    ? trimmed
    : null;
}

function timeValue(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'string') return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const normalized = `${match[1].padStart(2, '0')}:${match[2]}`;
  return ASSISTANT_TIME_PATTERN.test(normalized) ? normalized : null;
}

function venueValue(value: unknown): AssistantVenueDto | null | undefined {
  if (value === null || value === undefined) return undefined;
  if (!isPlainObject(value)) return null;
  const state = typeof value.state === 'string' ? value.state.trim() : null;
  const venue: AssistantVenueDto = {
    name: text(value.name, 255) ?? null,
    address: text(value.address, 255) ?? null,
    city: text(value.city, 100) ?? null,
    state: state && /^[A-Za-z]{2}$/.test(state) ? state.toUpperCase() : null,
  };
  return Object.values(venue).every((part) => part === null)
    ? undefined
    : venue;
}

function priceValue(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function quantityValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

function ticketTypesValue(
  value: unknown,
): AssistantTicketTypeDto[] | null | undefined {
  if (value === null || value === undefined) return undefined;
  if (!Array.isArray(value)) return null;
  const ticketTypes = value.flatMap((item: unknown) => {
    if (!isPlainObject(item)) return [];
    const batch = text(item.batch, 100);
    if (!batch) return [];
    return [
      {
        batch,
        price: priceValue(item.price),
        quantity: quantityValue(item.quantity),
        modality: oneOf(item.modality, ticketTypeModality.enumValues) ?? null,
      },
    ];
  });
  if (ticketTypes.length === 0) return undefined;
  return ticketTypes.slice(0, ASSISTANT_MAX_TICKET_TYPES);
}

export function sanitizePatch(raw: PlainObject): {
  patch: AssistantPatch;
  dropped: string[];
} {
  const candidates: Record<string, unknown> = {
    name: text(raw.name, 255),
    description: text(raw.description, ASSISTANT_DESCRIPTION_MAX_LENGTH),
    category: oneOf(raw.category, EVENT_CATEGORIES),
    ageRating: oneOf(raw.ageRating, eventAgeRating.enumValues),
    edition: text(raw.edition, 100),
    startDate: dateValue(raw.startDate),
    startTime: timeValue(raw.startTime),
    endDate: dateValue(raw.endDate),
    endTime: timeValue(raw.endTime),
    salesStartDate: dateValue(raw.salesStartDate),
    salesStartTime: timeValue(raw.salesStartTime),
    venue: venueValue(raw.venue),
    ticketTypes: ticketTypesValue(raw.ticketTypes),
  };

  const fields: PlainObject = {};
  const dropped: string[] = [];
  for (const [key, value] of Object.entries(candidates)) {
    if (value === undefined) continue;
    if (value === null) {
      dropped.push(key);
      continue;
    }
    fields[key] = value;
  }

  return {
    patch: {
      fields: fields as AssistantPatch['fields'],
      declined: raw.declined === true,
      reply: text(raw.reply, ASSISTANT_REPLY_MAX_LENGTH) ?? null,
    },
    dropped,
  };
}
