import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { CreateOrganizationEventDto } from './dto/create-organization-event.dto';
import { OrganizationEventController } from './organization-event.controller';
import { OrganizationEventService } from './organization-event.service';

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

  it('POST /eventos/:eventId/organizacoes delega para o service', async () => {
    const dto: CreateOrganizationEventDto = {
      organizationId: 'org-1',
      role: 'co_organizer',
    };
    const created = { eventId: 'event-1', ...dto } as never;
    service.create.mockResolvedValue(created);

    const result = await controller.create('event-1', dto);

    expect(service.create).toHaveBeenCalledWith('event-1', dto);
    expect(result).toEqual(created);
  });

  it('GET /eventos/:eventId/organizacoes delega para o service', async () => {
    const list = [{ organizationId: 'org-1' }] as never;
    service.findAll.mockResolvedValue(list);

    const result = await controller.findAll('event-1');

    expect(service.findAll).toHaveBeenCalledWith('event-1');
    expect(result).toEqual(list);
  });

  it('DELETE /eventos/:eventId/organizacoes/:orgId delega para o service', async () => {
    service.remove.mockResolvedValue(undefined);

    await controller.remove('event-1', 'org-1');

    expect(service.remove).toHaveBeenCalledWith('event-1', 'org-1');
  });
});
