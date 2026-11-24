import { Injectable } from '@nestjs/common';
import {
  PaymentGateway,
  type PaymentCharge,
  type PaymentChargeResult,
} from './payment-gateway';

@Injectable()
export class SimulatedPaymentGateway extends PaymentGateway {
  charge(_charge: PaymentCharge): Promise<PaymentChargeResult> {
    return Promise.resolve({ status: 'confirmado', paidAt: new Date() });
  }
}
