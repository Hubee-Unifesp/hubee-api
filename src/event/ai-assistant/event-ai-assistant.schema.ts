import {
  EVENT_CATEGORIES,
  eventAgeRating,
  ticketTypeModality,
} from '../../database/schema';

type JsonSchema = Record<string, unknown>;

const nullable = (schema: JsonSchema): JsonSchema => ({
  anyOf: [schema, { type: 'null' }],
});

const text: JsonSchema = { type: 'string' };

const optionalEnum = (values: readonly string[]): JsonSchema => ({
  type: 'string',
  enum: ['', ...values],
});

const venueSchema: JsonSchema = {
  type: 'object',
  properties: {
    name: text,
    address: text,
    city: text,
    state: text,
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
    name: text,
    description: text,
    category: optionalEnum(EVENT_CATEGORIES),
    ageRating: optionalEnum(eventAgeRating.enumValues),
    edition: text,
    startDate: text,
    startTime: text,
    endDate: text,
    endTime: text,
    salesStartDate: text,
    salesStartTime: text,
    venue: nullable(venueSchema),
    ticketTypes: nullable({ type: 'array', items: ticketTypeSchema }),
    declined: { type: 'boolean' },
    reply: { type: 'string' },
  },
  required: [...EVENT_AI_ASSISTANT_PATCH_FIELDS, 'declined', 'reply'],
  additionalProperties: false,
};
