import { Module } from '@nestjs/common';
import { EventModule } from '../event/event.module';
import { TicketTypeController } from './ticket-type.controller';
import { TicketTypeRepository } from './ticket-type.repository';
import { TicketTypeService } from './ticket-type.service';

@Module({
  imports: [EventModule],
  controllers: [TicketTypeController],
  providers: [TicketTypeRepository, TicketTypeService],
  exports: [TicketTypeService],
})
export class TicketTypeModule {}
