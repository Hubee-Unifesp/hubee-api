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
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@Injectable()
export class OrderService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly usersService: UsersService,
  ) {}

  findAll(filters: FindAllOrdersFilters, userId?: string) {
    return this.orderRepository.findAll({ ...filters, userId });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const order = await this.orderRepository.findById(id);
    if (!order) {
      throw new NotFoundException(`Pedido ${id} não encontrado`);
    }

    if (order.userId !== user.id && user.role !== 'ADMIN') {
      throw new NotFoundException(`Pedido ${id} não encontrado`);
    }

    return order;
  }

  async create(authUser: AuthenticatedUser, dto: CreateOrderDto) {
    const user = await this.usersService.findOne(authUser.id);

    const missing: string[] = [];
    if (!user.cpf) missing.push('cpf');
    if (!user.birthDate) missing.push('birthDate');

    if (missing.length > 0) {
      throw new ForbiddenException({
        code: 'PROFILE_INCOMPLETE',
        missing,
      });
    }
    return this.orderRepository.create({ ...dto, userId: authUser.id });
  }

  async update(id: string, dto: UpdateOrderDto, user: AuthenticatedUser) {
    const order = await this.findOne(id, user);
    if (order.status === 'cancelado') {
      throw new UnprocessableEntityException(
        'Pedido cancelado não pode ser alterado',
      );
    }

    return this.orderRepository.update(id, dto);
  }

  async cancel(id: string, user: AuthenticatedUser): Promise<void> {
    const order = await this.findOne(id, user);

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
