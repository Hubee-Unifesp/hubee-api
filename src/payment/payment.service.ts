import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { canAccess } from '../auth/ownership';
import { DRIZZLE } from '../database/database.constants';
import type { DrizzleDatabase } from '../database/database.provider';
import { OrderService } from '../order/order.service';
import { TicketService } from '../ticket/ticket.service';
import { CheckoutDto } from './dto/checkout.dto';
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
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    private readonly paymentRepository: PaymentRepository,
    private readonly orderService: OrderService,
    private readonly ticketService: TicketService,
  ) {}

  async findOne(orderId: string, user: AuthenticatedUser) {
    await this.ensureOrderAccessible(orderId, user);
    return this.findByOrder(orderId);
  }

  /**
   * Paga o pedido do usuário. O gateway ainda é simulado (fora do escopo da
   * GOL-175) e sempre aprova; quando houver um real, é aqui que ele entra.
   *
   * Pagamento, mudança de status do pedido e emissão dos ingressos acontecem
   * na mesma transaction: se algo falhar, o pedido continua pendente e nenhum
   * ingresso é emitido. O pedido fica travado, então dois checkouts ao mesmo
   * tempo não emitem os ingressos duas vezes.
   */
  checkout(dto: CheckoutDto, user: AuthenticatedUser) {
    return this.db.transaction(async (tx) => {
      const order = await this.orderService.lockPendingForCheckout(
        dto.orderId,
        user,
        tx,
      );

      const existing = await this.paymentRepository.findByOrderId(order.id, tx);
      if (existing) {
        throw new ConflictException(
          `Pedido ${order.id} já possui um pagamento registrado`,
        );
      }

      const payment = await this.paymentRepository.create(
        {
          orderId: order.id,
          paymentMethod: dto.paymentMethod,
          amount: order.totalAmount,
          status: 'confirmado',
          paidAt: new Date(),
        },
        tx,
      );

      const paidOrder = await this.orderService.markAsPaid(order.id, tx);
      const items = await this.orderService.findItems(order.id, tx);
      await this.ticketService.issueForPaidOrder(paidOrder, items, tx);

      return payment;
    });
  }

  async create(
    orderId: string,
    dto: CreatePaymentDto,
    user: AuthenticatedUser,
  ) {
    await this.ensureOrderAccessible(orderId, user);

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

  /** Só ADMIN chega aqui (confirmação/estorno), então não checa dono. */
  async update(orderId: string, dto: UpdatePaymentDto) {
    await this.findOrder(orderId);
    const payment = await this.findByOrder(orderId);

    // Validação de transição de status
    if (dto.status && dto.status !== payment.status) {
      const allowedTransitions = VALID_STATUS_TRANSITIONS[payment.status] ?? [];

      if (!allowedTransitions.includes(dto.status)) {
        throw new BadRequestException(
          `Transição de status inválida: não é permitido alterar de '${payment.status}' para '${dto.status}'.`,
        );
      }
    }

    return this.paymentRepository.update(payment.id, dto);
  }

  private async findByOrder(orderId: string) {
    const payment = await this.paymentRepository.findByOrderId(orderId);
    if (!payment) {
      throw new NotFoundException(
        `Pagamento do pedido ${orderId} não encontrado`,
      );
    }
    return payment;
  }

  /**
   * Pedido de outra pessoa responde 404, igual a pedido inexistente, para não
   * revelar quais ids existem.
   */
  private async ensureOrderAccessible(
    orderId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const order = await this.findOrder(orderId);
    if (!canAccess(user, order.userId)) {
      throw new NotFoundException(`Pedido ${orderId} não encontrado`);
    }
  }

  /**
   * A FK garante que o pedido existe, mas só na hora do INSERT: sem esta
   * checagem o erro do Postgres subiria como 500 em vez de 404.
   */
  private async findOrder(orderId: string) {
    try {
      return await this.orderService.findById(orderId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(`Pedido ${orderId} não encontrado`);
      }
      throw error;
    }
  }
}
