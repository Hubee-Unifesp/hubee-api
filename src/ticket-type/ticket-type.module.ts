import { Module, forwardRef } from '@nestjs/common';
import { EventModule } from '../event/event.module';
import { TicketTypeController } from './ticket-type.controller';
import { TicketTypeRepository } from './ticket-type.repository';
import { TicketTypeService } from './ticket-type.service';

@Module({
  // `forwardRef`: o OrderModule importa este módulo e fecha o ciclo
  // event -> organization -> users -> order -> ticket-type -> event.
  imports: [forwardRef(() => EventModule)],
  controllers: [TicketTypeController],
  providers: [TicketTypeRepository, TicketTypeService],
  exports: [TicketTypeService],
})
export class TicketTypeModule {}
