import { Injectable, NotFoundException } from '@nestjs/common';
import { EventService } from '../event/event.service';
import { FornecedoresService } from '../fornecedores/fornecedores.service';
import { CreateDespesaDto } from './dto/create-despesa.dto';
import { QueryDespesaDto } from './dto/query-despesa.dto';
import { UpdateDespesaDto } from './dto/update-despesa.dto';
import { DespesasRepository } from './despesas.repository';

@Injectable()
export class DespesasService {
  constructor(
    private readonly despesasRepository: DespesasRepository,
    private readonly eventService: EventService,
    private readonly fornecedoresService: FornecedoresService,
  ) {}

  async findAll(eventId: string, query: QueryDespesaDto) {
    await this.ensureEventExists(eventId);

    return this.despesasRepository.findAll({
      eventId,
      paymentStatus: query.paymentStatus,
    });
  }

  async findOne(eventId: string, id: string) {
    await this.ensureEventExists(eventId);

    const despesa = await this.despesasRepository.findById(id);
    // Também valida que a despesa pertence ao evento da rota: sem isso, um ID
    // válido de outro evento vazaria dados entre eventos diferentes.
    if (!despesa || despesa.eventId !== eventId) {
      throw new NotFoundException(`Despesa ${id} não encontrada`);
    }

    return despesa;
  }

  async create(eventId: string, dto: CreateDespesaDto) {
    await this.ensureEventExists(eventId);
    await this.ensureFornecedorExists(dto.fornecedorId);

    return this.despesasRepository.create({ ...dto, eventId });
  }

  async update(eventId: string, id: string, dto: UpdateDespesaDto) {
    await this.findOne(eventId, id);

    if (dto.fornecedorId) {
      await this.ensureFornecedorExists(dto.fornecedorId);
    }

    return this.despesasRepository.update(id, dto);
  }

  async remove(eventId: string, id: string): Promise<void> {
    await this.findOne(eventId, id);
    await this.despesasRepository.delete(id);
  }

  /**
   * A FK garante que o evento existe, mas só na hora do INSERT: sem esta
   * checagem prévia o erro do Postgres subiria como 500 em vez de 404.
   */
  private async ensureEventExists(eventId: string): Promise<void> {
    try {
      await this.eventService.findOne(eventId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(`Evento ${eventId} não encontrado`);
      }
      throw error;
    }
  }

  private async ensureFornecedorExists(fornecedorId: string): Promise<void> {
    try {
      await this.fornecedoresService.findOne(fornecedorId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(
          `Fornecedor ${fornecedorId} não encontrado`,
        );
      }
      throw error;
    }
  }
}
