import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { UsuariosService } from '../usuarios/usuarios.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { FindAllOrdersFilters, OrderRepository } from './order.repository';

@Injectable()
export class OrderService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly usuariosService: UsuariosService,
  ) {}

  findAll(filters: FindAllOrdersFilters) {
    return this.orderRepository.findAll(filters);
  }

  async findOne(id: string) {
    const order = await this.orderRepository.findById(id);
    if (!order) {
      throw new NotFoundException(`Pedido ${id} não encontrado`);
    }
    return order;
  }

  async create(dto: CreateOrderDto) {
    await this.ensureUserExists(dto.userId);
    return this.orderRepository.create(dto);
  }

  async update(id: string, dto: UpdateOrderDto) {
    const order = await this.findOne(id);
    if (order.status === 'cancelado') {
      throw new UnprocessableEntityException(
        'Pedido cancelado não pode ser alterado',
      );
    }

    return this.orderRepository.update(id, dto);
  }

  /**
   * O DELETE da API cancela o pedido em vez de apagar a linha: pedido é
   * registro financeiro e precisa continuar auditável depois de cancelado.
   */
  async cancel(id: string): Promise<void> {
    const order = await this.findOne(id);

    if (order.status === 'cancelado') {
      throw new UnprocessableEntityException('Pedido já está cancelado');
    }

    if (order.status === 'pago') {
      throw new UnprocessableEntityException(
        'Pedido pago não pode ser cancelado; registre um estorno',
      );
    }

    await this.orderRepository.update(id, { status: 'cancelado' });
  }

  /**
   * A FK garante que o comprador existe, mas só na hora do INSERT: sem esta
   * checagem o erro do Postgres subiria como 500 em vez de 404.
   */
  private async ensureUserExists(userId: string): Promise<void> {
    try {
      await this.usuariosService.findOne(userId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(`Usuário ${userId} não encontrado`);
      }
      throw error;
    }
  }
}
