import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateTicketsDto } from './dto/create-tickets.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketService } from './ticket.service';

/**
 * Sem prefixo no `@Controller`: a emissão e a listagem são sub-recursos do
 * pedido (`/orders/:orderId/tickets`), mas a consulta e a mudança de status
 * usam o ingresso direto (`/tickets/:id`), que é o que a portaria lê.
 */
@Controller()
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Post('orders/:orderId/tickets')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CreateTicketsDto,
  ) {
    return this.ticketService.create(orderId, dto);
  }

  @Get('orders/:orderId/tickets')
  findAllByOrder(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.ticketService.findAllByOrder(orderId);
  }

  @Get('tickets/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ticketService.findOne(id);
  }

  @Patch('tickets/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTicketDto) {
    return this.ticketService.update(id, dto);
  }
}
