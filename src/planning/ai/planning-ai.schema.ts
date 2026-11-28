import { expenseGroup } from '../../database/schema';
import {
  REVIEW_ACTION_TYPES,
  REVIEW_SEVERITIES,
} from './dto/planning-review.dto';

type JsonSchema = Record<string, unknown>;

const expenseSuggestionSchema: JsonSchema = {
  type: 'object',
  properties: {
    description: { type: 'string' },
    group: { type: 'string', enum: expenseGroup.enumValues },
    category: { type: 'string' },
    quantity: { type: 'number' },
    unitPrice: { type: 'number' },
    notes: { type: 'string' },
    reason: { type: 'string' },
  },
  required: [
    'description',
    'group',
    'category',
    'quantity',
    'unitPrice',
    'notes',
    'reason',
  ],
  additionalProperties: false,
};

export const EXPENSE_SUGGESTIONS_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    suggestions: { type: 'array', items: expenseSuggestionSchema },
  },
  required: ['suggestions'],
  additionalProperties: false,
};

const reviewActionSchema: JsonSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: REVIEW_ACTION_TYPES },
    expenseId: { type: 'string' },
  },
  required: ['type', 'expenseId'],
  additionalProperties: false,
};

const reviewInsightSchema: JsonSchema = {
  type: 'object',
  properties: {
    severity: { type: 'string', enum: REVIEW_SEVERITIES },
    title: { type: 'string' },
    detail: { type: 'string' },
    action: { anyOf: [reviewActionSchema, { type: 'null' }] },
  },
  required: ['severity', 'title', 'detail', 'action'],
  additionalProperties: false,
};

export const PLANNING_REVIEW_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    insights: { type: 'array', items: reviewInsightSchema },
  },
  required: ['insights'],
  additionalProperties: false,
};
