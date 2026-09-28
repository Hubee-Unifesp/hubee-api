import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderService } from '../order/order.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaymentRepository } from './payment.repository';

// Máquina de estados para garantir transições válidas de pagamento
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  pendente: ['confirmado', 'recusado'],
  confirmado: ['estornado'],
  recusado: [],
  estornado: [],
};

@Injectable()
export class PaymentService {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly orderService: OrderService,
  ) {}

  async findOne(orderId: string) {
    await this.ensureOrderExists(orderId);

    const payment = await this.paymentRepository.findByOrderId(orderId);
    if (!payment) {
      throw new NotFoundException(
        `Pagamento do pedido ${orderId} não encontrado`,
      );
    }

    return payment;
  }

  async create(orderId: string, dto: CreatePaymentDto) {
    await this.ensureOrderExists(orderId);

    // Garante a relação 1:1 no nível de aplicação, além da constraint UNIQUE
    // do banco: assim o erro sobe como 409 legível em vez de 500 do Postgres.
    const existing = await this.paymentRepository.findByOrderId(orderId);
    if (existing) {
      throw new ConflictException(
        `Pedido ${orderId} já possui um pagamento registrado`,
      );
    }

    return this.paymentRepository.create({ ...dto, orderId });
  }

  async update(orderId: string, dto: UpdatePaymentDto) {
    const payment = await this.findOne(orderId);

    // Validação de transição de status
    if (dto.status && dto.status !== payment.status) {
      const allowedTransitions =
        VALID_STATUS_TRANSITIONS[payment.status] ?? [];

      if (!allowedTransitions.includes(dto.status)) {
        throw new BadRequestException(
          `Transição de status inválida: não é permitido alterar de '${payment.status}' para '${dto.status}'.`,
        );
      }
    }

    return this.paymentRepository.update(payment.id, dto);
  }

  /**
   * A FK garante que o pedido existe, mas só na hora do INSERT: sem esta
   * checagem o erro do Postgres subiria como 500 em vez de 404.
   */
  private async ensureOrderExists(orderId: string): Promise<void> {
    try {
      await this.orderService.findOne(orderId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(`Pedido ${orderId} não encontrado`);
      }
      throw error;
    }
  }
}
