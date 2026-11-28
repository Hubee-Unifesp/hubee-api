import { Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type { DrizzleDatabase } from '../database/database.provider';
import {
  addresses,
  events,
  expenseInstallments,
  expenses,
  ticketTypes,
  venues,
} from '../database/schema';
import type {
  PlanningAiEventContext,
  PlanningAiExpenseContext,
} from './ai/planning-ai.prompt';
import type {
  ReviewExpenseInput,
  ReviewInstallmentInput,
} from './ai/planning-review-facts';
import type {
  PlanningExpenseInput,
  PlanningLotInput,
} from './planning-summary';

@Injectable()
export class PlanningRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  /** Despesas do evento com os campos usados no resumo (inclui canceladas). */
  async findExpenses(eventId: string): Promise<PlanningExpenseInput[]> {
    return this.db
      .select({
        group: expenses.group,
        category: expenses.category,
        amount: expenses.amount,
        quoted: expenses.quoted,
        paymentStatus: expenses.paymentStatus,
      })
      .from(expenses)
      .where(eq(expenses.eventId, eventId));
  }

  /** Lotes do evento; a ordem de venda é aplicada no cálculo. */
  async findLots(eventId: string): Promise<PlanningLotInput[]> {
    return this.db
      .select({
        id: ticketTypes.id,
        batch: ticketTypes.batch,
        price: ticketTypes.price,
        quantity: ticketTypes.quantity,
        modality: ticketTypes.modality,
        salesStartDate: ticketTypes.salesStartDate,
        salesEndDate: ticketTypes.salesEndDate,
        createdAt: ticketTypes.createdAt,
      })
      .from(ticketTypes)
      .where(eq(ticketTypes.eventId, eventId));
  }

  /** Dados do evento usados como contexto pela IA do planejamento. */
  async findAiEventContext(
    eventId: string,
  ): Promise<PlanningAiEventContext | undefined> {
    const [row] = await this.db
      .select({
        name: events.name,
        category: events.category,
        startDate: events.startDate,
        endDate: events.endDate,
        expectedAudience: events.expectedAudience,
        venueName: venues.name,
        venueCapacity: venues.maxCapacity,
        city: addresses.city,
        state: addresses.state,
      })
      .from(events)
      .leftJoin(venues, eq(venues.id, events.venueId))
      .leftJoin(addresses, eq(addresses.id, venues.addressId))
      .where(eq(events.id, eventId));
    return row;
  }

  /** Despesas do evento com descrição, para a IA não repetir o que existe. */
  async findExpenseItems(eventId: string): Promise<PlanningAiExpenseContext[]> {
    return this.db
      .select({
        description: expenses.description,
        group: expenses.group,
        category: expenses.category,
      })
      .from(expenses)
      .where(eq(expenses.eventId, eventId))
      .orderBy(
        asc(expenses.group),
        asc(expenses.category),
        asc(expenses.createdAt),
      );
  }

  /** Despesas com os campos usados nos fatos da análise com IA (GOL-307). */
  async findReviewExpenses(eventId: string): Promise<ReviewExpenseInput[]> {
    return this.db
      .select({
        id: expenses.id,
        description: expenses.description,
        group: expenses.group,
        category: expenses.category,
        amount: expenses.amount,
        quoted: expenses.quoted,
        paymentStatus: expenses.paymentStatus,
        dueDate: expenses.dueDate,
      })
      .from(expenses)
      .where(eq(expenses.eventId, eventId));
  }

  /** Parcelas das despesas do evento, para achar pagamentos vencidos. */
  async findReviewInstallments(
    eventId: string,
  ): Promise<ReviewInstallmentInput[]> {
    return this.db
      .select({
        expenseId: expenseInstallments.expenseId,
        amount: expenseInstallments.amount,
        dueDate: expenseInstallments.dueDate,
        status: expenseInstallments.status,
      })
      .from(expenseInstallments)
      .innerJoin(expenses, eq(expenses.id, expenseInstallments.expenseId))
      .where(eq(expenses.eventId, eventId));
  }
}
