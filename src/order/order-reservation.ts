import { eq, inArray, sql } from 'drizzle-orm';
import type { DbExecutor } from '../database/database.provider';
import { orderItems, orders, tickets } from '../database/schema';

/**
 * Por quanto tempo um pedido `pendente` segura o estoque do lote. Passado o
 * prazo, a reserva deixa de contar no saldo e o pedido não pode mais ser pago.
 */
export const PENDING_ORDER_TTL_MINUTES = 15;

const PENDING_ORDER_TTL_MS = PENDING_ORDER_TTL_MINUTES * 60 * 1000;

/** Quando a reserva do pedido vence. */
export function reservationExpiresAt(order: { createdAt: Date }): Date {
  return new Date(order.createdAt.getTime() + PENDING_ORDER_TTL_MS);
}

/** Pedidos pendentes criados antes deste instante já não reservam nada. */
export function pendingReservationCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - PENDING_ORDER_TTL_MS);
}

/** Só pedido pendente expira; pago e cancelado têm status definitivo. */
export function isReservationExpired(
  order: { status: string; createdAt: Date },
  now: Date = new Date(),
): boolean {
  return order.status === 'pendente' && reservationExpiresAt(order) <= now;
}

/**
 * Quantidade já comprometida por lote: pedidos pendentes dentro do prazo
 * reservam o saldo e pedidos pagos (ou ingressos emitidos manualmente via
 * ADMIN) o consomem; pedidos/ingressos cancelados e reservas vencidas devolvem
 * a vaga.
 *
 * Função solta (e não método de repository) porque pedido, lote e detalhe do
 * evento precisam da mesma conta, e os módulos deles já se importam em ciclo.
 */
export async function sumCommittedByTicketType(
  executor: DbExecutor,
  ticketTypeIds: string[],
  now: Date = new Date(),
): Promise<Map<string, number>> {
  if (ticketTypeIds.length === 0) return new Map();

  const cutoff = pendingReservationCutoff(now);

  const itemRows = await executor
    .select({
      ticketTypeId: orderItems.ticketTypeId,
      pending: sql<number>`coalesce(sum(${orderItems.quantity}) filter (where ${orders.status} = 'pendente' and ${orders.createdAt} > ${cutoff}), 0)::int`,
      paid: sql<number>`coalesce(sum(${orderItems.quantity}) filter (where ${orders.status} = 'pago'), 0)::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(
      sql`${inArray(orderItems.ticketTypeId, ticketTypeIds)} and ${orders.status} in ('pendente', 'pago')`,
    )
    .groupBy(orderItems.ticketTypeId);

  const ticketRows = await executor
    .select({
      ticketTypeId: tickets.ticketTypeId,
      issued: sql<number>`count(*) filter (where ${tickets.status} <> 'cancelado')::int`,
      cancelled: sql<number>`count(*) filter (where ${tickets.status} = 'cancelado')::int`,
    })
    .from(tickets)
    .where(inArray(tickets.ticketTypeId, ticketTypeIds))
    .groupBy(tickets.ticketTypeId);

  const statsByType = new Map(
    ticketRows.map((row) => [
      row.ticketTypeId,
      { issued: row.issued, cancelled: row.cancelled },
    ]),
  );
  const result = new Map<string, number>();

  for (const row of itemRows) {
    const stats = statsByType.get(row.ticketTypeId) ?? {
      issued: 0,
      cancelled: 0,
    };
    const paidActive = Math.max(0, row.paid - stats.cancelled);
    result.set(
      row.ticketTypeId,
      row.pending + Math.max(paidActive, stats.issued),
    );
    statsByType.delete(row.ticketTypeId);
  }

  for (const [ticketTypeId, stats] of statsByType) {
    result.set(ticketTypeId, stats.issued);
  }

  return result;
}

/** Acrescenta a cada lote o saldo real (`available`), nunca negativo. */
export async function withAvailability<
  T extends { id: string; quantity: number },
>(
  executor: DbExecutor,
  ticketTypes: T[],
  now: Date = new Date(),
): Promise<(T & { available: number })[]> {
  const committed = await sumCommittedByTicketType(
    executor,
    ticketTypes.map((ticketType) => ticketType.id),
    now,
  );
  return ticketTypes.map((ticketType) => ({
    ...ticketType,
    available: Math.max(
      0,
      ticketType.quantity - (committed.get(ticketType.id) ?? 0),
    ),
  }));
}
