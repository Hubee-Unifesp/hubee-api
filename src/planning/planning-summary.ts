import type {
  ExpenseGroup,
  ExpensePaymentStatus,
  TicketTypeModality,
} from '../database/schema';

/**
 * Cálculo do resumo financeiro e do break-even do planejamento do evento
 * (GOL-297). Função pura, com a mesma regra da aba "Geral" da planilha de
 * planejamento e do protótipo do front (`planejamento.data.ts`): o front
 * repete a conta localmente para a simulação responder ao arrastar a régua.
 *
 * Valores monetários são somados em centavos inteiros para não acumular erro
 * de ponto flutuante, e só são arredondados para 2 casas na saída.
 *
 * Lotes e público:
 * - Só os lotes `inteira` formam a fila de venda (os degraus da planilha). O
 *   público acima do planejado entra no último lote da fila; abaixo, sai dos
 *   últimos lotes da fila primeiro.
 * - `meia`, `estudante`, `vip` e `cortesia` são cotas vendidas em paralelo:
 *   entram com a quantidade planejada (limitada ao público) e só perdem
 *   público depois que a fila esvazia. Assim uma cortesia de R$ 0 não
 *   "consome" os primeiros ingressos da fila.
 * - Sem nenhum lote `inteira`, todos os lotes viram a fila.
 *
 * A API é a fonte de verdade: o front repete esta conta só para a simulação da
 * régua e recarrega o resumo da API ao abrir a página e depois de cada
 * alteração. Por isso cada lote sai com `modality` e `quantity`.
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
  modality: TicketTypeModality;
  salesStartDate: Date | null;
  /** Desempata lotes com o mesmo início de vendas. */
  salesEndDate?: Date | null;
  /** Ordem de cadastro, último desempate antes do `id`. */
  createdAt?: Date;
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
  quantity: number;
  modality: TicketTypeModality;
  /** `true` para lote da fila de venda; `false` para cota paralela. */
  sequential: boolean;
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

/** Data como número para ordenar; sem data vai para o fim. */
const timeOrLast = (date: Date | null | undefined) =>
  date?.getTime() ?? Number.POSITIVE_INFINITY;

/**
 * Ordem de venda dos lotes: data de início de vendas, data de fim de vendas
 * (lote sem data segue a janela do evento e fica depois dos datados), preço
 * (regra da planilha), ordem de cadastro e, por fim, `id` para a ordem ser
 * estável.
 */
export function sortLotsBySalesOrder<T extends PlanningLotInput>(
  lots: readonly T[],
): T[] {
  const byTime = (a: Date | null | undefined, b: Date | null | undefined) => {
    const aTime = timeOrLast(a);
    const bTime = timeOrLast(b);
    return aTime === bTime ? 0 : aTime < bTime ? -1 : 1;
  };

  return [...lots].sort(
    (a, b) =>
      byTime(a.salesStartDate, b.salesStartDate) ||
      byTime(a.salesEndDate, b.salesEndDate) ||
      a.price - b.price ||
      byTime(a.createdAt, b.createdAt) ||
      a.id.localeCompare(b.id),
  );
}

/** Modalidade que forma a fila de venda; as demais são cotas paralelas. */
export const SEQUENTIAL_MODALITY: TicketTypeModality = 'inteira';

/**
 * Lotes do evento separados em fila de venda e cotas paralelas, cada grupo na
 * ordem de venda.
 */
export interface PlanningLotPlan {
  queue: PlanningLotInput[];
  parallel: PlanningLotInput[];
}

export function planLots(lots: readonly PlanningLotInput[]): PlanningLotPlan {
  const sorted = sortLotsBySalesOrder(lots);
  const queue = sorted.filter((lot) => lot.modality === SEQUENTIAL_MODALITY);
  if (queue.length === 0) return { queue: sorted, parallel: [] };
  return {
    queue,
    parallel: sorted.filter((lot) => lot.modality !== SEQUENTIAL_MODALITY),
  };
}

/** Lotes na ordem da resposta: a fila de venda e depois as cotas paralelas. */
const orderedLots = (plan: PlanningLotPlan) => [
  ...plan.queue,
  ...plan.parallel,
];

const plannedQuantity = (lot: PlanningLotInput) => Math.max(0, lot.quantity);

/**
 * Quantos ingressos de cada lote saem para um público, na ordem de
 * `orderedLots`: as cotas paralelas ficam com a quantidade planejada, e o
 * restante enche a fila na ordem de venda, com o excedente no último lote.
 */
export function allocateAudience(
  plan: PlanningLotPlan,
  audience: number,
): number[] {
  let remaining = Math.max(0, audience);
  const take = (lot: PlanningLotInput) => {
    const taken = Math.min(plannedQuantity(lot), remaining);
    remaining -= taken;
    return taken;
  };

  const parallel = plan.parallel.map(take);
  const queue = plan.queue.map(take);
  if (remaining > 0 && queue.length > 0) queue[queue.length - 1] += remaining;

  return [...queue, ...parallel];
}

/**
 * Lote em que sai o ingresso do empate: o primeiro em que a receita acumulada
 * cobre as despesas. As cotas paralelas entram antes (são vendidas junto com
 * a fila) e a fila segue na ordem de venda, com o último lote absorvendo o
 * público acima do planejado. Sem despesas, nenhum ingresso é preciso.
 */
function breakEvenLot(
  plan: PlanningLotPlan,
  expensesTotalCents: number,
): PlanningLotInput | null {
  if (expensesTotalCents <= 0) return null;

  let revenueCents = 0;
  for (const lot of [...plan.parallel, ...plan.queue]) {
    revenueCents += toCents(lot.price) * plannedQuantity(lot);
    if (revenueCents >= expensesTotalCents) return lot;
  }

  const last = plan.queue.at(-1);
  return last && last.price > 0 ? last : null;
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
  plan: PlanningLotPlan,
  expensesTotalCents: number,
  audience: number | null,
): PlanningResult {
  if (audience === null || audience <= 0) return emptyResult(audience);

  const costPerPerson = round2(fromCents(expensesTotalCents) / audience);
  const lots = orderedLots(plan);
  if (lots.length === 0) {
    return { ...emptyResult(audience), costPerPerson };
  }

  const allocation = allocateAudience(plan, audience);
  const revenueCents = lots.reduce(
    (sum, lot, index) => sum + toCents(lot.price) * allocation[index],
    0,
  );
  const averageTicket = fromCents(revenueCents) / audience;
  const breakEven =
    averageTicket > 0 ? fromCents(expensesTotalCents) / averageTicket : null;

  return {
    audience,
    revenue: fromCents(revenueCents),
    averageTicket: round2(averageTicket),
    breakEven: breakEven !== null ? round2(breakEven) : null,
    costPerPerson,
    profit: fromCents(revenueCents - expensesTotalCents),
    breakEvenBatch:
      breakEven !== null
        ? (breakEvenLot(plan, expensesTotalCents)?.batch ?? null)
        : null,
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
  plan: PlanningLotPlan,
  audience: number | null,
): PlanningLotRange[] {
  const lots = orderedLots(plan);
  const allocation =
    audience !== null && audience > 0
      ? allocateAudience(plan, audience)
      : lots.map(() => 0);

  let sold = 0;
  return lots.map((lot, index) => {
    const taken = allocation[index];
    const range = {
      id: lot.id,
      batch: lot.batch,
      price: lot.price,
      quantity: lot.quantity,
      modality: lot.modality,
      sequential: index < plan.queue.length,
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
  const plan = planLots(input.lots);
  const { totalCents, expenses, byCategory, pending } = summarizeExpenses(
    input.expenses,
  );
  const audience = input.audience;

  const scenarios =
    audience !== null && audience > 0
      ? PLANNING_SCENARIO_DELTAS.map((delta) => audience + delta)
          .filter((value) => value > 0)
          .map((value) => calculatePlanningResult(plan, totalCents, value))
      : [];

  return {
    expenses,
    byCategory,
    pending,
    tickets: {
      planned: input.lots.reduce((sum, lot) => sum + plannedQuantity(lot), 0),
      lots: ticketRanges(plan, audience),
    },
    result: calculatePlanningResult(plan, totalCents, audience),
    scenarios,
  };
}
