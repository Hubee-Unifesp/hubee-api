import type { ExpenseGroup, ExpensePaymentStatus } from '../../database/schema';
import {
  calculatePlanningSummary,
  type PlanningExpenseInput,
  type PlanningLotInput,
  type PlanningResult,
} from '../planning-summary';
import { PLANNING_AI_TIME_ZONE } from './planning-ai.prompt';

/**
 * Fatos da análise do planejamento (GOL-307), calculados no código e sem IA.
 * A IA só recebe estes fatos para redigir os alertas: todo número citado na
 * análise sai daqui ou do resumo financeiro (GOL-297).
 */

export interface ReviewExpenseInput extends PlanningExpenseInput {
  id: string;
  description: string;
  dueDate: Date | null;
}

export interface ReviewInstallmentInput {
  expenseId: string;
  amount: number;
  dueDate: Date;
  status: ExpensePaymentStatus;
}

export interface PlanningReviewInput {
  startDate: Date;
  expectedAudience: number | null;
  expenses: ReviewExpenseInput[];
  installments: ReviewInstallmentInput[];
  lots: PlanningLotInput[];
  now: Date;
}

export interface ReviewExpenseItem {
  id: string;
  description: string;
  category: string;
  amount: number;
}

export interface ReviewOverdueItem extends ReviewExpenseItem {
  /** Data mais antiga vencida (da despesa ou de uma parcela). */
  dueDate: Date;
  overdueAmount: number;
}

export interface ReviewCategoryShare {
  category: string;
  group: ExpenseGroup;
  total: number;
  /** Fração do total de despesas, de 0 a 1, com 4 casas. */
  share: number;
}

export interface PlanningReviewFacts {
  daysUntilEvent: number;
  expectedAudience: number | null;
  plannedTickets: number;
  expenses: {
    total: number;
    byGroup: Record<ExpenseGroup, number>;
    paidTotal: number;
    pendingTotal: number;
    itemCount: number;
  };
  /** Resultado com o público esperado (todos `null` sem público). */
  result: PlanningResult;
  /** Resultado vendendo todos os ingressos planejados nos lotes. */
  resultAtPlannedTickets: PlanningResult;
  breakEvenAboveExpectedAudience: boolean;
  breakEvenAbovePlannedTickets: boolean;
  notQuoted: { count: number; total: number; items: ReviewExpenseItem[] };
  overdue: { count: number; total: number; items: ReviewOverdueItem[] };
  topCategories: ReviewCategoryShare[];
}

export const REVIEW_MAX_ITEMS = 10;
export const REVIEW_TOP_CATEGORIES = 3;

const toCents = (value: number) => Math.round(value * 100);
const fromCents = (cents: number) => cents / 100;

const localDay = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: PLANNING_AI_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

/** Dias de calendário entre hoje e o início do evento, no fuso do evento. */
export function daysBetween(now: Date, target: Date): number {
  const from = Date.parse(`${localDay(now)}T00:00:00Z`);
  const to = Date.parse(`${localDay(target)}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

const isBefore = (date: Date, now: Date) => localDay(date) < localDay(now);

const byAmountDesc = <T extends { amount: number; description: string }>(
  a: T,
  b: T,
) => b.amount - a.amount || a.description.localeCompare(b.description, 'pt');

function overdueItems(
  active: ReviewExpenseInput[],
  installments: ReviewInstallmentInput[],
  now: Date,
): ReviewOverdueItem[] {
  const installmentsByExpense = new Map<string, ReviewInstallmentInput[]>();
  for (const installment of installments) {
    const list = installmentsByExpense.get(installment.expenseId) ?? [];
    list.push(installment);
    installmentsByExpense.set(installment.expenseId, list);
  }

  return active.flatMap((expense) => {
    if (expense.paymentStatus === 'pago' || expense.amount <= 0) return [];
    const own = installmentsByExpense.get(expense.id);

    if (own && own.length > 0) {
      const late = own.filter(
        (item) =>
          item.status === 'atrasado' ||
          (item.status === 'pendente' && isBefore(item.dueDate, now)),
      );
      if (late.length === 0) return [];
      const dueDate = late.reduce(
        (oldest, item) => (item.dueDate < oldest ? item.dueDate : oldest),
        late[0].dueDate,
      );
      const cents = late.reduce((sum, item) => sum + toCents(item.amount), 0);
      return [toOverdue(expense, dueDate, fromCents(cents))];
    }

    const late =
      expense.paymentStatus === 'atrasado' ||
      (expense.dueDate !== null && isBefore(expense.dueDate, now));
    if (!late) return [];
    return [toOverdue(expense, expense.dueDate ?? now, expense.amount)];
  });
}

const toItem = (expense: ReviewExpenseInput): ReviewExpenseItem => ({
  id: expense.id,
  description: expense.description,
  category: expense.category,
  amount: expense.amount,
});

const toOverdue = (
  expense: ReviewExpenseInput,
  dueDate: Date,
  overdueAmount: number,
): ReviewOverdueItem => ({ ...toItem(expense), dueDate, overdueAmount });

export function calculatePlanningReviewFacts(
  input: PlanningReviewInput,
): PlanningReviewFacts {
  const summary = calculatePlanningSummary({
    expenses: input.expenses,
    lots: input.lots,
    audience: input.expectedAudience,
  });
  const plannedTickets = summary.tickets.planned;
  const atPlanned = calculatePlanningSummary({
    expenses: input.expenses,
    lots: input.lots,
    audience: plannedTickets > 0 ? plannedTickets : null,
  }).result;

  const active = input.expenses.filter(
    (expense) => expense.paymentStatus !== 'cancelado',
  );
  const notQuoted = active.filter((expense) => !expense.quoted);
  const overdue = overdueItems(active, input.installments, input.now);
  const totalCents = toCents(summary.expenses.total);

  const breakEven = summary.result.breakEven;
  const breakEvenAtPlanned = atPlanned.breakEven;

  return {
    daysUntilEvent: daysBetween(input.now, input.startDate),
    expectedAudience: input.expectedAudience,
    plannedTickets,
    expenses: {
      total: summary.expenses.total,
      byGroup: summary.expenses.byGroup,
      paidTotal: summary.expenses.paidTotal,
      pendingTotal: summary.expenses.pendingTotal,
      itemCount: summary.expenses.itemCount,
    },
    result: summary.result,
    resultAtPlannedTickets: atPlanned,
    breakEvenAboveExpectedAudience:
      breakEven !== null &&
      input.expectedAudience !== null &&
      breakEven > input.expectedAudience,
    breakEvenAbovePlannedTickets:
      breakEvenAtPlanned !== null &&
      plannedTickets > 0 &&
      breakEvenAtPlanned > plannedTickets,
    notQuoted: {
      count: notQuoted.length,
      total: fromCents(
        notQuoted.reduce((sum, expense) => sum + toCents(expense.amount), 0),
      ),
      items: notQuoted
        .map(toItem)
        .sort(byAmountDesc)
        .slice(0, REVIEW_MAX_ITEMS),
    },
    overdue: {
      count: overdue.length,
      total: fromCents(
        overdue.reduce((sum, item) => sum + toCents(item.overdueAmount), 0),
      ),
      items: overdue.sort(byAmountDesc).slice(0, REVIEW_MAX_ITEMS),
    },
    topCategories: summary.byCategory
      .filter((category) => category.total > 0)
      .slice(0, REVIEW_TOP_CATEGORIES)
      .map((category) => ({
        ...category,
        share:
          totalCents > 0
            ? Math.round((toCents(category.total) / totalCents) * 10_000) /
              10_000
            : 0,
      })),
  };
}
