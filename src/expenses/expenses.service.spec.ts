import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { expenses } from '../database/schema';
import { EventService } from '../event/event.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { ExpensesRepository } from './expenses.repository';
import { ExpensesService } from './expenses.service';

type Expense = typeof expenses.$inferSelect;

const EVENT_ID = 'event-1';
const SUPPLIER_ID = 'fornecedor-1';

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'expense-1',
    eventId: EVENT_ID,
    supplierId: SUPPLIER_ID,
    description: 'Aluguel de som e luz',
    amount: 1500,
    costType: 'infraestrutura',
    dueDate: new Date('2026-10-01T00:00:00Z'),
    paymentStatus: 'pendente',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('ExpensesService', () => {
  let service: ExpensesService;
  let expensesRepository: {
    findAll: jest.Mock<ExpensesRepository['findAll']>;
    findById: jest.Mock<ExpensesRepository['findById']>;
    create: jest.Mock<ExpensesRepository['create']>;
    update: jest.Mock<ExpensesRepository['update']>;
    delete: jest.Mock<ExpensesRepository['delete']>;
  };
  let eventService: { findOne: jest.Mock<EventService['findOne']> };
  let suppliersService: {
    findOne: jest.Mock<SuppliersService['findOne']>;
  };

  beforeEach(async () => {
    expensesRepository = {
      findAll: jest.fn<ExpensesRepository['findAll']>(),
      findById: jest.fn<ExpensesRepository['findById']>(),
      create: jest.fn<ExpensesRepository['create']>(),
      update: jest.fn<ExpensesRepository['update']>(),
      delete: jest.fn<ExpensesRepository['delete']>(),
    };
    eventService = { findOne: jest.fn<EventService['findOne']>() };
    suppliersService = {
      findOne: jest.fn<SuppliersService['findOne']>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        { provide: ExpensesRepository, useValue: expensesRepository },
        { provide: EventService, useValue: eventService },
        { provide: SuppliersService, useValue: suppliersService },
      ],
    }).compile();

    service = module.get(ExpensesService);

    eventService.findOne.mockResolvedValue({ id: EVENT_ID } as never);
    suppliersService.findOne.mockResolvedValue({
      id: SUPPLIER_ID,
    } as never);
  });

  describe('findAll()', () => {
    it('valida o evento e repassa eventId + status de pagamento para o repositório', async () => {
      const rows = [makeExpense()];
      expensesRepository.findAll.mockResolvedValue(rows);

      const result = await service.findAll(EVENT_ID, {
        paymentStatus: 'pendente',
      });

      expect(eventService.findOne).toHaveBeenCalledWith(EVENT_ID);
      expect(expensesRepository.findAll).toHaveBeenCalledWith({
        eventId: EVENT_ID,
        paymentStatus: 'pendente',
      });
      expect(result).toEqual(rows);
    });

    it('lança NotFound quando o evento não existe', async () => {
      eventService.findOne.mockRejectedValue(new NotFoundException());

      await expect(service.findAll(EVENT_ID, {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(expensesRepository.findAll).not.toHaveBeenCalled();
    });
  });

  describe('findOne()', () => {
    it('retorna a expense quando ela existe e pertence ao evento', async () => {
      const expense = makeExpense();
      expensesRepository.findById.mockResolvedValue(expense);

      await expect(service.findOne(EVENT_ID, 'expense-1')).resolves.toEqual(
        expense,
      );
    });

    it('lança NotFound quando a expense não existe', async () => {
      expensesRepository.findById.mockResolvedValue(undefined);

      await expect(
        service.findOne(EVENT_ID, 'expense-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lança NotFound quando a expense pertence a outro evento', async () => {
      expensesRepository.findById.mockResolvedValue(
        makeExpense({ eventId: 'outro-evento' }),
      );

      await expect(
        service.findOne(EVENT_ID, 'expense-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('create()', () => {
    const dto = {
      supplierId: SUPPLIER_ID,
      description: 'Aluguel de som e luz',
      amount: 1500,
      costType: 'infraestrutura',
      dueDate: new Date('2026-10-01T00:00:00Z'),
    };

    it('cria a expense depois de confirmar evento e fornecedor', async () => {
      const created = makeExpense();
      expensesRepository.create.mockResolvedValue(created);

      const result = await service.create(EVENT_ID, dto);

      expect(eventService.findOne).toHaveBeenCalledWith(EVENT_ID);
      expect(suppliersService.findOne).toHaveBeenCalledWith(SUPPLIER_ID);
      expect(expensesRepository.create).toHaveBeenCalledWith({
        ...dto,
        eventId: EVENT_ID,
      });
      expect(result).toEqual(created);
    });

    it('lança NotFound e não cria quando o evento não existe', async () => {
      eventService.findOne.mockRejectedValue(new NotFoundException());

      await expect(service.create(EVENT_ID, dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(expensesRepository.create).not.toHaveBeenCalled();
    });

    it('lança NotFound e não cria quando o fornecedor não existe', async () => {
      suppliersService.findOne.mockRejectedValue(new NotFoundException());

      await expect(service.create(EVENT_ID, dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(expensesRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('update()', () => {
    it('atualiza o status de pagamento de uma expense existente', async () => {
      expensesRepository.findById.mockResolvedValue(makeExpense());
      const updated = makeExpense({ paymentStatus: 'pago' });
      expensesRepository.update.mockResolvedValue(updated);

      const result = await service.update(EVENT_ID, 'expense-1', {
        paymentStatus: 'pago',
      });

      expect(expensesRepository.update).toHaveBeenCalledWith('expense-1', {
        paymentStatus: 'pago',
      });
      expect(result).toEqual(updated);
    });

    it('valida o novo fornecedor quando supplierId é alterado', async () => {
      expensesRepository.findById.mockResolvedValue(makeExpense());
      expensesRepository.update.mockResolvedValue(makeExpense());

      await service.update(EVENT_ID, 'expense-1', {
        supplierId: 'novo-fornecedor',
      });

      expect(suppliersService.findOne).toHaveBeenCalledWith('novo-fornecedor');
    });

    it('lança NotFound e não escreve quando a expense não existe', async () => {
      expensesRepository.findById.mockResolvedValue(undefined);

      await expect(
        service.update(EVENT_ID, 'expense-1', { paymentStatus: 'pago' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(expensesRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove()', () => {
    it('remove a expense existente', async () => {
      expensesRepository.findById.mockResolvedValue(makeExpense());

      await service.remove(EVENT_ID, 'expense-1');

      expect(expensesRepository.delete).toHaveBeenCalledWith('expense-1');
    });

    it('lança NotFound e não remove quando a expense não existe', async () => {
      expensesRepository.findById.mockResolvedValue(undefined);

      await expect(
        service.remove(EVENT_ID, 'expense-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(expensesRepository.delete).not.toHaveBeenCalled();
    });
  });
});
