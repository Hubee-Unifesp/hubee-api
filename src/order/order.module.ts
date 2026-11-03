import { Module, forwardRef } from '@nestjs/common';
import { TicketTypeModule } from '../ticket-type/ticket-type.module';
import { UsersModule } from '../users/users.module';
import { OrderController } from './order.controller';
import { OrderItemRepository } from './order-item.repository';
import { OrderRepository } from './order.repository';
import { OrderService } from './order.service';

@Module({
  imports: [forwardRef(() => UsersModule), TicketTypeModule],
  controllers: [OrderController],
  providers: [OrderRepository, OrderItemRepository, OrderService],
  exports: [OrderService],
})
export class OrderModule {}
