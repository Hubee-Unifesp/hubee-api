import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderService } from '../order/order.service';
import { CreatePagamentoDto } from './dto/create-pagamento.dto';
import { UpdatePagamentoDto } from './dto/update-pagamento.dto';
import { PagamentoRepository } from './pagamento.repository';

@Injectable()
export class PagamentoService {
  constructor(
    private readonly pagamentoRepository: PagamentoRepository,
    private readonly orderService: OrderService,
  ) {}

  async findOne(pedidoId: string) {
    await this.ensureOrderExists(pedidoId);

    const pagamento =
      await this.pagamentoRepository.findByOrderId(pedidoId);
    if (!pagamento) {
      throw new NotFoundException(
        `Pagamento do pedido ${pedidoId} não encontrado`,
      );
    }

    return pagamento;
  }

  async create(pedidoId: string, dto: CreatePagamentoDto) {
    await this.ensureOrderExists(pedidoId);

    // Garante a relação 1:1 no nível de aplicação, além da constraint UNIQUE
    // do banco: assim o erro sobe como 409 legível em vez de 500 do Postgres.
    const existing =
      await this.pagamentoRepository.findByOrderId(pedidoId);
    if (existing) {
      throw new ConflictException(
        `Pedido ${pedidoId} já possui um pagamento registrado`,
      );
    }

    return this.pagamentoRepository.create({ ...dto, orderId: pedidoId });
  }

  async update(pedidoId: string, dto: UpdatePagamentoDto) {
    const pagamento = await this.findOne(pedidoId);
    return this.pagamentoRepository.update(pagamento.id, dto);
  }

  /**
   * A FK garante que o pedido existe, mas só na hora do INSERT: sem esta
   * checagem o erro do Postgres subiria como 500 em vez de 404.
   */
  private async ensureOrderExists(pedidoId: string): Promise<void> {
    try {
      await this.orderService.findOne(pedidoId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(`Pedido ${pedidoId} não encontrado`);
      }
      throw error;
    }
  }
}
