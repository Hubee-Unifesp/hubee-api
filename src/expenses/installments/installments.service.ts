import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ExpensePaymentStatus } from '../../database/schema';
import { ExpensesService } from '../expenses.service';
import { CreateInstallmentDto } from './dto/create-installment.dto';
import { UpdateInstallmentDto } from './dto/update-installment.dto';
import { InstallmentsRepository } from './installments.repository';

const toCents = (value: number) => Math.round(value * 100);

export function ensureWithinExpenseAmount(
  expenseAmount: number,
  otherInstallmentsTotal: number,
  installmentAmount: number,
  status: ExpensePaymentStatus,
): void {
  if (status === 'cancelado') return;
  const total = toCents(otherInstallmentsTotal) + toCents(installmentAmount);
  if (total > toCents(expenseAmount)) {
    const available = Math.max(
      0,
      (toCents(expenseAmount) - toCents(otherInstallmentsTotal)) / 100,
    );
    throw new BadRequestException(
      `A soma das parcelas não pode passar do valor da despesa. Valor disponível: R$ ${available.toFixed(2).replace('.', ',')}.`,
    );
  }
}

@Injectable()
export class InstallmentsService {
  constructor(
    private readonly installmentsRepository: InstallmentsRepository,
    private readonly expensesService: ExpensesService,
  ) {}

  async findAllByEvent(eventId: string) {
    await this.expensesService.ensureEventExists(eventId);
    return this.installmentsRepository.findAllByEvent(eventId);
  }

  async findAllByExpense(eventId: string, expenseId: string) {
    await this.expensesService.findOne(eventId, expenseId);
    return this.installmentsRepository.findAllByExpense(expenseId);
  }

  async findOne(eventId: string, expenseId: string, id: string) {
    await this.expensesService.findOne(eventId, expenseId);
    const installment = await this.installmentsRepository.findById(id);
    if (!installment || installment.expenseId !== expenseId) {
      throw new NotFoundException(`Parcela ${id} não encontrada`);
    }
    return installment;
  }

  async create(eventId: string, expenseId: string, dto: CreateInstallmentDto) {
    await this.expensesService.findOne(eventId, expenseId);

    return this.installmentsRepository.transaction(async (tx) => {
      const expense = await this.installmentsRepository.lockExpense(
        expenseId,
        tx,
      );
      if (!expense) {
        throw new NotFoundException(`Despesa ${expenseId} não encontrada`);
      }
      const otherTotal = await this.installmentsRepository.sumActiveAmount(
        expenseId,
        tx,
      );
      ensureWithinExpenseAmount(
        expense.amount,
        otherTotal,
        dto.amount,
        dto.status ?? 'pendente',
      );
      return this.installmentsRepository.create({ ...dto, expenseId }, tx);
    });
  }

  async update(
    eventId: string,
    expenseId: string,
    id: string,
    dto: UpdateInstallmentDto,
  ) {
    const current = await this.findOne(eventId, expenseId, id);

    return this.installmentsRepository.transaction(async (tx) => {
      const expense = await this.installmentsRepository.lockExpense(
        expenseId,
        tx,
      );
      if (!expense) {
        throw new NotFoundException(`Despesa ${expenseId} não encontrada`);
      }
      const otherTotal = await this.installmentsRepository.sumActiveAmount(
        expenseId,
        tx,
        id,
      );
      ensureWithinExpenseAmount(
        expense.amount,
        otherTotal,
        dto.amount ?? current.amount,
        dto.status ?? current.status,
      );
      return this.installmentsRepository.update(id, dto, tx);
    });
  }

  async remove(eventId: string, expenseId: string, id: string): Promise<void> {
    await this.findOne(eventId, expenseId, id);
    await this.installmentsRepository.delete(id);
  }
}
