import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { TicketResponseDto } from './dto/ticket-response.dto';
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
import { toResponse } from '../common/serialization/to-response';

/**
 * Sem prefixo no `@Controller`: a emissão e a listagem são sub-recursos do
 * pedido (`/orders/:orderId/tickets`), mas a consulta e a mudança de status
 * usam o ingresso direto (`/tickets/:id`), que é o que a portaria lê.
 */
@ApiTags('tickets')
@Controller()
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Post('orders/:orderId/tickets')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: TicketResponseDto, isArray: true })
  async create(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CreateTicketsDto,
  ) {
    return toResponse(
      TicketResponseDto,
      await this.ticketService.create(orderId, dto),
    );
  }

  @Get('orders/:orderId/tickets')
  @ApiOkResponse({ type: TicketResponseDto, isArray: true })
  async findAllByOrder(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return toResponse(
      TicketResponseDto,
      await this.ticketService.findAllByOrder(orderId),
    );
  }

  @Get('tickets/:id')
  @ApiOkResponse({ type: TicketResponseDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return toResponse(TicketResponseDto, await this.ticketService.findOne(id));
  }

  @Patch('tickets/:id')
  @ApiOkResponse({ type: TicketResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketDto,
  ) {
    return toResponse(
      TicketResponseDto,
      await this.ticketService.update(id, dto),
    );
  }
}
