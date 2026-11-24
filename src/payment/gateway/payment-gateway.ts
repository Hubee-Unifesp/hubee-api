import type { PaymentMethod } from '../../database/schema';

export interface PaymentCharge {
  orderId: string;
  amount: number;
  paymentMethod: PaymentMethod;
}

export type PaymentChargeResult =
  { status: 'confirmado'; paidAt: Date } | { status: 'recusado' };

export abstract class PaymentGateway {
  abstract charge(charge: PaymentCharge): Promise<PaymentChargeResult>;
}
