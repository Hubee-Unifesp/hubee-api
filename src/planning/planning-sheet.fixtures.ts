import type {
  PlanningExpenseInput,
  PlanningLotInput,
} from './planning-summary';

/** Dados da planilha de planejamento do Codeniver, usados nos testes. */
export const day = (n: number) => new Date(Date.UTC(2026, 9, n));

/** Lotes da planilha Codeniver: 10×45 + 30×48,33 + 40×50 + 85×50 + 105×55 + 30×60. */
export const SHEET_LOTS: PlanningLotInput[] = [
  // Fora de ordem de propósito: a função ordena por data de venda e preço.
  {
    id: 'l6',
    batch: '3º Lote',
    price: 60,
    quantity: 30,
    modality: 'inteira' as const,
    salesStartDate: day(6),
  },
  {
    id: 'l1',
    batch: 'Promocional',
    price: 45,
    quantity: 10,
    modality: 'inteira' as const,
    salesStartDate: day(1),
  },
  {
    id: 'l3',
    batch: 'Pré-venda 2',
    price: 50,
    quantity: 40,
    modality: 'inteira' as const,
    salesStartDate: day(3),
  },
  {
    id: 'l2',
    batch: 'Pré-venda 1',
    price: 48.33,
    quantity: 30,
    modality: 'inteira' as const,
    salesStartDate: day(2),
  },
  {
    id: 'l5',
    batch: '2º Lote',
    price: 55,
    quantity: 105,
    modality: 'inteira' as const,
    salesStartDate: day(5),
  },
  {
    id: 'l4',
    batch: '1º Lote',
    price: 50,
    quantity: 85,
    modality: 'inteira' as const,
    salesStartDate: day(4),
  },
];

export const expense = (
  overrides: Partial<PlanningExpenseInput> &
    Pick<PlanningExpenseInput, 'group' | 'category' | 'amount'>,
): PlanningExpenseInput => ({
  quoted: true,
  paymentStatus: 'pendente',
  ...overrides,
});

/** Despesas da planilha: fixas 10.010,00 + variáveis e marketing 5.493,94. */
export const SHEET_EXPENSES: PlanningExpenseInput[] = [
  expense({
    group: 'fixed',
    category: 'Estrutura',
    amount: 5000,
    paymentStatus: 'pago',
  }),
  expense({ group: 'fixed', category: 'Estrutura', amount: 3040 }),
  expense({ group: 'fixed', category: 'Staff', amount: 1970, quoted: false }),
  expense({
    group: 'variable',
    category: 'Open',
    amount: 4803.47,
    paymentStatus: 'atrasado',
  }),
  expense({
    group: 'marketing',
    category: 'MKT',
    amount: 690.47,
    quoted: false,
  }),
  expense({
    group: 'marketing',
    category: 'Brindes',
    amount: 0,
    quoted: false,
  }),
  // Cancelado fica fora de todos os totais e contagens.
  expense({
    group: 'fixed',
    category: 'Estrutura',
    amount: 9999,
    quoted: false,
    paymentStatus: 'cancelado',
  }),
];
