import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  MyTicketResponseDto,
  TicketResponseDto,
} from './dto/ticket-response.dto';
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
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { Authenticated } from '../auth/decorators/authenticated.decorator';
import {
  type AuthenticatedUser,
  CurrentUser,
} from '../auth/decorators/current-user.decorator';

/**
 * Sem prefixo no `@Controller`: a emissão e a listagem são sub-recursos do
 * pedido (`/orders/:orderId/tickets`), mas a consulta e a mudança de status
 * usam o ingresso direto (`/tickets/:id`), que é o que a portaria lê.
 * `users/me/tickets` mora aqui, e não no controller de usuários, para o módulo
 * de usuários não depender do de ingressos (que já depende dele).
 *
 * Emitir e mudar status é só ADMIN: o service não confere a quantidade
 * emitida contra o valor pago, então o comprador não pode emitir sozinho.
 * Consultar é para o comprador ou o titular (o service responde 404 aos
 * demais).
 */
@ApiTags('tickets')
@Controller()
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @AdminOnly()
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

  @Authenticated()
  @Get('tickets')
  @ApiOkResponse({ type: MyTicketResponseDto, isArray: true })
  async findMine(@CurrentUser() user: AuthenticatedUser) {
    return toResponse(
      MyTicketResponseDto,
      await this.ticketService.findAllByHolder(user.id),
    );
  }

  /** Mesma lista de `GET /tickets`, sob o perfil do usuário (`/users/me/*`). */
  @Authenticated()
  @Get('users/me/tickets')
  @ApiOkResponse({ type: MyTicketResponseDto, isArray: true })
  findMyTickets(@CurrentUser() user: AuthenticatedUser) {
    return this.findMine(user);
  }

  @Authenticated()
  @Get('orders/:orderId/tickets')
  @ApiOkResponse({ type: TicketResponseDto, isArray: true })
  async findAllByOrder(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return toResponse(
      TicketResponseDto,
      await this.ticketService.findAllByOrder(orderId, user),
    );
  }

  @Authenticated()
  @Get('tickets/:id')
  @ApiOkResponse({ type: TicketResponseDto })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return toResponse(
      TicketResponseDto,
      await this.ticketService.findOne(id, user),
    );
  }

  @AdminOnly()
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
