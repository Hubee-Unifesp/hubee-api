import { EVENT_CATEGORIES } from '../../database/schema';
import {
  ASSISTANT_FIELDS,
  ASSISTANT_REQUIRED_FIELDS,
  type AssistantDraftDto,
  type AssistantField,
  type AssistantQuestionDto,
  type AssistantTicketTypeDto,
} from './dto/event-ai-assistant.dto';

export const ASSISTANT_TIME_ZONE = 'America/Sao_Paulo';

export type AssistantNotice =
  'required' | 'startInPast' | 'endBeforeStart' | 'salesAfterStart';

export type AssistantNotices = Partial<Record<AssistantField, AssistantNotice>>;

export function emptyDraft(): AssistantDraftDto {
  return {
    name: null,
    description: null,
    category: null,
    ageRating: null,
    edition: null,
    startDate: null,
    startTime: null,
    endDate: null,
    endTime: null,
    salesStartDate: null,
    salesStartTime: null,
    venue: null,
    ticketTypes: [],
    skipped: [],
  };
}

export function isRequired(field: AssistantField): boolean {
  return ASSISTANT_REQUIRED_FIELDS.includes(field);
}

function isTicketTypeComplete(ticketType: AssistantTicketTypeDto): boolean {
  return ticketType.price !== null && ticketType.quantity !== null;
}

export function isComplete(
  draft: AssistantDraftDto,
  field: AssistantField,
): boolean {
  switch (field) {
    case 'name':
      return draft.name !== null;
    case 'start':
      return draft.startDate !== null && draft.startTime !== null;
    case 'end':
      return draft.endDate !== null && draft.endTime !== null;
    case 'salesStart':
      return draft.salesStartDate !== null && draft.salesStartTime !== null;
    case 'venue':
      return Boolean(draft.venue?.name && draft.venue.city);
    case 'ticketTypes':
      return (
        draft.ticketTypes.length > 0 &&
        draft.ticketTypes.every(isTicketTypeComplete)
      );
    case 'category':
      return draft.category !== null;
    case 'ageRating':
      return draft.ageRating !== null;
    case 'description':
      return draft.description !== null;
  }
}

export function missingRequired(draft: AssistantDraftDto): AssistantField[] {
  return ASSISTANT_REQUIRED_FIELDS.filter((field) => !isComplete(draft, field));
}

const localDateTimeFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: ASSISTANT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function localNow(now: Date): { date: string; time: string } {
  const parts = Object.fromEntries(
    localDateTimeFormat
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

function moment(date: string, time: string | null): string {
  return `${date}T${time ?? '00:00'}`;
}

function nextDay(date: string): string {
  const day = new Date(`${date}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}

export function enforceConsistency(
  draft: AssistantDraftDto,
  now: Date,
): AssistantNotices {
  const notices: AssistantNotices = {};
  const today = localNow(now);

  if (draft.startDate) {
    const startsBeforeToday = draft.startDate < today.date;
    const startsEarlierToday =
      draft.startDate === today.date &&
      draft.startTime !== null &&
      draft.startTime <= today.time;
    if (startsBeforeToday || startsEarlierToday) {
      draft.startDate = null;
      draft.startTime = null;
      notices.start = 'startInPast';
    }
  }

  if (!draft.endDate && draft.endTime && draft.startDate && draft.startTime) {
    draft.endDate =
      draft.endTime > draft.startTime
        ? draft.startDate
        : nextDay(draft.startDate);
  }

  if (draft.startDate && draft.endDate) {
    const start = moment(draft.startDate, draft.startTime);
    const end = moment(draft.endDate, draft.endTime);
    const bothTimed = draft.startTime !== null && draft.endTime !== null;
    if (end < start || (bothTimed && end === start)) {
      draft.endDate = null;
      draft.endTime = null;
      notices.end = 'endBeforeStart';
    }
  }

  if (draft.salesStartDate && draft.startDate) {
    const sales = moment(draft.salesStartDate, draft.salesStartTime);
    const start = moment(draft.startDate, draft.startTime);
    if (sales > start) {
      draft.salesStartDate = null;
      draft.salesStartTime = null;
      notices.salesStart = 'salesAfterStart';
    }
  }

  return notices;
}

function formatDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

function describeStart(draft: AssistantDraftDto): string {
  if (!draft.startDate) return '';
  const time = draft.startTime ? ` às ${draft.startTime}` : '';
  return `${formatDate(draft.startDate)}${time}`;
}

const NOTICE_TEXT: Record<
  AssistantNotice,
  (draft: AssistantDraftDto) => string
> = {
  required: () => 'Esse dado é obrigatório para criar o evento.',
  startInPast: () => 'A data de início precisa ser no futuro.',
  endBeforeStart: (draft) =>
    `O término precisa ser depois do início (${describeStart(draft)}).`,
  salesAfterStart: (draft) =>
    `As vendas precisam começar antes do evento (${describeStart(draft)}).`,
};

const CATEGORY_LIST = EVENT_CATEGORIES.join(', ');

function ticketTypeQuestion(ticketType: AssistantTicketTypeDto): string {
  if (ticketType.price === null && ticketType.quantity === null) {
    return `Quanto custa e quantos ingressos tem o lote "${ticketType.batch}"?`;
  }
  if (ticketType.price === null) {
    return `Quanto custa o ingresso do lote "${ticketType.batch}"?`;
  }
  return `Quantos ingressos tem o lote "${ticketType.batch}"?`;
}

export function questionText(
  draft: AssistantDraftDto,
  field: AssistantField,
): string {
  switch (field) {
    case 'name':
      return 'Qual é o nome do evento?';
    case 'start':
      return draft.startDate
        ? `Que horas o evento começa no dia ${formatDate(draft.startDate)}?`
        : 'Em que dia e a que horas o evento começa?';
    case 'end':
      return draft.endDate
        ? `Que horas o evento termina no dia ${formatDate(draft.endDate)}?`
        : 'Quando o evento termina? Pode dizer só o horário, se acabar no mesmo dia.';
    case 'venue':
      if (draft.venue?.name && !draft.venue.city) {
        return `Em que cidade fica o ${draft.venue.name}?`;
      }
      if (draft.venue?.city && !draft.venue.name) {
        return `Qual é o nome do local em ${draft.venue.city}?`;
      }
      return 'Onde vai ser o evento? Diga o nome do local e a cidade.';
    case 'ticketTypes': {
      const incomplete = draft.ticketTypes.find(
        (ticketType) => !isTicketTypeComplete(ticketType),
      );
      return incomplete
        ? ticketTypeQuestion(incomplete)
        : 'Quais lotes ou tipos de ingresso você vai vender? Diga o nome, o preço e quantos ingressos tem cada um.';
    }
    case 'salesStart':
      return draft.salesStartDate
        ? `A que horas as vendas abrem no dia ${formatDate(draft.salesStartDate)}?`
        : 'Quando começam as vendas dos ingressos?';
    case 'category':
      return `Que tipo de evento é? As opções são: ${CATEGORY_LIST}.`;
    case 'ageRating':
      return 'Qual é a classificação indicativa? Livre, 10, 12, 14, 16 ou 18 anos?';
    case 'description':
      return 'Para a descrição de divulgação, conte um pouco da programação, das atrações ou do clima do evento.';
  }
}

export function nextQuestion(
  draft: AssistantDraftDto,
  notices: AssistantNotices,
): AssistantQuestionDto | null {
  const skipped = new Set(draft.skipped);
  const field = ASSISTANT_FIELDS.find(
    (candidate) =>
      !isComplete(draft, candidate) &&
      (isRequired(candidate) || !skipped.has(candidate)),
  );
  if (!field) return null;

  const notice = notices[field];
  const text = questionText(draft, field);
  return {
    field,
    text: notice ? `${NOTICE_TEXT[notice](draft)} ${text}` : text,
    skippable: !isRequired(field),
  };
}
