import { jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventService } from '../event/event.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { ExpensesRepository } from './expenses.repository';
import { InstallmentsRepository } from './installments/installments.repository';
import { calculateExpenseAmount, ExpensesService } from './expenses.service';

type ExpenseWithSupplier = NonNullable<
  Awaited<ReturnType<ExpensesRepository['findById']>>
>;

const EVENT_ID = 'event-1';

const makeExpense = (
  overrides: Partial<ExpenseWithSupplier> = {},
): ExpenseWithSupplier => ({
  id: 'expense-1',
  eventId: EVENT_ID,
  supplierId: 'fornecedor-1',
  supplierName: 'Som & Luz Ltda',
  description: 'Aluguel de som',
  group: 'fixed',
  category: 'Estrutura',
  quantity: 2,
  unitPrice: 750,
  amount: 1500,
  responsible: 'Ana',
  quoted: false,
  notes: null,
  dueDate: new Date('2026-10-01T00:00:00Z'),
  paymentStatus: 'pendente',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

describe('calculateExpenseAmount', () => {
  it('multiplica quantidade e valor unitário arredondando a 2 casas decimais', () => {
    expect(calculateExpenseAmount(3, 19.99)).toBe(59.97);
    expect(calculateExpenseAmount(0, 250)).toBe(0);
    expect(calculateExpenseAmount(2.5, 10.1)).toBe(25.25);
  });

  it('lança BadRequestException quando o total ultrapassa numeric(12,2)', () => {
    expect(() => calculateExpenseAmount(100_000, 200_000)).toThrow(
      BadRequestException,
    );
  });
});

describe('ExpensesService', () => {
  let service: ExpensesService;
  let expensesRepository: {
    findAll: jest.Mock<ExpensesRepository['findAll']>;
    findById: jest.Mock<ExpensesRepository['findById']>;
    create: jest.Mock<ExpensesRepository['create']>;
    update: jest.Mock<ExpensesRepository['update']>;
    delete: jest.Mock<ExpensesRepository['delete']>;
    createMany: jest.Mock<ExpensesRepository['createMany']>;
    transaction: jest.Mock<(callback: (tx: unknown) => unknown) => unknown>;
  };
  let eventService: { findOne: jest.Mock<EventService['findOne']> };
  let suppliersService: { findOne: jest.Mock<SuppliersService['findOne']> };
  let installmentsRepository: {
    transaction: jest.Mock<(callback: (tx: unknown) => unknown) => unknown>;
    lockExpense: jest.Mock<InstallmentsRepository['lockExpense']>;
    sumActiveAmount: jest.Mock<InstallmentsRepository['sumActiveAmount']>;
  };

  beforeEach(async () => {
    expensesRepository = {
      findAll: jest.fn<ExpensesRepository['findAll']>(),
      findById: jest.fn<ExpensesRepository['findById']>(),
      create: jest.fn<ExpensesRepository['create']>(),
      update: jest.fn<ExpensesRepository['update']>(),
      delete: jest.fn<ExpensesRepository['delete']>(),
      createMany: jest.fn<ExpensesRepository['createMany']>(),
      transaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback('tx'),
      ),
    };
    eventService = {
      findOne: jest.fn<EventService['findOne']>().mockResolvedValue({
        id: EVENT_ID,
      } as never),
    };
    suppliersService = {
      findOne: jest.fn<SuppliersService['findOne']>().mockResolvedValue({
        id: 'fornecedor-1',
      } as never),
    };

    installmentsRepository = {
      transaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback('tx'),
      ),
      lockExpense: jest.fn<InstallmentsRepository['lockExpense']>(),
      sumActiveAmount: jest
        .fn<InstallmentsRepository['sumActiveAmount']>()
        .mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        { provide: InstallmentsRepository, useValue: installmentsRepository },
        { provide: ExpensesRepository, useValue: expensesRepository },
        { provide: EventService, useValue: eventService },
        { provide: SuppliersService, useValue: suppliersService },
      ],
    }).compile();

    service = module.get(ExpensesService);
  });

  describe('createMany()', () => {
    const item = (overrides: Record<string, unknown> = {}) => ({
      description: 'Aluguel de som',
      group: 'fixed',
      category: 'Estrutura',
      quantity: 2,
      unitPrice: 750,
      ...overrides,
    });

    it('calcula amount de cada item e grava tudo numa transação', async () => {
      const rows = [makeExpense(), makeExpense({ id: 'expense-2' })];
      expensesRepository.createMany.mockResolvedValue(rows);

      const result = await service.createMany(EVENT_ID, [
        item(),
        item({ description: 'Gelo', quantity: undefined, unitPrice: 19.99 }),
      ]);

      expect(expensesRepository.transaction).toHaveBeenCalledTimes(1);
      expect(expensesRepository.createMany).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            eventId: EVENT_ID,
            description: 'Aluguel de som',
            quantity: 2,
            amount: 1500,
          }),
          expect.objectContaining({
            eventId: EVENT_ID,
            description: 'Gelo',
            quantity: 1,
            amount: 19.99,
          }),
        ],
        'tx',
      );
      expect(result).toEqual(rows);
    });

    it('indica o item inválido e não grava nada', async () => {
      await expect(
        service.createMany(EVENT_ID, [item(), item({ description: '' })]),
      ).rejects.toThrow('Item 2: A descrição da despesa é obrigatória.');
      expect(expensesRepository.createMany).not.toHaveBeenCalled();
    });

    it('rejeita campos fora do contrato, como amount', async () => {
      await expect(
        service.createMany(EVENT_ID, [item({ amount: 10 })]),
      ).rejects.toThrow(BadRequestException);
      expect(expensesRepository.createMany).not.toHaveBeenCalled();
    });

    it('indica o item cujo total estoura o limite', async () => {
      await expect(
        service.createMany(EVENT_ID, [
          item(),
          item(),
          item({ quantity: 100_000, unitPrice: 200_000 }),
        ]),
      ).rejects.toThrow(
        'Item 3: O valor total da despesa excede o limite permitido.',
      );
      expect(expensesRepository.createMany).not.toHaveBeenCalled();
    });

    it('responde 400 com o índice quando o fornecedor não existe', async () => {
      suppliersService.findOne.mockRejectedValue(new NotFoundException());
      const supplierId = '6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f';

      await expect(
        service.createMany(EVENT_ID, [item(), item({ supplierId })]),
      ).rejects.toThrow(`Item 2: fornecedor ${supplierId} não encontrado.`);
      expect(expensesRepository.createMany).not.toHaveBeenCalled();
    });

    it('lança NotFoundException quando o evento não existe', async () => {
      eventService.findOne.mockRejectedValue(new NotFoundException());

      await expect(service.createMany(EVENT_ID, [item()])).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll()', () => {
    it('delega ao repository com eventId e filtros opcionais', async () => {
      const rows = [makeExpense()];
      expensesRepository.findAll.mockResolvedValue(rows);

      const result = await service.findAll(EVENT_ID, {
        group: 'fixed',
        category: 'Estrutura',
        quoted: false,
        paymentStatus: 'pendente',
      });

      expect(eventService.findOne).toHaveBeenCalledWith(EVENT_ID);
      expect(expensesRepository.findAll).toHaveBeenCalledWith({
        eventId: EVENT_ID,
        group: 'fixed',
        category: 'Estrutura',
        quoted: false,
        paymentStatus: 'pendente',
      });
      expect(result).toEqual(rows);
    });

    it('lança NotFoundException quando o evento não existe', async () => {
      eventService.findOne.mockRejectedValue(new NotFoundException());

      await expect(service.findAll(EVENT_ID, {})).rejects.toThrow(
        `Evento ${EVENT_ID} não encontrado`,
      );
      expect(expensesRepository.findAll).not.toHaveBeenCalled();
    });
  });

  describe('findOne()', () => {
    it('retorna a expense quando pertence ao evento', async () => {
      const expense = makeExpense();
      expensesRepository.findById.mockResolvedValue(expense);

      await expect(service.findOne(EVENT_ID, 'expense-1')).resolves.toEqual(
        expense,
      );
    });

    it('lança NotFoundException quando a expense não existe', async () => {
      expensesRepository.findById.mockResolvedValue(undefined);

      await expect(service.findOne(EVENT_ID, 'expense-1')).rejects.toThrow(
        'Despesa expense-1 não encontrada',
      );
    });

    it('lança NotFoundException quando a expense pertence a outro evento', async () => {
      expensesRepository.findById.mockResolvedValue(
        makeExpense({ eventId: 'outro-evento' }),
      );

      await expect(service.findOne(EVENT_ID, 'expense-1')).rejects.toThrow(
        'Despesa expense-1 não encontrada',
      );
    });
  });

  describe('create()', () => {
    it('cria despesa sem fornecedor e sem data com quantity padrão 1 e amount calculado', async () => {
      const created = makeExpense({
        supplierId: null,
        supplierName: null,
        dueDate: null,
        quantity: 1,
        unitPrice: 450.25,
        amount: 450.25,
      });
      expensesRepository.create.mockResolvedValue(created);

      const result = await service.create(EVENT_ID, {
        description: 'Aluguel de som',
        group: 'fixed',
        category: 'Estrutura',
        unitPrice: 450.25,
      });

      expect(suppliersService.findOne).not.toHaveBeenCalled();
      expect(expensesRepository.create).toHaveBeenCalledWith({
        description: 'Aluguel de som',
        group: 'fixed',
        category: 'Estrutura',
        unitPrice: 450.25,
        eventId: EVENT_ID,
        quantity: 1,
        amount: 450.25,
      });
      expect(result).toEqual(created);
    });

    it('calcula amount com 2 casas decimais e valida fornecedor quando informado', async () => {
      const created = makeExpense({
        quantity: 3,
        unitPrice: 19.99,
        amount: 59.97,
      });
      expensesRepository.create.mockResolvedValue(created);

      await service.create(EVENT_ID, {
        supplierId: 'fornecedor-1',
        description: 'Gelo e copos',
        group: 'variable',
        category: 'Open',
        quantity: 3,
        unitPrice: 19.99,
      });

      expect(suppliersService.findOne).toHaveBeenCalledWith('fornecedor-1');
      expect(expensesRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: 3,
          unitPrice: 19.99,
          amount: 59.97,
        }),
      );
    });

    it('falha com NotFound se o fornecedor informado não existir', async () => {
      suppliersService.findOne.mockRejectedValue(new NotFoundException());

      await expect(
        service.create(EVENT_ID, {
          supplierId: 'fornecedor-x',
          description: 'Aluguel de som',
          group: 'fixed',
          category: 'Estrutura',
          unitPrice: 500,
        }),
      ).rejects.toThrow('Fornecedor fornecedor-x não encontrado');
      expect(expensesRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('update()', () => {
    it('atualiza apenas { quoted: true } sem recalcular amount nem tocar nos outros campos', async () => {
      expensesRepository.findById.mockResolvedValue(makeExpense());
      const updated = makeExpense({ quoted: true });
      expensesRepository.update.mockResolvedValue(updated);

      const result = await service.update(EVENT_ID, 'expense-1', {
        quoted: true,
      });

      expect(expensesRepository.update).toHaveBeenCalledWith('expense-1', {
        quoted: true,
      });
      expect(result).toEqual(updated);
    });

    it('recalcula amount quando só quantity ou só unitPrice muda', async () => {
      expensesRepository.findById.mockResolvedValue(
        makeExpense({ quantity: 2, unitPrice: 750, amount: 1500 }),
      );
      expensesRepository.update.mockResolvedValue(
        makeExpense({ quantity: 4, unitPrice: 750, amount: 3000 }),
      );

      await service.update(EVENT_ID, 'expense-1', { quantity: 4 });

      expect(expensesRepository.update).toHaveBeenCalledWith(
        'expense-1',
        { quantity: 4, amount: 3000 },
        'tx',
      );
    });

    it('recusa reduzir o valor abaixo da soma das parcelas', async () => {
      expensesRepository.findById.mockResolvedValue(
        makeExpense({ quantity: 2, unitPrice: 750, amount: 1500 }),
      );
      installmentsRepository.sumActiveAmount.mockResolvedValue(1200);

      await expect(
        service.update(EVENT_ID, 'expense-1', { quantity: 1 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(installmentsRepository.lockExpense).toHaveBeenCalledWith(
        'expense-1',
        'tx',
      );
      expect(expensesRepository.update).not.toHaveBeenCalled();
    });

    it('aceita reduzir o valor até a soma exata das parcelas', async () => {
      expensesRepository.findById.mockResolvedValue(
        makeExpense({ quantity: 2, unitPrice: 750, amount: 1500 }),
      );
      expensesRepository.update.mockResolvedValue(makeExpense());
      installmentsRepository.sumActiveAmount.mockResolvedValue(750);

      await service.update(EVENT_ID, 'expense-1', { quantity: 1 });

      expect(expensesRepository.update).toHaveBeenCalledWith(
        'expense-1',
        { quantity: 1, amount: 750 },
        'tx',
      );
    });

    it('valida novo fornecedor quando informado e permite limpar com null', async () => {
      expensesRepository.findById.mockResolvedValue(makeExpense());
      expensesRepository.update.mockResolvedValue(
        makeExpense({ supplierId: null, supplierName: null }),
      );

      await service.update(EVENT_ID, 'expense-1', { supplierId: null });

      expect(suppliersService.findOne).not.toHaveBeenCalled();
      expect(expensesRepository.update).toHaveBeenCalledWith('expense-1', {
        supplierId: null,
      });

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
