import { Injectable, NotFoundException } from '@nestjs/common';
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
    const event = await this.findEvent(eventId);

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

  private async findEvent(eventId: string) {
    try {
      return await this.eventService.findOne(eventId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(`Evento ${eventId} não encontrado`);
      }
      throw error;
    }
  }
}
