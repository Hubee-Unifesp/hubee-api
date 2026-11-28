import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventService } from '../event/event.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { CreateExpenseDto, MAX_EXPENSE_AMOUNT } from './dto/create-expense.dto';
import { QueryExpenseDto } from './dto/query-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpensesRepository } from './expenses.repository';
import { InstallmentsRepository } from './installments/installments.repository';

/** Calcula o valor total da despesa (`quantity × unitPrice`) com 2 casas decimais. */
export function calculateExpenseAmount(
  quantity: number,
  unitPrice: number,
): number {
  const amount =
    Math.round((quantity * unitPrice + Number.EPSILON) * 100) / 100;
  if (amount > MAX_EXPENSE_AMOUNT) {
    throw new BadRequestException(
      'O valor total da despesa excede o limite permitido.',
    );
  }
  return amount;
}

@Injectable()
export class ExpensesService {
  constructor(
    private readonly expensesRepository: ExpensesRepository,
    private readonly eventService: EventService,
    private readonly suppliersService: SuppliersService,
    private readonly installmentsRepository: InstallmentsRepository,
  ) {}

  async findAll(eventId: string, query: QueryExpenseDto) {
    await this.ensureEventExists(eventId);

    return this.expensesRepository.findAll({
      eventId,
      group: query.group,
      category: query.category,
      quoted: query.quoted,
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
    if (dto.supplierId) {
      await this.ensureSupplierExists(dto.supplierId);
    }

    const quantity = dto.quantity ?? 1;
    const amount = calculateExpenseAmount(quantity, dto.unitPrice);

    return this.expensesRepository.create({
      ...dto,
      eventId,
      quantity,
      amount,
    });
  }

  async update(eventId: string, id: string, dto: UpdateExpenseDto) {
    const current = await this.findOne(eventId, id);

    if (dto.supplierId) {
      await this.ensureSupplierExists(dto.supplierId);
    }

    const nextAmount =
      dto.quantity !== undefined || dto.unitPrice !== undefined
        ? calculateExpenseAmount(
            dto.quantity ?? current.quantity,
            dto.unitPrice ?? current.unitPrice,
          )
        : undefined;

    if (nextAmount === undefined) {
      return this.expensesRepository.update(id, dto);
    }

    return this.installmentsRepository.transaction(async (tx) => {
      await this.installmentsRepository.lockExpense(id, tx);
      const installmentsTotal =
        await this.installmentsRepository.sumActiveAmount(id, tx);
      if (Math.round(installmentsTotal * 100) > Math.round(nextAmount * 100)) {
        throw new BadRequestException(
          'O valor da despesa não pode ficar menor que a soma das parcelas cadastradas.',
        );
      }
      return this.expensesRepository.update(
        id,
        { ...dto, amount: nextAmount },
        tx,
      );
    });
  }

  async remove(eventId: string, id: string): Promise<void> {
    await this.findOne(eventId, id);
    await this.expensesRepository.delete(id);
  }

  /**
   * A FK garante que o evento existe, mas só na hora do INSERT: sem esta
   * checagem prévia o erro do Postgres subiria como 500 em vez de 404.
   */
  async ensureEventExists(eventId: string): Promise<void> {
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
