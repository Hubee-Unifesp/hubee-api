import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { despesas } from '../database/schema';
import { EventService } from '../event/event.service';
import { FornecedoresService } from '../fornecedores/fornecedores.service';
import { DespesasRepository } from './despesas.repository';
import { DespesasService } from './despesas.service';

type Despesa = typeof despesas.$inferSelect;

const EVENT_ID = 'event-1';
const FORNECEDOR_ID = 'fornecedor-1';

function makeDespesa(overrides: Partial<Despesa> = {}): Despesa {
  return {
    id: 'despesa-1',
    eventId: EVENT_ID,
    fornecedorId: FORNECEDOR_ID,
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

describe('DespesasService', () => {
  let service: DespesasService;
  let despesasRepository: {
    findAll: jest.Mock<DespesasRepository['findAll']>;
    findById: jest.Mock<DespesasRepository['findById']>;
    create: jest.Mock<DespesasRepository['create']>;
    update: jest.Mock<DespesasRepository['update']>;
    delete: jest.Mock<DespesasRepository['delete']>;
  };
  let eventService: { findOne: jest.Mock<EventService['findOne']> };
  let fornecedoresService: {
    findOne: jest.Mock<FornecedoresService['findOne']>;
  };

  beforeEach(async () => {
    despesasRepository = {
      findAll: jest.fn<DespesasRepository['findAll']>(),
      findById: jest.fn<DespesasRepository['findById']>(),
      create: jest.fn<DespesasRepository['create']>(),
      update: jest.fn<DespesasRepository['update']>(),
      delete: jest.fn<DespesasRepository['delete']>(),
    };
    eventService = { findOne: jest.fn<EventService['findOne']>() };
    fornecedoresService = {
      findOne: jest.fn<FornecedoresService['findOne']>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DespesasService,
        { provide: DespesasRepository, useValue: despesasRepository },
        { provide: EventService, useValue: eventService },
        { provide: FornecedoresService, useValue: fornecedoresService },
      ],
    }).compile();

    service = module.get(DespesasService);

    eventService.findOne.mockResolvedValue({ id: EVENT_ID } as never);
    fornecedoresService.findOne.mockResolvedValue({
      id: FORNECEDOR_ID,
    } as never);
  });

  describe('findAll()', () => {
    it('valida o evento e repassa eventId + status de pagamento para o repositório', async () => {
      const rows = [makeDespesa()];
      despesasRepository.findAll.mockResolvedValue(rows);

      const result = await service.findAll(EVENT_ID, {
        paymentStatus: 'pendente',
      });

      expect(eventService.findOne).toHaveBeenCalledWith(EVENT_ID);
      expect(despesasRepository.findAll).toHaveBeenCalledWith({
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
      expect(despesasRepository.findAll).not.toHaveBeenCalled();
    });
  });

  describe('findOne()', () => {
    it('retorna a despesa quando ela existe e pertence ao evento', async () => {
      const despesa = makeDespesa();
      despesasRepository.findById.mockResolvedValue(despesa);

      await expect(service.findOne(EVENT_ID, 'despesa-1')).resolves.toEqual(
        despesa,
      );
    });

    it('lança NotFound quando a despesa não existe', async () => {
      despesasRepository.findById.mockResolvedValue(undefined);

      await expect(
        service.findOne(EVENT_ID, 'despesa-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lança NotFound quando a despesa pertence a outro evento', async () => {
      despesasRepository.findById.mockResolvedValue(
        makeDespesa({ eventId: 'outro-evento' }),
      );

      await expect(
        service.findOne(EVENT_ID, 'despesa-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('create()', () => {
    const dto = {
      fornecedorId: FORNECEDOR_ID,
      description: 'Aluguel de som e luz',
      amount: 1500,
      costType: 'infraestrutura',
      dueDate: new Date('2026-10-01T00:00:00Z'),
    };

    it('cria a despesa depois de confirmar evento e fornecedor', async () => {
      const created = makeDespesa();
      despesasRepository.create.mockResolvedValue(created);

      const result = await service.create(EVENT_ID, dto);

      expect(eventService.findOne).toHaveBeenCalledWith(EVENT_ID);
      expect(fornecedoresService.findOne).toHaveBeenCalledWith(FORNECEDOR_ID);
      expect(despesasRepository.create).toHaveBeenCalledWith({
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
      expect(despesasRepository.create).not.toHaveBeenCalled();
    });

    it('lança NotFound e não cria quando o fornecedor não existe', async () => {
      fornecedoresService.findOne.mockRejectedValue(new NotFoundException());

      await expect(service.create(EVENT_ID, dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(despesasRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('update()', () => {
    it('atualiza o status de pagamento de uma despesa existente', async () => {
      despesasRepository.findById.mockResolvedValue(makeDespesa());
      const updated = makeDespesa({ paymentStatus: 'pago' });
      despesasRepository.update.mockResolvedValue(updated);

      const result = await service.update(EVENT_ID, 'despesa-1', {
        paymentStatus: 'pago',
      });

      expect(despesasRepository.update).toHaveBeenCalledWith('despesa-1', {
        paymentStatus: 'pago',
      });
      expect(result).toEqual(updated);
    });

    it('valida o novo fornecedor quando fornecedorId é alterado', async () => {
      despesasRepository.findById.mockResolvedValue(makeDespesa());
      despesasRepository.update.mockResolvedValue(makeDespesa());

      await service.update(EVENT_ID, 'despesa-1', {
        fornecedorId: 'novo-fornecedor',
      });

      expect(fornecedoresService.findOne).toHaveBeenCalledWith(
        'novo-fornecedor',
      );
    });

    it('lança NotFound e não escreve quando a despesa não existe', async () => {
      despesasRepository.findById.mockResolvedValue(undefined);

      await expect(
        service.update(EVENT_ID, 'despesa-1', { paymentStatus: 'pago' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(despesasRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove()', () => {
    it('remove a despesa existente', async () => {
      despesasRepository.findById.mockResolvedValue(makeDespesa());

      await service.remove(EVENT_ID, 'despesa-1');

      expect(despesasRepository.delete).toHaveBeenCalledWith('despesa-1');
    });

    it('lança NotFound e não remove quando a despesa não existe', async () => {
      despesasRepository.findById.mockResolvedValue(undefined);

      await expect(
        service.remove(EVENT_ID, 'despesa-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(despesasRepository.delete).not.toHaveBeenCalled();
    });
  });
});
