import { jest } from '@jest/globals';
import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { events, tasks } from '../database/schema';
import { EventService } from '../event/event.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { TaskRepository } from './task.repository';
import { TaskService } from './task.service';

type Task = typeof tasks.$inferSelect;
type Event = typeof events.$inferSelect;

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    eventId: 'event-1',
    responsibleUserId: 'user-1',
    title: 'Contratar buffet',
    description: null,
    dueDate: new Date('2026-06-01T12:00:00Z'),
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'event-1',
    name: 'Festa Junina 2026',
    description: null,
    ageRating: null,
    organizerId: 'org-1',
    venueId: 'venue-1',
    startDate: new Date('2026-06-20T18:00:00Z'),
    endDate: new Date('2026-06-20T23:00:00Z'),
    salesStartDate: null,
    status: 'draft',
    category: null,
    edition: null,
    photoUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('TaskService', () => {
  let service: TaskService;
  let taskRepository: {
    findAll: jest.Mock<TaskRepository['findAll']>;
    findById: jest.Mock<TaskRepository['findById']>;
    create: jest.Mock<TaskRepository['create']>;
    update: jest.Mock<TaskRepository['update']>;
    delete: jest.Mock<TaskRepository['delete']>;
  };
  let eventService: {
    findOne: jest.Mock<EventService['findOne']>;
  };
  let usuariosService: {
    findOne: jest.Mock<UsuariosService['findOne']>;
  };

  beforeEach(async () => {
    taskRepository = {
      findAll: jest.fn<TaskRepository['findAll']>(),
      findById: jest.fn<TaskRepository['findById']>(),
      create: jest.fn<TaskRepository['create']>(),
      update: jest.fn<TaskRepository['update']>(),
      delete: jest.fn<TaskRepository['delete']>(),
    };
    eventService = {
      findOne: jest.fn<EventService['findOne']>(),
    };
    usuariosService = {
      findOne: jest.fn<UsuariosService['findOne']>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        { provide: TaskRepository, useValue: taskRepository },
        { provide: EventService, useValue: eventService },
        { provide: UsuariosService, useValue: usuariosService },
      ],
    }).compile();

    service = module.get(TaskService);
  });

  describe('findAll()', () => {
    it('repassa o evento e os filtros de status e responsável para o repositório', async () => {
      const rows = [makeTask()];
      eventService.findOne.mockResolvedValue(makeEvent());
      taskRepository.findAll.mockResolvedValue(rows);

      const result = await service.findAll('event-1', {
        status: 'pending',
        responsibleUserId: 'user-1',
      });

      expect(eventService.findOne).toHaveBeenCalledWith('event-1');
      expect(taskRepository.findAll).toHaveBeenCalledWith('event-1', {
        status: 'pending',
        responsibleUserId: 'user-1',
      });
      expect(result).toEqual(rows);
    });

    it('lança NotFound quando o evento não existe, em vez de lista vazia', async () => {
      eventService.findOne.mockRejectedValue(
        new NotFoundException('Evento event-1 não encontrado'),
      );

      await expect(service.findAll('event-1', {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(taskRepository.findAll).not.toHaveBeenCalled();
    });
  });

  describe('findOne()', () => {
    it('retorna a tarefa quando ela pertence ao evento', async () => {
      const task = makeTask();
      eventService.findOne.mockResolvedValue(makeEvent());
      taskRepository.findById.mockResolvedValue(task);

      await expect(service.findOne('event-1', 'task-1')).resolves.toEqual(task);
      expect(taskRepository.findById).toHaveBeenCalledWith('event-1', 'task-1');
    });

    it('lança NotFound quando a tarefa não existe no evento', async () => {
      eventService.findOne.mockResolvedValue(makeEvent());
      taskRepository.findById.mockResolvedValue(undefined);

      await expect(service.findOne('event-1', 'task-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('lança NotFound quando o evento não existe', async () => {
      eventService.findOne.mockRejectedValue(
        new NotFoundException('Evento event-1 não encontrado'),
      );

      await expect(service.findOne('event-1', 'task-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(taskRepository.findById).not.toHaveBeenCalled();
    });
  });

  describe('create()', () => {
    it('cria a tarefa no evento depois de validar evento e responsável', async () => {
      const created = makeTask();
      eventService.findOne.mockResolvedValue(makeEvent());
      usuariosService.findOne.mockResolvedValue({ id: 'user-1' });
      taskRepository.create.mockResolvedValue(created);

      const result = await service.create('event-1', {
        responsibleUserId: 'user-1',
        title: 'Contratar buffet',
      });

      expect(eventService.findOne).toHaveBeenCalledWith('event-1');
      expect(usuariosService.findOne).toHaveBeenCalledWith('user-1');
      expect(taskRepository.create).toHaveBeenCalledWith({
        eventId: 'event-1',
        responsibleUserId: 'user-1',
        title: 'Contratar buffet',
      });
      expect(result).toEqual(created);
    });

    it('lança NotFound e não cria quando o evento não existe', async () => {
      eventService.findOne.mockRejectedValue(
        new NotFoundException('Evento event-1 não encontrado'),
      );

      await expect(
        service.create('event-1', {
          responsibleUserId: 'user-1',
          title: 'Contratar buffet',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(taskRepository.create).not.toHaveBeenCalled();
    });

    it('lança NotFound com a mensagem da tarefa quando o responsável não existe', async () => {
      eventService.findOne.mockResolvedValue(makeEvent());
      usuariosService.findOne.mockRejectedValue(
        new NotFoundException('Usuário não encontrado.'),
      );

      await expect(
        service.create('event-1', {
          responsibleUserId: 'user-1',
          title: 'Contratar buffet',
        }),
      ).rejects.toThrow('Usuário user-1 não encontrado');
      expect(taskRepository.create).not.toHaveBeenCalled();
    });

    it('propaga erros inesperados ao validar o responsável', async () => {
      const failure = new Error('conexão perdida');
      eventService.findOne.mockResolvedValue(makeEvent());
      usuariosService.findOne.mockRejectedValue(failure);

      await expect(
        service.create('event-1', {
          responsibleUserId: 'user-1',
          title: 'Contratar buffet',
        }),
      ).rejects.toBe(failure);
    });

    it('recusa criar tarefa em evento cancelado', async () => {
      eventService.findOne.mockResolvedValue(
        makeEvent({ status: 'cancelled' }),
      );

      await expect(
        service.create('event-1', {
          responsibleUserId: 'user-1',
          title: 'Contratar buffet',
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(usuariosService.findOne).not.toHaveBeenCalled();
      expect(taskRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('update()', () => {
    it('atualiza o status da tarefa', async () => {
      const updated = makeTask({ status: 'done' });
      eventService.findOne.mockResolvedValue(makeEvent());
      taskRepository.findById.mockResolvedValue(makeTask());
      taskRepository.update.mockResolvedValue(updated);

      const result = await service.update('event-1', 'task-1', {
        status: 'done',
      });

      expect(taskRepository.update).toHaveBeenCalledWith('event-1', 'task-1', {
        status: 'done',
      });
      expect(usuariosService.findOne).not.toHaveBeenCalled();
      expect(result).toEqual(updated);
    });

    it('valida o novo responsável quando ele muda', async () => {
      eventService.findOne.mockResolvedValue(makeEvent());
      taskRepository.findById.mockResolvedValue(makeTask());
      usuariosService.findOne.mockResolvedValue({ id: 'user-2' });
      taskRepository.update.mockResolvedValue(
        makeTask({ responsibleUserId: 'user-2' }),
      );

      await service.update('event-1', 'task-1', {
        responsibleUserId: 'user-2',
      });

      expect(usuariosService.findOne).toHaveBeenCalledWith('user-2');
      expect(taskRepository.update).toHaveBeenCalled();
    });

    it('não atualiza quando o novo responsável não existe', async () => {
      eventService.findOne.mockResolvedValue(makeEvent());
      taskRepository.findById.mockResolvedValue(makeTask());
      usuariosService.findOne.mockRejectedValue(
        new NotFoundException('Usuário não encontrado.'),
      );

      await expect(
        service.update('event-1', 'task-1', { responsibleUserId: 'user-2' }),
      ).rejects.toThrow('Usuário user-2 não encontrado');
      expect(taskRepository.update).not.toHaveBeenCalled();
    });

    it('não revalida o responsável quando ele é o mesmo', async () => {
      eventService.findOne.mockResolvedValue(makeEvent());
      taskRepository.findById.mockResolvedValue(makeTask());
      taskRepository.update.mockResolvedValue(makeTask());

      await service.update('event-1', 'task-1', {
        responsibleUserId: 'user-1',
      });

      expect(usuariosService.findOne).not.toHaveBeenCalled();
    });

    it('lança NotFound quando a tarefa não existe no evento', async () => {
      eventService.findOne.mockResolvedValue(makeEvent());
      taskRepository.findById.mockResolvedValue(undefined);

      await expect(
        service.update('event-1', 'task-1', { status: 'done' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(taskRepository.update).not.toHaveBeenCalled();
    });

    it('recusa alterar tarefa de evento cancelado', async () => {
      eventService.findOne.mockResolvedValue(
        makeEvent({ status: 'cancelled' }),
      );

      await expect(
        service.update('event-1', 'task-1', { status: 'done' }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(taskRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove()', () => {
    it('apaga a tarefa do evento', async () => {
      eventService.findOne.mockResolvedValue(makeEvent());
      taskRepository.findById.mockResolvedValue(makeTask());
      taskRepository.delete.mockResolvedValue(undefined);

      await service.remove('event-1', 'task-1');

      expect(taskRepository.delete).toHaveBeenCalledWith('event-1', 'task-1');
    });

    it('lança NotFound e não apaga quando a tarefa não existe no evento', async () => {
      eventService.findOne.mockResolvedValue(makeEvent());
      taskRepository.findById.mockResolvedValue(undefined);

      await expect(service.remove('event-1', 'task-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(taskRepository.delete).not.toHaveBeenCalled();
    });

    it('lança NotFound quando o evento não existe', async () => {
      eventService.findOne.mockRejectedValue(
        new NotFoundException('Evento event-1 não encontrado'),
      );

      await expect(service.remove('event-1', 'task-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(taskRepository.delete).not.toHaveBeenCalled();
    });
  });
});
