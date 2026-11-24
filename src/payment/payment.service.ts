import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { canAccess } from '../auth/ownership';
import { DRIZZLE } from '../database/database.constants';
import type {
  DbExecutor,
  DrizzleDatabase,
} from '../database/database.provider';
import { OrderService, isOnSale } from '../order/order.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TicketService } from '../ticket/ticket.service';
import { CheckoutDto } from './dto/checkout.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaymentGateway } from './gateway/payment-gateway';
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
    private readonly notificationsService: NotificationsService,
    private readonly paymentGateway: PaymentGateway,
  ) {}

  async findOne(orderId: string, user: AuthenticatedUser) {
    await this.ensureOrderAccessible(orderId, user);
    return this.findByOrder(orderId);
  }

  /**
   * Paga o pedido do usuário cobrando o total no `PaymentGateway` registrado
   * no `PaymentModule` (hoje o `SimulatedPaymentGateway`, que sempre aprova).
   * Cobrança recusada responde 422 e desfaz a transaction: nada é gravado e o
   * pedido continua pendente.
   *
   * Pagamento, mudança de status do pedido e emissão dos ingressos acontecem
   * na mesma transaction: se algo falhar, o pedido continua pendente e nenhum
   * ingresso é emitido. O pedido fica travado, então dois checkouts ao mesmo
   * tempo não emitem os ingressos duas vezes.
   *
   * Pedido com a reserva vencida é cancelado (e a transaction confirma esse
   * cancelamento) antes de responder 422: o saldo dele já voltou ao lote.
   */
  async checkout(dto: CheckoutDto, user: AuthenticatedUser) {
    const confirmed = await this.db.transaction(async (tx) => {
      const order = await this.orderService.lockPendingForCheckout(
        dto.orderId,
        user,
        tx,
      );

      if (await this.orderService.cancelIfReservationExpired(order, tx)) {
        return null;
      }

      const existing = await this.paymentRepository.findByOrderId(order.id, tx);
      if (existing) {
        throw new ConflictException(
          `Pedido ${order.id} já possui um pagamento registrado`,
        );
      }

      const items = await this.orderService.findItems(order.id, tx);
      await this.ensureEventsOnSale(items, tx);

      const charge = await this.paymentGateway.charge({
        orderId: order.id,
        amount: order.totalAmount,
        paymentMethod: dto.paymentMethod,
      });
      if (charge.status !== 'confirmado') {
        throw new UnprocessableEntityException(
          'O pagamento foi recusado. Tente novamente ou use outra forma de pagamento.',
        );
      }

      const payment = await this.paymentRepository.create(
        {
          orderId: order.id,
          paymentMethod: dto.paymentMethod,
          amount: order.totalAmount,
          status: 'confirmado',
          paidAt: charge.paidAt,
        },
        tx,
      );

      const paidOrder = await this.orderService.markAsPaid(order.id, tx);
      await this.ticketService.issueForPaidOrder(paidOrder, items, tx);
      await this.notificationsService.notifyPaymentConfirmed(
        paidOrder,
        items,
        tx,
      );

      return payment;
    });

    if (!confirmed) {
      throw new UnprocessableEntityException(
        'A reserva deste pedido expirou. Faça um novo pedido para comprar os ingressos.',
      );
    }
    return confirmed;
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
    return this.db.transaction(async (tx) => {
      // Adquire lock no pedido para evitar duas requisições simultâneas
      // lendo o mesmo payment.status antes do commit (GOL-215).
      const order = await this.lockOrderById(orderId, tx);
      const payment = await this.findByOrder(orderId, tx);

      // Validação de transição de status dentro da transaction
      if (dto.status) {
        const allowedTransitions =
          VALID_STATUS_TRANSITIONS[payment.status] ?? [];

        if (!allowedTransitions.includes(dto.status)) {
          throw new BadRequestException(
            `Transição de status inválida: não é permitido alterar de '${payment.status}' para '${dto.status}'.`,
          );
        }
      }

      const updatedPayment = await this.paymentRepository.update(
        payment.id,
        dto,
        tx,
      );

      if (dto.status === 'estornado') {
        await this.orderService.markAsCancelled(orderId, tx);
        await this.ticketService.cancelByOrder(orderId, tx);
        await this.notificationsService.notifyOrderRefunded(order, tx);
      }

      return updatedPayment;
    });
  }

  private async ensureEventsOnSale(
    items: Awaited<ReturnType<OrderService['findItems']>>,
    executor: DbExecutor,
  ) {
    const eventIds = [
      ...new Set(
        items
          .map((item) => item.ticketType?.eventId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (eventIds.length === 0) return;

    const lockedEvents = await this.orderService.findEventsForShare(
      eventIds,
      executor,
    );
    const now = new Date();
    for (const event of lockedEvents) {
      if (event.status === 'cancelled') {
        throw new UnprocessableEntityException(
          `O evento "${event.name}" foi cancelado`,
        );
      }
      if (!isOnSale(event, now)) {
        throw new UnprocessableEntityException(
          `As vendas do evento "${event.name}" não estão abertas`,
        );
      }
    }
  }

  private async findByOrder(orderId: string, executor?: DbExecutor) {
    const payment = await this.paymentRepository.findByOrderId(
      orderId,
      executor,
    );
    if (!payment) {
      throw new NotFoundException(
        `Pagamento do pedido ${orderId} não encontrado`,
      );
    }
    return payment;
  }

  private lockOrderById(orderId: string, executor: DbExecutor) {
    return this.orderService.lockById(orderId, executor);
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
