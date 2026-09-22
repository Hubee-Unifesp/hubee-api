import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EventService } from '../event/event.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { FindAllTasksFilters, TaskRepository } from './task.repository';

@Injectable()
export class TaskService {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly eventService: EventService,
    private readonly usuariosService: UsuariosService,
  ) {}

  /** Consulta o evento antes para que um evento inexistente dê 404, e não `[]`. */
  async findAll(eventId: string, filters: FindAllTasksFilters) {
    await this.eventService.findOne(eventId);
    return this.taskRepository.findAll(eventId, filters);
  }

  async findOne(eventId: string, id: string) {
    await this.eventService.findOne(eventId);
    return this.findTaskOfEvent(eventId, id);
  }

  async create(eventId: string, dto: CreateTaskDto) {
    await this.ensureEventAcceptsChanges(eventId);
    await this.ensureUserExists(dto.responsibleUserId);

    return this.taskRepository.create({ ...dto, eventId });
  }

  async update(eventId: string, id: string, dto: UpdateTaskDto) {
    await this.ensureEventAcceptsChanges(eventId);
    const task = await this.findTaskOfEvent(eventId, id);

    if (
      dto.responsibleUserId &&
      dto.responsibleUserId !== task.responsibleUserId
    ) {
      await this.ensureUserExists(dto.responsibleUserId);
    }

    return this.taskRepository.update(eventId, id, dto);
  }

  /**
   * Diferente de evento e pedido, a tarefa é apagada de fato: é um item de
   * checklist interno, sem valor de auditoria depois de removido.
   */
  async remove(eventId: string, id: string): Promise<void> {
    await this.eventService.findOne(eventId);
    await this.findTaskOfEvent(eventId, id);
    await this.taskRepository.delete(eventId, id);
  }

  private async findTaskOfEvent(eventId: string, id: string) {
    const task = await this.taskRepository.findById(eventId, id);
    if (!task) {
      throw new NotFoundException(`Tarefa ${id} não encontrada`);
    }
    return task;
  }

  /** Evento cancelado fica congelado, na mesma regra de `EventService.update`. */
  private async ensureEventAcceptsChanges(eventId: string): Promise<void> {
    const event = await this.eventService.findOne(eventId);

    if (event.status === 'cancelled') {
      throw new UnprocessableEntityException(
        'Tarefas de evento cancelado não podem ser criadas ou alteradas',
      );
    }
  }

  /**
   * A FK garante que o responsável existe, mas só na hora do INSERT: sem esta
   * checagem o erro do Postgres subiria como 500 em vez de 404. Também barra
   * usuários removidos logicamente, que a FK aceitaria.
   */
  private async ensureUserExists(userId: string): Promise<void> {
    try {
      await this.usuariosService.findOne(userId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(`Usuário ${userId} não encontrado`);
      }
      throw error;
    }
  }
}
