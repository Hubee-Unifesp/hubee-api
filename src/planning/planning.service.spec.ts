import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import type { EventService } from '../event/event.service';
import type { PlanningRepository } from './planning.repository';
import { PlanningService } from './planning.service';

describe('PlanningService', () => {
  let service: PlanningService;
  let repository: {
    findExpenses: jest.Mock<PlanningRepository['findExpenses']>;
    findLots: jest.Mock<PlanningRepository['findLots']>;
  };
  let eventService: { findOne: jest.Mock<(id: string) => Promise<unknown>> };

  beforeEach(() => {
    repository = {
      findExpenses: jest.fn<PlanningRepository['findExpenses']>(),
      findLots: jest.fn<PlanningRepository['findLots']>(),
    };
    eventService = { findOne: jest.fn<(id: string) => Promise<unknown>>() };
    service = new PlanningService(
      repository as unknown as PlanningRepository,
      eventService as unknown as EventService,
    );

    repository.findExpenses.mockResolvedValue([
      {
        group: 'fixed',
        category: 'Estrutura',
        amount: 1000,
        quoted: true,
        paymentStatus: 'pendente',
      },
    ]);
    repository.findLots.mockResolvedValue([
      {
        id: 'lot-1',
        batch: '1º Lote',
        price: 20,
        quantity: 100,
        modality: 'inteira' as const,
        salesStartDate: null,
      },
    ]);
  });

  it('usa o público esperado do evento quando a query não traz audience', async () => {
    eventService.findOne.mockResolvedValue({ expectedAudience: 100 });

    const summary = await service.getSummary('event-1');

    expect(repository.findExpenses).toHaveBeenCalledWith('event-1');
    expect(repository.findLots).toHaveBeenCalledWith('event-1');
    expect(summary.expectedAudience).toBe(100);
    expect(summary.result).toMatchObject({
      audience: 100,
      revenue: 2000,
      breakEven: 50,
      profit: 1000,
    });
  });

  it('o audience da query tem prioridade sobre o público esperado', async () => {
    eventService.findOne.mockResolvedValue({ expectedAudience: 100 });

    const summary = await service.getSummary('event-1', 40);

    expect(summary.expectedAudience).toBe(100);
    expect(summary.result.audience).toBe(40);
    expect(summary.scenarios.map((s) => s.audience)).toEqual([20, 40, 60, 80]);
  });

  it('sem público esperado nem audience, o resultado vem com campos null', async () => {
    eventService.findOne.mockResolvedValue({ expectedAudience: null });

    const summary = await service.getSummary('event-1');

    expect(summary.result.audience).toBeNull();
    expect(summary.result.breakEven).toBeNull();
    expect(summary.scenarios).toEqual([]);
  });

  it('responde 404 quando o evento não existe', async () => {
    eventService.findOne.mockRejectedValue(new NotFoundException());

    await expect(service.getSummary('event-x')).rejects.toThrow(
      'Evento event-x não encontrado',
    );
    expect(repository.findExpenses).not.toHaveBeenCalled();
  });
});
