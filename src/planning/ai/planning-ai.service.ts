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
import { EXPENSE_SUGGESTIONS_SCHEMA } from './planning-ai.schema';

export const MAX_EXPENSE_SUGGESTIONS = 30;

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
}
