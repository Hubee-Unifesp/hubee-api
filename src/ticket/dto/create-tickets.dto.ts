import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';

/** O pedido vem da rota (`/pedidos/:pedidoId/ingressos`), não do corpo. */
export class TicketItemDto {
  @IsUUID()
  eventId: string;

  @IsUUID()
  ticketTypeId: string;

  /** Sem titular informado, o ingresso fica com o comprador do pedido. */
  @IsOptional()
  @IsUUID()
  holderUserId?: string;
}

export class CreateTicketsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => TicketItemDto)
  tickets: TicketItemDto[];
}
