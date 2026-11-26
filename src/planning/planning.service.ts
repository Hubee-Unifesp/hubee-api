import { Injectable } from '@nestjs/common';
import { EventService } from '../event/event.service';
import { calculatePlanningSummary } from './planning-summary';
import { PlanningRepository } from './planning.repository';

@Injectable()
export class PlanningService {
  constructor(
    private readonly planningRepository: PlanningRepository,
    private readonly eventService: EventService,
  ) {}

  /**
   * Resumo financeiro e break-even do evento. Sem `audience`, usa o público
   * esperado do evento (`expectedAudience`).
   */
  async getSummary(eventId: string, audience?: number) {
    // `findOne` já responde 404 (`Evento ${id} não encontrado`).
    const event = await this.eventService.findOne(eventId);

    const [expenses, lots] = await Promise.all([
      this.planningRepository.findExpenses(eventId),
      this.planningRepository.findLots(eventId),
    ]);

    return {
      expectedAudience: event.expectedAudience,
      ...calculatePlanningSummary({
        expenses,
        lots,
        audience: audience ?? event.expectedAudience,
      }),
    };
  }
}
