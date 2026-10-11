import { Module, forwardRef } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { OrderController } from './order.controller';
import { OrderRepository } from './order.repository';
import { OrderService } from './order.service';

@Module({
  imports: [forwardRef(() => UsersModule)],
  controllers: [OrderController],
  providers: [OrderRepository, OrderService],
  exports: [OrderService],
})
export class OrderModule {}
