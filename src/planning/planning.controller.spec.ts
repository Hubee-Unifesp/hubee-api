import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { DRIZZLE } from '../database/database.constants';
import { PlanningSummaryResponseDto } from './dto/planning-summary-response.dto';
import { calculatePlanningSummary } from './planning-summary';
import { PlanningController } from './planning.controller';
import { PlanningService } from './planning.service';

describe('PlanningController', () => {
  let controller: PlanningController;
  let service: { getSummary: jest.Mock<PlanningService['getSummary']> };

  beforeEach(async () => {
    service = { getSummary: jest.fn<PlanningService['getSummary']>() };

    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      controllers: [PlanningController],
      providers: [
        { provide: PlanningService, useValue: service },
        { provide: DRIZZLE, useValue: {} },
      ],
    }).compile();

    controller = module.get(PlanningController);
  });

  it('GET /events/:eventId/planning/summary delega para o service com o público da query', async () => {
    const summary = {
      expectedAudience: 300,
      ...calculatePlanningSummary({
        expenses: [],
        lots: [
          {
            id: 'lot-1',
            batch: '1º Lote',
            price: 50,
            quantity: 300,
            salesStartDate: null,
          },
        ],
        audience: 320,
      }),
    };
    service.getSummary.mockResolvedValue(summary);

    const result = await controller.getSummary('event-1', { audience: 320 });

    expect(service.getSummary).toHaveBeenCalledWith('event-1', 320);
    expect(result).toBeInstanceOf(PlanningSummaryResponseDto);
    expect(result).toEqual(summary);
  });
});
