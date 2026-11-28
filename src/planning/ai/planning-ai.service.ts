import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiService } from '../../ai/ai.service';
import { toResponse } from '../../common/serialization/to-response';
import { expenseGroup, type ExpenseGroup } from '../../database/schema';
import { MAX_EXPENSE_AMOUNT } from '../../expenses/dto/create-expense.dto';
import { PlanningRepository } from '../planning.repository';
import {
  ExpenseSuggestionsResponseDto,
  type ExpenseSuggestionDto,
} from './dto/expense-suggestions.dto';
import {
  buildExpenseSuggestionsPrompt,
  eventCategories,
  EXPENSE_SUGGESTIONS_SYSTEM_PROMPT,
  normalizeText,
} from './planning-ai.prompt';
import {
  EXPENSE_SUGGESTIONS_SCHEMA,
  PLANNING_REVIEW_SCHEMA,
} from './planning-ai.schema';
import {
  PlanningReviewResponseDto,
  REVIEW_ACTION_TYPES,
  REVIEW_SEVERITIES,
  type ReviewActionType,
  type ReviewInsightDto,
  type ReviewSeverity,
} from './dto/planning-review.dto';
import {
  calculatePlanningReviewFacts,
  type PlanningReviewFacts,
} from './planning-review-facts';
import {
  buildPlanningReviewPrompt,
  formatPeople,
  PLANNING_REVIEW_MAX_INSIGHTS,
  PLANNING_REVIEW_SYSTEM_PROMPT,
} from './planning-review.prompt';

export const MAX_EXPENSE_SUGGESTIONS = 30;

const INVALID_REVIEW_MESSAGE =
  'Não foi possível analisar o planejamento com IA. Tente novamente em instantes.';

const INVALID_SUGGESTIONS_MESSAGE =
  'Não foi possível gerar sugestões com IA. Tente novamente em instantes.';

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = Array.from(value.trim()).slice(0, maxLength).join('').trim();
  return trimmed === '' ? null : trimmed;
}

function money(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Valida a saída da IA: descarta itens com grupo fora do enum, descrição ou
 * categoria vazia, quantidade ou valor negativos (ou total acima do limite da
 * despesa) e itens que repetem uma despesa cadastrada ou outra sugestão.
 * Categorias iguais às já usadas no evento ganham a grafia do evento.
 */
export function sanitizeExpenseSuggestions(
  raw: unknown,
  existing: { description: string; category: string }[],
): { suggestions: ExpenseSuggestionDto[]; dropped: number } {
  const items = isPlainObject(raw) ? raw.suggestions : undefined;
  if (!Array.isArray(items)) {
    throw new ServiceUnavailableException(INVALID_SUGGESTIONS_MESSAGE);
  }

  const categoryByKey = new Map(
    eventCategories(existing).map((category) => [
      normalizeText(category),
      category,
    ]),
  );
  const seen = new Set(
    existing.map((expense) => normalizeText(expense.description)),
  );
  const suggestions: ExpenseSuggestionDto[] = [];
  let dropped = 0;

  for (const item of items) {
    const suggestion = isPlainObject(item) ? toSuggestion(item) : null;
    const key = suggestion ? normalizeText(suggestion.description) : '';
    if (!suggestion || !key || seen.has(key)) {
      dropped += 1;
      continue;
    }
    if (suggestions.length >= MAX_EXPENSE_SUGGESTIONS) {
      dropped += 1;
      continue;
    }
    seen.add(key);
    suggestion.category =
      categoryByKey.get(normalizeText(suggestion.category)) ??
      suggestion.category;
    suggestions.push(suggestion);
  }

  return { suggestions, dropped };
}

function toSuggestion(item: PlainObject): ExpenseSuggestionDto | null {
  const description = text(item.description, 500);
  const category = text(item.category, 100);
  const group = expenseGroup.enumValues.includes(item.group as ExpenseGroup)
    ? (item.group as ExpenseGroup)
    : null;
  const quantity = money(item.quantity);
  const unitPrice = money(item.unitPrice);

  if (!description || !category || !group) return null;
  if (quantity === null || quantity <= 0) return null;
  if (unitPrice === null || unitPrice < 0) return null;
  if (quantity * unitPrice > MAX_EXPENSE_AMOUNT) return null;

  return {
    description,
    group,
    category,
    quantity,
    unitPrice,
    notes: text(item.notes, 1000),
    reason: text(item.reason, 300) ?? '',
  };
}

const SEVERITY_ORDER: Record<ReviewSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

function toInsight(
  item: PlainObject,
  expenseIds: ReadonlySet<string>,
): ReviewInsightDto | null {
  const severity = REVIEW_SEVERITIES.includes(item.severity as ReviewSeverity)
    ? (item.severity as ReviewSeverity)
    : null;
  const title = text(item.title, 120);
  const detail = text(item.detail, 600);
  if (!severity || !title || !detail) return null;
  return { severity, title, detail, action: toAction(item.action, expenseIds) };
}

function toAction(
  raw: unknown,
  expenseIds: ReadonlySet<string>,
): ReviewInsightDto['action'] {
  if (!isPlainObject(raw)) return null;
  const type = REVIEW_ACTION_TYPES.includes(raw.type as ReviewActionType)
    ? (raw.type as ReviewActionType)
    : null;
  if (!type) return null;
  const candidate =
    typeof raw.expenseId === 'string' ? raw.expenseId.trim() : '';
  const expenseId = expenseIds.has(candidate) ? candidate : null;
  if (type === 'edit_expense' && !expenseId) return null;
  return { type, expenseId: type === 'edit_expense' ? expenseId : null };
}

/** Alerta garantido pelo código quando o break-even passa do público esperado. */
export function breakEvenInsight(
  facts: PlanningReviewFacts,
): ReviewInsightDto | null {
  const { breakEven } = facts.result;
  if (
    !facts.breakEvenAboveExpectedAudience ||
    breakEven === null ||
    facts.expectedAudience === null
  ) {
    return null;
  }
  return {
    severity: 'critical',
    title: 'Ponto de equilíbrio acima do público esperado',
    detail: `O evento precisa de ${formatPeople(breakEven)} pagantes para cobrir as despesas, e o público esperado é de ${formatPeople(facts.expectedAudience)}. Revise os lotes, os preços ou as despesas.`,
    action: { type: 'edit_lots', expenseId: null },
  };
}

/**
 * Valida a saída da IA na análise: descarta alertas sem severidade, título ou
 * detalhe, ações de tipo desconhecido e `expenseId` que não é do evento.
 * Ordena por severidade, garante o alerta crítico de break-even e limita a 6.
 */
export function sanitizePlanningReview(
  raw: unknown,
  facts: PlanningReviewFacts,
  expenseIds: ReadonlySet<string>,
): ReviewInsightDto[] {
  const items = isPlainObject(raw) ? raw.insights : undefined;
  if (!Array.isArray(items)) {
    throw new ServiceUnavailableException(INVALID_REVIEW_MESSAGE);
  }

  const insights = items
    .map((item) => (isPlainObject(item) ? toInsight(item, expenseIds) : null))
    .filter((item): item is ReviewInsightDto => item !== null)
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const guaranteed = breakEvenInsight(facts);
  if (guaranteed && !insights.some((item) => item.severity === 'critical')) {
    insights.unshift(guaranteed);
  }

  return insights.slice(0, PLANNING_REVIEW_MAX_INSIGHTS);
}

@Injectable()
export class PlanningAiService {
  private readonly logger = new Logger(PlanningAiService.name);

  constructor(
    private readonly ai: AiService,
    private readonly planningRepository: PlanningRepository,
  ) {}

  async suggestExpenses(
    eventId: string,
    notes?: string,
  ): Promise<ExpenseSuggestionsResponseDto> {
    const event = await this.planningRepository.findAiEventContext(eventId);
    if (!event) {
      throw new NotFoundException(`Evento ${eventId} não encontrado`);
    }
    const [lots, expenses] = await Promise.all([
      this.planningRepository.findLots(eventId),
      this.planningRepository.findExpenseItems(eventId),
    ]);

    const raw = await this.ai.generateStructured({
      system: EXPENSE_SUGGESTIONS_SYSTEM_PROMPT,
      prompt: buildExpenseSuggestionsPrompt({ event, lots, expenses, notes }),
      schema: EXPENSE_SUGGESTIONS_SCHEMA,
      maxTokens: 6000,
      feature: 'planning-expense-suggestions',
    });

    let result: ReturnType<typeof sanitizeExpenseSuggestions>;
    try {
      result = sanitizeExpenseSuggestions(raw, expenses);
    } catch (error) {
      this.logger.error('Resposta da IA de sugestão de despesas inválida');
      throw error;
    }
    if (result.dropped > 0) {
      this.logger.warn(
        `Sugestões de despesas descartadas da resposta da IA: ${result.dropped}`,
      );
    }

    return toResponse(ExpenseSuggestionsResponseDto, {
      suggestions: result.suggestions,
    });
  }

  async reviewPlanning(
    eventId: string,
    now: Date = new Date(),
  ): Promise<PlanningReviewResponseDto> {
    const event = await this.planningRepository.findAiEventContext(eventId);
    if (!event) {
      throw new NotFoundException(`Evento ${eventId} não encontrado`);
    }
    const [expenses, installments, lots] = await Promise.all([
      this.planningRepository.findReviewExpenses(eventId),
      this.planningRepository.findReviewInstallments(eventId),
      this.planningRepository.findLots(eventId),
    ]);

    const facts = calculatePlanningReviewFacts({
      startDate: event.startDate,
      expectedAudience: event.expectedAudience,
      expenses,
      installments,
      lots,
      now,
    });

    const raw = await this.ai.generateStructured({
      system: PLANNING_REVIEW_SYSTEM_PROMPT,
      prompt: buildPlanningReviewPrompt(facts),
      schema: PLANNING_REVIEW_SCHEMA,
      maxTokens: 3000,
      feature: 'planning-review',
    });

    let insights: ReviewInsightDto[];
    try {
      insights = sanitizePlanningReview(
        raw,
        facts,
        new Set(expenses.map((expense) => expense.id)),
      );
    } catch (error) {
      this.logger.error('Resposta da IA de análise do planejamento inválida');
      throw error;
    }

    return toResponse(PlanningReviewResponseDto, {
      insights,
      generatedAt: now,
    });
  }
}
