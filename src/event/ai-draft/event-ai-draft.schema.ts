import {
  EVENT_CATEGORIES,
  eventAgeRating,
  ticketTypeModality,
} from '../../database/schema';
import { EVENT_AI_DRAFT_FIELDS } from '../dto/event-ai-draft-response.dto';

type JsonSchema = Record<string, unknown>;

const nullable = (schema: JsonSchema): JsonSchema => ({
  anyOf: [schema, { type: 'null' }],
});

const nullableString = nullable({ type: 'string' });
const nullableDate: JsonSchema = {
  anyOf: [
    { type: 'string', format: 'date-time' },
    { type: 'string', format: 'date' },
    { type: 'null' },
  ],
};

const venueSuggestionSchema: JsonSchema = {
  type: 'object',
  properties: {
    name: nullableString,
    address: nullableString,
    city: nullableString,
    state: nullableString,
  },
  required: ['name', 'address', 'city', 'state'],
  additionalProperties: false,
};

const suggestedTicketTypeSchema: JsonSchema = {
  type: 'object',
  properties: {
    batch: { type: 'string' },
    price: nullable({ type: 'number' }),
    quantity: nullable({ type: 'integer' }),
    modality: nullable({ type: 'string', enum: ticketTypeModality.enumValues }),
  },
  required: ['batch', 'price', 'quantity', 'modality'],
  additionalProperties: false,
};

export const EVENT_AI_DRAFT_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    name: nullableString,
    description: nullableString,
    category: nullable({ type: 'string', enum: [...EVENT_CATEGORIES] }),
    ageRating: nullable({ type: 'string', enum: eventAgeRating.enumValues }),
    edition: nullableString,
    startDate: nullableDate,
    endDate: nullableDate,
    salesStartDate: nullableDate,
    venueSuggestion: nullable(venueSuggestionSchema),
    suggestedTicketTypes: { type: 'array', items: suggestedTicketTypeSchema },
    missingFields: {
      type: 'array',
      items: { type: 'string', enum: [...EVENT_AI_DRAFT_FIELDS] },
    },
  },
  required: [...EVENT_AI_DRAFT_FIELDS, 'missingFields'],
  additionalProperties: false,
};
