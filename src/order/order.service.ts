import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { FindAllOrdersFilters, OrderRepository } from './order.repository';

@Injectable()
export class OrderService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly usersService: UsersService,
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

  async create(userId: string, dto: CreateOrderDto) {
    const user = await this.usersService.findOne(userId);

    const missing: string[] = [];
    if (!user.cpf) missing.push('cpf');
    if (!user.birthDate) missing.push('birthDate');

    if (missing.length > 0) {
      throw new ForbiddenException({
        code: 'PROFILE_INCOMPLETE',
        missing,
      });
    }
    return this.orderRepository.create({ ...dto, userId });
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
}
