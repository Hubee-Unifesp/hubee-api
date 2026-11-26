import { jest } from '@jest/globals';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../database/database.constants';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpenseResponseDto } from './dto/expense-response.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';

/** Linha completa do banco com o nome do fornecedor, como o service a retorna. */
const row = {
  id: 'expense-1',
  eventId: 'event-1',
  supplierId: 'fornecedor-1',
  supplierName: 'Som & Luz Ltda',
  description: 'Aluguel de som e luz',
  group: 'fixed' as const,
  category: 'Estrutura',
  quantity: 2,
  unitPrice: 750,
  amount: 1500,
  responsible: 'Ana',
  quoted: true,
  notes: 'Montagem na véspera',
  dueDate: new Date('2026-10-01T00:00:00Z'),
  paymentStatus: 'pendente' as const,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

const EVENT_ID = 'event-1';

describe('ExpensesController', () => {
  let controller: ExpensesController;
  let service: {
    findAll: jest.Mock<ExpensesService['findAll']>;
    findOne: jest.Mock<ExpensesService['findOne']>;
    create: jest.Mock<ExpensesService['create']>;
    update: jest.Mock<ExpensesService['update']>;
    remove: jest.Mock<ExpensesService['remove']>;
  };

  beforeEach(async () => {
    service = {
      findAll: jest.fn<ExpensesService['findAll']>(),
      findOne: jest.fn<ExpensesService['findOne']>(),
      create: jest.fn<ExpensesService['create']>(),
      update: jest.fn<ExpensesService['update']>(),
      remove: jest.fn<ExpensesService['remove']>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      controllers: [ExpensesController],
      providers: [
        { provide: ExpensesService, useValue: service },
        { provide: DRIZZLE, useValue: {} },
      ],
    }).compile();

    controller = module.get(ExpensesController);
  });

  it('POST /events/:eventId/expenses delega para expensesService.create()', async () => {
    const dto: CreateExpenseDto = {
      supplierId: 'fornecedor-1',
      description: 'Aluguel de som e luz',
      group: 'fixed',
      category: 'Estrutura',
      quantity: 2,
      unitPrice: 750,
      dueDate: new Date('2026-10-01T00:00:00Z'),
    };
    const created = row as never;
    service.create.mockResolvedValue(created);

    const result = await controller.create(EVENT_ID, dto);

    expect(service.create).toHaveBeenCalledWith(EVENT_ID, dto);
    expect(result).toEqual(created);
    expect(result).toBeInstanceOf(ExpenseResponseDto);
  });

  it('GET /events/:eventId/expenses delega para expensesService.findAll() com os filtros da query', async () => {
    const list = [row] as never;
    service.findAll.mockResolvedValue(list);

    const result = await controller.findAll(EVENT_ID, {
      group: 'fixed',
      quoted: true,
      paymentStatus: 'pendente',
    });

    expect(service.findAll).toHaveBeenCalledWith(EVENT_ID, {
      group: 'fixed',
      quoted: true,
      paymentStatus: 'pendente',
    });
    expect(result).toEqual(list);
    expect(result[0]).toBeInstanceOf(ExpenseResponseDto);
  });

  it('GET /events/:eventId/expenses/:id delega para expensesService.findOne()', async () => {
    const expense = row as never;
    service.findOne.mockResolvedValue(expense);

    const result = await controller.findOne(EVENT_ID, 'expense-1');

    expect(service.findOne).toHaveBeenCalledWith(EVENT_ID, 'expense-1');
    expect(result).toEqual(expense);
    expect(result).toBeInstanceOf(ExpenseResponseDto);
  });

  it('PATCH /events/:eventId/expenses/:id delega para expensesService.update()', async () => {
    const dto: UpdateExpenseDto = { quoted: true, paymentStatus: 'pago' };
    const updated = { ...row, quoted: true, paymentStatus: 'pago' } as never;
    service.update.mockResolvedValue(updated);

    const result = await controller.update(EVENT_ID, 'expense-1', dto);

    expect(service.update).toHaveBeenCalledWith(EVENT_ID, 'expense-1', dto);
    expect(result).toEqual(updated);
    expect(result).toBeInstanceOf(ExpenseResponseDto);
  });

  it('DELETE /events/:eventId/expenses/:id delega para expensesService.remove()', async () => {
    service.remove.mockResolvedValue(undefined);

    await controller.remove(EVENT_ID, 'expense-1');

    expect(service.remove).toHaveBeenCalledWith(EVENT_ID, 'expense-1');
  });
});
