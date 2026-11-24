import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrderModule } from '../order/order.module';
import { TicketModule } from '../ticket/ticket.module';
import { CheckoutController } from './checkout.controller';
import { PaymentGateway } from './gateway/payment-gateway';
import { SimulatedPaymentGateway } from './gateway/simulated-payment-gateway';
import { PaymentController } from './payment.controller';
import { PaymentRepository } from './payment.repository';
import { PaymentService } from './payment.service';

@Module({
  imports: [OrderModule, TicketModule, NotificationsModule],
  controllers: [CheckoutController, PaymentController],
  providers: [
    PaymentRepository,
    PaymentService,
    { provide: PaymentGateway, useClass: SimulatedPaymentGateway },
  ],
  exports: [PaymentService],
})
export class PaymentModule {}
