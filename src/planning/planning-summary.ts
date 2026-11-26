import type { ExpenseGroup, ExpensePaymentStatus } from '../database/schema';

/**
 * Cálculo do resumo financeiro e do break-even do planejamento do evento
 * (GOL-297). Função pura, com a mesma regra da aba "Geral" da planilha de
 * planejamento e do protótipo do front (`planejamento.data.ts`): o front
 * repete a conta localmente para a simulação responder ao arrastar a régua.
 *
 * Valores monetários são somados em centavos inteiros para não acumular erro
 * de ponto flutuante, e só são arredondados para 2 casas na saída.
 */

export interface PlanningExpenseInput {
  group: ExpenseGroup;
  category: string;
  amount: number;
  quoted: boolean;
  paymentStatus: ExpensePaymentStatus;
}

export interface PlanningLotInput {
  id: string;
  batch: string;
  price: number;
  quantity: number;
  salesStartDate: Date | null;
}

export interface PlanningSummaryInput {
  expenses: PlanningExpenseInput[];
  lots: PlanningLotInput[];
  /** Público pedido (`?audience=`) ou o público esperado do evento. */
  audience: number | null;
}

export interface PlanningExpensesSummary {
  total: number;
  byGroup: Record<ExpenseGroup, number>;
  paidTotal: number;
  pendingTotal: number;
  itemCount: number;
  quotedCount: number;
}

export interface PlanningCategoryTotal {
  category: string;
  group: ExpenseGroup;
  total: number;
}

export interface PlanningPendingSummary {
  toPay: number;
  notQuoted: number;
}

export interface PlanningLotRange {
  id: string;
  batch: string;
  price: number;
  /** Primeiro ingresso do público pedido vendido neste lote (1-based). */
  start: number | null;
  /** Último ingresso do público pedido vendido neste lote. */
  end: number | null;
}

export interface PlanningTicketsSummary {
  planned: number;
  lots: PlanningLotRange[];
}

export interface PlanningResult {
  audience: number | null;
  revenue: number | null;
  averageTicket: number | null;
  breakEven: number | null;
  costPerPerson: number | null;
  profit: number | null;
  breakEvenBatch: string | null;
}

export interface PlanningSummary {
  expenses: PlanningExpensesSummary;
  byCategory: PlanningCategoryTotal[];
  pending: PlanningPendingSummary;
  tickets: PlanningTicketsSummary;
  result: PlanningResult;
  scenarios: PlanningResult[];
}

/** Variações de público (em pessoas) simuladas a partir do público pedido. */
export const PLANNING_SCENARIO_DELTAS = [-40, -20, 0, 20, 40] as const;

const toCents = (value: number) => Math.round(value * 100);
const fromCents = (cents: number) => cents / 100;
const round2 = (value: number) =>
  Math.round((value + Math.sign(value) * Number.EPSILON) * 100) / 100;

/**
 * Ordem de venda dos lotes: data de início de vendas (lote sem data segue a
 * janela do evento e fica depois dos datados), depois preço e, por fim, `id`
 * para a ordem ser estável.
 */
export function sortLotsBySalesOrder<T extends PlanningLotInput>(
  lots: readonly T[],
): T[] {
  return [...lots].sort((a, b) => {
    const aStart = a.salesStartDate?.getTime() ?? Number.POSITIVE_INFINITY;
    const bStart = b.salesStartDate?.getTime() ?? Number.POSITIVE_INFINITY;
    if (aStart !== bStart) return aStart < bStart ? -1 : 1;
    if (a.price !== b.price) return a.price - b.price;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Quantos ingressos de cada lote saem para um público: os lotes enchem na
 * ordem de venda; abaixo do planejado, saem dos últimos lotes primeiro, e o
 * público acima do planejado entra no último lote.
 */
export function allocateAudience(
  sortedLots: readonly PlanningLotInput[],
  audience: number,
): number[] {
  let remaining = Math.max(0, audience);
  const allocation = sortedLots.map((lot) => {
    const taken = Math.min(Math.max(0, lot.quantity), remaining);
    remaining -= taken;
    return taken;
  });
  if (remaining > 0 && allocation.length > 0) {
    allocation[allocation.length - 1] += remaining;
  }
  return allocation;
}

/** Lote do ingresso de número `ticket` (1-based) na ordem de venda. */
function lotOfTicket(
  sortedLots: readonly PlanningLotInput[],
  ticket: number,
): PlanningLotInput | null {
  if (sortedLots.length === 0 || ticket < 1) return null;
  let sold = 0;
  for (const lot of sortedLots) {
    sold += Math.max(0, lot.quantity);
    if (ticket <= sold) return lot;
  }
  return sortedLots[sortedLots.length - 1];
}

function emptyResult(audience: number | null): PlanningResult {
  return {
    audience,
    revenue: null,
    averageTicket: null,
    breakEven: null,
    costPerPerson: null,
    profit: null,
    breakEvenBatch: null,
  };
}

/**
 * Resultado do evento para um público. As despesas não mudam com o público;
 * sem lotes, os campos que dependem da receita vêm `null`, e sem receita o
 * break-even também (sem divisão por zero).
 */
export function calculatePlanningResult(
  sortedLots: readonly PlanningLotInput[],
  expensesTotalCents: number,
  audience: number | null,
): PlanningResult {
  if (audience === null || audience <= 0) return emptyResult(audience);

  const costPerPerson = round2(fromCents(expensesTotalCents) / audience);
  if (sortedLots.length === 0) {
    return { ...emptyResult(audience), costPerPerson };
  }

  const allocation = allocateAudience(sortedLots, audience);
  const revenueCents = sortedLots.reduce(
    (sum, lot, index) => sum + toCents(lot.price) * allocation[index],
    0,
  );
  const averageTicket = fromCents(revenueCents) / audience;
  const breakEven =
    averageTicket > 0 ? fromCents(expensesTotalCents) / averageTicket : null;
  // Arredonda antes do teto para um 300,0000000001 de ponto flutuante não
  // virar o ingresso 301.
  const breakEvenTicket =
    breakEven !== null ? Math.ceil(Number(breakEven.toFixed(6))) : 0;

  return {
    audience,
    revenue: fromCents(revenueCents),
    averageTicket: round2(averageTicket),
    breakEven: breakEven !== null ? round2(breakEven) : null,
    costPerPerson,
    profit: fromCents(revenueCents - expensesTotalCents),
    breakEvenBatch: lotOfTicket(sortedLots, breakEvenTicket)?.batch ?? null,
  };
}

function summarizeExpenses(expenses: readonly PlanningExpenseInput[]) {
  const active = expenses.filter((item) => item.paymentStatus !== 'cancelado');

  const byGroupCents: Record<ExpenseGroup, number> = {
    fixed: 0,
    variable: 0,
    marketing: 0,
  };
  const byCategoryCents = new Map<string, PlanningCategoryTotal>();
  let totalCents = 0;
  let paidCents = 0;
  let quotedCount = 0;
  let toPay = 0;
  let notQuoted = 0;

  for (const item of active) {
    const cents = toCents(item.amount);
    totalCents += cents;
    byGroupCents[item.group] += cents;
    if (item.paymentStatus === 'pago') paidCents += cents;
    else if (cents > 0) toPay += 1;
    if (item.quoted) quotedCount += 1;
    else notQuoted += 1;

    const key = `${item.group}\u0000${item.category}`;
    const entry = byCategoryCents.get(key) ?? {
      category: item.category,
      group: item.group,
      total: 0,
    };
    entry.total += cents;
    byCategoryCents.set(key, entry);
  }

  const byCategory = [...byCategoryCents.values()]
    .map((entry) => ({ ...entry, total: fromCents(entry.total) }))
    .sort(
      (a, b) => b.total - a.total || a.category.localeCompare(b.category, 'pt'),
    );

  return {
    totalCents,
    expenses: {
      total: fromCents(totalCents),
      byGroup: {
        fixed: fromCents(byGroupCents.fixed),
        variable: fromCents(byGroupCents.variable),
        marketing: fromCents(byGroupCents.marketing),
      },
      paidTotal: fromCents(paidCents),
      pendingTotal: fromCents(totalCents - paidCents),
      itemCount: active.length,
      quotedCount,
    },
    byCategory,
    pending: { toPay, notQuoted },
  };
}

function ticketRanges(
  sortedLots: readonly PlanningLotInput[],
  audience: number | null,
): PlanningLotRange[] {
  const allocation =
    audience !== null && audience > 0
      ? allocateAudience(sortedLots, audience)
      : sortedLots.map(() => 0);

  let sold = 0;
  return sortedLots.map((lot, index) => {
    const taken = allocation[index];
    const range = {
      id: lot.id,
      batch: lot.batch,
      price: lot.price,
      start: taken > 0 ? sold + 1 : null,
      end: taken > 0 ? sold + taken : null,
    };
    sold += taken;
    return range;
  });
}

export function calculatePlanningSummary(
  input: PlanningSummaryInput,
): PlanningSummary {
  const sortedLots = sortLotsBySalesOrder(input.lots);
  const { totalCents, expenses, byCategory, pending } = summarizeExpenses(
    input.expenses,
  );
  const audience = input.audience;

  const scenarios =
    audience !== null && audience > 0
      ? PLANNING_SCENARIO_DELTAS.map((delta) => audience + delta)
          .filter((value) => value > 0)
          .map((value) =>
            calculatePlanningResult(sortedLots, totalCents, value),
          )
      : [];

  return {
    expenses,
    byCategory,
    pending,
    tickets: {
      planned: sortedLots.reduce(
        (sum, lot) => sum + Math.max(0, lot.quantity),
        0,
      ),
      lots: ticketRanges(sortedLots, audience),
    },
    result: calculatePlanningResult(sortedLots, totalCents, audience),
    scenarios,
  };
}
