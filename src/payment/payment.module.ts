import { Module } from '@nestjs/common';
import { OrderModule } from '../order/order.module';
import { TicketModule } from '../ticket/ticket.module';
import { CheckoutController } from './checkout.controller';
import { PaymentController } from './payment.controller';
import { PaymentRepository } from './payment.repository';
import { PaymentService } from './payment.service';

@Module({
  imports: [OrderModule, TicketModule],
  controllers: [CheckoutController, PaymentController],
  providers: [PaymentRepository, PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
