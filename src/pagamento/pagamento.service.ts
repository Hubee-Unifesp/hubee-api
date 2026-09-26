import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderService } from '../order/order.service';
import { CreatePagamentoDto } from './dto/create-pagamento.dto';
import { UpdatePagamentoDto } from './dto/update-pagamento.dto';
import { PagamentoRepository } from './pagamento.repository';

// Máquina de estados para garantir transições válidas de pagamento
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  pendente: ['confirmado', 'recusado'],
  confirmado: ['estornado'],
  recusado: [],
  estornado: [],
};

@Injectable()
export class PagamentoService {
  constructor(
    private readonly pagamentoRepository: PagamentoRepository,
    private readonly orderService: OrderService,
  ) {}

  async findOne(orderId: string) {
    await this.ensureOrderExists(orderId);

    const pagamento = await this.pagamentoRepository.findByOrderId(orderId);
    if (!pagamento) {
      throw new NotFoundException(
        `Pagamento do pedido ${orderId} não encontrado`,
      );
    }

    return pagamento;
  }

  async create(orderId: string, dto: CreatePagamentoDto) {
    await this.ensureOrderExists(orderId);

    // Garante a relação 1:1 no nível de aplicação, além da constraint UNIQUE
    // do banco: assim o erro sobe como 409 legível em vez de 500 do Postgres.
    const existing = await this.pagamentoRepository.findByOrderId(orderId);
    if (existing) {
      throw new ConflictException(
        `Pedido ${orderId} já possui um pagamento registrado`,
      );
    }

    return this.pagamentoRepository.create({ ...dto, orderId });
  }

  async update(orderId: string, dto: UpdatePagamentoDto) {
    const pagamento = await this.findOne(orderId);

    // Validação de transição de status
    if (dto.status && dto.status !== pagamento.status) {
      const allowedTransitions =
        VALID_STATUS_TRANSITIONS[pagamento.status] ?? [];

      if (!allowedTransitions.includes(dto.status)) {
        throw new BadRequestException(
          `Transição de status inválida: não é permitido alterar de '${pagamento.status}' para '${dto.status}'.`,
        );
      }
    }

    return this.pagamentoRepository.update(pagamento.id, dto);
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
