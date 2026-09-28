import { Injectable, NotFoundException } from '@nestjs/common';
import { EventService } from '../event/event.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { QueryExpenseDto } from './dto/query-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpensesRepository } from './expenses.repository';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly expensesRepository: ExpensesRepository,
    private readonly eventService: EventService,
    private readonly suppliersService: SuppliersService,
  ) {}

  async findAll(eventId: string, query: QueryExpenseDto) {
    await this.ensureEventExists(eventId);

    return this.expensesRepository.findAll({
      eventId,
      paymentStatus: query.paymentStatus,
    });
  }

  async findOne(eventId: string, id: string) {
    await this.ensureEventExists(eventId);

    const expense = await this.expensesRepository.findById(id);
    // Também valida que a expense pertence ao evento da rota: sem isso, um ID
    // válido de outro evento vazaria dados entre eventos diferentes.
    if (!expense || expense.eventId !== eventId) {
      throw new NotFoundException(`Despesa ${id} não encontrada`);
    }

    return expense;
  }

  async create(eventId: string, dto: CreateExpenseDto) {
    await this.ensureEventExists(eventId);
    await this.ensureSupplierExists(dto.supplierId);

    return this.expensesRepository.create({ ...dto, eventId });
  }

  async update(eventId: string, id: string, dto: UpdateExpenseDto) {
    await this.findOne(eventId, id);

    if (dto.supplierId) {
      await this.ensureSupplierExists(dto.supplierId);
    }

    return this.expensesRepository.update(id, dto);
  }

  async remove(eventId: string, id: string): Promise<void> {
    await this.findOne(eventId, id);
    await this.expensesRepository.delete(id);
  }

  /**
   * A FK garante que o evento existe, mas só na hora do INSERT: sem esta
   * checagem prévia o erro do Postgres subiria como 500 em vez de 404.
   */
  private async ensureEventExists(eventId: string): Promise<void> {
    try {
      await this.eventService.findOne(eventId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(`Evento ${eventId} não encontrado`);
      }
      throw error;
    }
  }

  private async ensureSupplierExists(supplierId: string): Promise<void> {
    try {
      await this.suppliersService.findOne(supplierId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(`Fornecedor ${supplierId} não encontrado`);
      }
      throw error;
    }
  }
}
