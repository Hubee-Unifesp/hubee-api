import { Module } from '@nestjs/common';
import { EventModule } from '../event/event.module';
import { OrderModule } from '../order/order.module';
import { TicketTypeModule } from '../ticket-type/ticket-type.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { TicketController } from './ticket.controller';
import { TicketRepository } from './ticket.repository';
import { TicketService } from './ticket.service';

@Module({
  imports: [EventModule, OrderModule, TicketTypeModule, UsuariosModule],
  controllers: [TicketController],
  providers: [TicketRepository, TicketService],
  exports: [TicketService],
})
export class TicketModule {}
