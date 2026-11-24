import {
  EVENT_CATEGORIES,
  eventAgeRating,
  ticketTypeModality,
} from '../../database/schema';

type JsonSchema = Record<string, unknown>;

const nullable = (schema: JsonSchema): JsonSchema => ({
  anyOf: [schema, { type: 'null' }],
});

const nullableString = nullable({ type: 'string' });

const venueSchema: JsonSchema = {
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

const ticketTypeSchema: JsonSchema = {
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

export const EVENT_AI_ASSISTANT_PATCH_FIELDS = [
  'name',
  'description',
  'category',
  'ageRating',
  'edition',
  'startDate',
  'startTime',
  'endDate',
  'endTime',
  'salesStartDate',
  'salesStartTime',
  'venue',
  'ticketTypes',
] as const;

export const EVENT_AI_ASSISTANT_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    name: nullableString,
    description: nullableString,
    category: nullable({ type: 'string', enum: [...EVENT_CATEGORIES] }),
    ageRating: nullable({ type: 'string', enum: eventAgeRating.enumValues }),
    edition: nullableString,
    startDate: nullableString,
    startTime: nullableString,
    endDate: nullableString,
    endTime: nullableString,
    salesStartDate: nullableString,
    salesStartTime: nullableString,
    venue: nullable(venueSchema),
    ticketTypes: nullable({ type: 'array', items: ticketTypeSchema }),
    declined: { type: 'boolean' },
    reply: { type: 'string' },
  },
  required: [...EVENT_AI_ASSISTANT_PATCH_FIELDS, 'declined', 'reply'],
  additionalProperties: false,
};
