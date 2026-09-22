import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';

describe('TaskController', () => {
  let controller: TaskController;
  let service: {
    findAll: jest.Mock<TaskService['findAll']>;
    findOne: jest.Mock<TaskService['findOne']>;
    create: jest.Mock<TaskService['create']>;
    update: jest.Mock<TaskService['update']>;
    remove: jest.Mock<TaskService['remove']>;
  };

  beforeEach(async () => {
    service = {
      findAll: jest.fn<TaskService['findAll']>(),
      findOne: jest.fn<TaskService['findOne']>(),
      create: jest.fn<TaskService['create']>(),
      update: jest.fn<TaskService['update']>(),
      remove: jest.fn<TaskService['remove']>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskController],
      providers: [{ provide: TaskService, useValue: service }],
    }).compile();

    controller = module.get(TaskController);
  });

  it('POST /eventos/:eventId/tarefas delega para taskService.create()', async () => {
    const dto: CreateTaskDto = {
      responsibleUserId: 'user-1',
      title: 'Contratar buffet',
    };
    const created = { id: 'task-1', ...dto } as never;
    service.create.mockResolvedValue(created);

    const result = await controller.create('event-1', dto);

    expect(service.create).toHaveBeenCalledWith('event-1', dto);
    expect(result).toEqual(created);
  });

  it('GET /eventos/:eventId/tarefas delega para taskService.findAll() com os filtros da query', async () => {
    const list = [{ id: 'task-1' }] as never;
    service.findAll.mockResolvedValue(list);

    const result = await controller.findAll('event-1', {
      status: 'in_progress',
      responsibleUserId: 'user-1',
    });

    expect(service.findAll).toHaveBeenCalledWith('event-1', {
      status: 'in_progress',
      responsibleUserId: 'user-1',
    });
    expect(result).toEqual(list);
  });

  it('GET /eventos/:eventId/tarefas/:id delega para taskService.findOne()', async () => {
    const task = { id: 'task-1' } as never;
    service.findOne.mockResolvedValue(task);

    const result = await controller.findOne('event-1', 'task-1');

    expect(service.findOne).toHaveBeenCalledWith('event-1', 'task-1');
    expect(result).toEqual(task);
  });

  it('PATCH /eventos/:eventId/tarefas/:id delega para taskService.update()', async () => {
    const dto: UpdateTaskDto = { status: 'done' };
    const updated = { id: 'task-1', ...dto } as never;
    service.update.mockResolvedValue(updated);

    const result = await controller.update('event-1', 'task-1', dto);

    expect(service.update).toHaveBeenCalledWith('event-1', 'task-1', dto);
    expect(result).toEqual(updated);
  });

  it('DELETE /eventos/:eventId/tarefas/:id delega para taskService.remove()', async () => {
    service.remove.mockResolvedValue(undefined);

    await controller.remove('event-1', 'task-1');

    expect(service.remove).toHaveBeenCalledWith('event-1', 'task-1');
  });
});
