import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { CreateOrganizationEventDto } from './dto/create-organization-event.dto';
import { OrganizationEventController } from './organization-event.controller';
import { OrganizationEventService } from './organization-event.service';
import { OrganizationEventResponseDto } from './dto/organization-event-response.dto';

/** Linha completa do banco, como o service a retorna. */
const row = {
  organizationId: 'org-1',
  eventId: 'event-1',
  role: 'co_organizer' as const,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

describe('OrganizationEventController', () => {
  let controller: OrganizationEventController;
  let service: {
    findAll: jest.Mock<OrganizationEventService['findAll']>;
    create: jest.Mock<OrganizationEventService['create']>;
    remove: jest.Mock<OrganizationEventService['remove']>;
  };

  beforeEach(async () => {
    service = {
      findAll: jest.fn<OrganizationEventService['findAll']>(),
      create: jest.fn<OrganizationEventService['create']>(),
      remove: jest.fn<OrganizationEventService['remove']>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationEventController],
      providers: [{ provide: OrganizationEventService, useValue: service }],
    }).compile();

    controller = module.get(OrganizationEventController);
  });

  it('POST /events/:eventId/organizations delega para o service', async () => {
    const dto: CreateOrganizationEventDto = {
      organizationId: 'org-1',
      role: 'co_organizer',
    };
    const created = row as never;
    service.create.mockResolvedValue(created);

    const result = await controller.create('event-1', dto);

    expect(service.create).toHaveBeenCalledWith('event-1', dto);
    expect(result).toEqual(created);
    expect(result).toBeInstanceOf(OrganizationEventResponseDto);
  });

  it('GET /events/:eventId/organizations delega para o service', async () => {
    const list = [row] as never;
    service.findAll.mockResolvedValue(list);

    const result = await controller.findAll('event-1');

    expect(service.findAll).toHaveBeenCalledWith('event-1');
    expect(result).toEqual(list);
    expect(result[0]).toBeInstanceOf(OrganizationEventResponseDto);
  });

  it('DELETE /events/:eventId/organizations/:orgId delega para o service', async () => {
    service.remove.mockResolvedValue(undefined);

    await controller.remove('event-1', 'org-1');

    expect(service.remove).toHaveBeenCalledWith('event-1', 'org-1');
  });
});
