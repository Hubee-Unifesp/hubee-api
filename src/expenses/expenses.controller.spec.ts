import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';

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
      controllers: [ExpensesController],
      providers: [{ provide: ExpensesService, useValue: service }],
    }).compile();

    controller = module.get(ExpensesController);
  });

  it('POST /events/:eventId/expenses delega para expensesService.create()', async () => {
    const dto: CreateExpenseDto = {
      supplierId: 'fornecedor-1',
      description: 'Aluguel de som e luz',
      amount: 1500,
      costType: 'infraestrutura',
      dueDate: new Date('2026-10-01T00:00:00Z'),
    };
    const created = { id: 'expense-1', eventId: EVENT_ID, ...dto } as never;
    service.create.mockResolvedValue(created);

    const result = await controller.create(EVENT_ID, dto);

    expect(service.create).toHaveBeenCalledWith(EVENT_ID, dto);
    expect(result).toEqual(created);
  });

  it('GET /events/:eventId/expenses delega para expensesService.findAll() com os filtros da query', async () => {
    const list = [{ id: 'expense-1' }] as never;
    service.findAll.mockResolvedValue(list);

    const result = await controller.findAll(EVENT_ID, {
      paymentStatus: 'pendente',
    });

    expect(service.findAll).toHaveBeenCalledWith(EVENT_ID, {
      paymentStatus: 'pendente',
    });
    expect(result).toEqual(list);
  });

  it('GET /events/:eventId/expenses/:id delega para expensesService.findOne()', async () => {
    const expense = { id: 'expense-1' } as never;
    service.findOne.mockResolvedValue(expense);

    const result = await controller.findOne(EVENT_ID, 'expense-1');

    expect(service.findOne).toHaveBeenCalledWith(EVENT_ID, 'expense-1');
    expect(result).toEqual(expense);
  });

  it('PATCH /events/:eventId/expenses/:id delega para expensesService.update()', async () => {
    const dto: UpdateExpenseDto = { paymentStatus: 'pago' };
    const updated = { id: 'expense-1', ...dto } as never;
    service.update.mockResolvedValue(updated);

    const result = await controller.update(EVENT_ID, 'expense-1', dto);

    expect(service.update).toHaveBeenCalledWith(EVENT_ID, 'expense-1', dto);
    expect(result).toEqual(updated);
  });

  it('DELETE /events/:eventId/expenses/:id delega para expensesService.remove()', async () => {
    service.remove.mockResolvedValue(undefined);

    await controller.remove(EVENT_ID, 'expense-1');

    expect(service.remove).toHaveBeenCalledWith(EVENT_ID, 'expense-1');
  });
});
