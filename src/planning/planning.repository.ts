import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type { DrizzleDatabase } from '../database/database.provider';
import { expenses, ticketTypes } from '../database/schema';
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
        salesStartDate: ticketTypes.salesStartDate,
      })
      .from(ticketTypes)
      .where(eq(ticketTypes.eventId, eventId));
  }
}
