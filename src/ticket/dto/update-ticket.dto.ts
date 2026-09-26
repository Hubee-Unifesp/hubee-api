import { IsIn } from 'class-validator';
import { ticketStatus } from '../../database/schema';
import type { TicketStatus } from '../../database/schema';

/**
 * Só o status muda depois da emissão: pedido, evento, tipo e titular definem o
 * ingresso vendido, e o QR code é o que a portaria já recebeu.
 */
export class UpdateTicketDto {
  @IsIn(ticketStatus.enumValues)
  status: TicketStatus;
}
