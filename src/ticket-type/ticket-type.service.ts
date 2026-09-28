import { Injectable, NotFoundException } from '@nestjs/common';
import { EventService } from '../event/event.service';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import { UpdateTicketTypeDto } from './dto/update-ticket-type.dto';
import { TicketTypeRepository } from './ticket-type.repository';

@Injectable()
export class TicketTypeService {
  constructor(
    private readonly ticketTypeRepository: TicketTypeRepository,
    private readonly eventService: EventService,
  ) {}

  /** Consulta o evento antes para que um evento inexistente dê 404, e não `[]`. */
  async findAll(eventId: string) {
    await this.eventService.findOne(eventId);
    return this.ticketTypeRepository.findAll(eventId);
  }

  async findOne(eventId: string, id: string) {
    await this.eventService.findOne(eventId);
    return this.findTicketTypeOfEvent(eventId, id);
  }

  async create(eventId: string, dto: CreateTicketTypeDto) {
    await this.eventService.findOne(eventId);
    return this.ticketTypeRepository.create({ ...dto, eventId });
  }

  async update(eventId: string, id: string, dto: UpdateTicketTypeDto) {
    await this.eventService.findOne(eventId);
    await this.findTicketTypeOfEvent(eventId, id);

    return this.ticketTypeRepository.update(eventId, id, dto);
  }

  async remove(eventId: string, id: string): Promise<void> {
    await this.eventService.findOne(eventId);
    await this.findTicketTypeOfEvent(eventId, id);
    await this.ticketTypeRepository.delete(eventId, id);
  }

  private async findTicketTypeOfEvent(eventId: string, id: string) {
    const ticketType = await this.ticketTypeRepository.findById(eventId, id);
    if (!ticketType) {
      throw new NotFoundException(`Tipo de ingresso ${id} não encontrado`);
    }
    return ticketType;
  }
}
