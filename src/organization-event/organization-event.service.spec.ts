import { jest } from '@jest/globals';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { organizationEvents } from '../database/schema';
import { EventService } from '../event/event.service';
import { OrganizationService } from '../organization/organization.service';
import { OrganizationEventRepository } from './organization-event.repository';
import { OrganizationEventService } from './organization-event.service';

type OrganizationEvent = typeof organizationEvents.$inferSelect;

const EVENT_ID = 'event-1';
const ORG_ID = 'org-1';

function makeLink(
  overrides: Partial<OrganizationEvent> = {},
): OrganizationEvent {
  return {
    organizationId: ORG_ID,
    eventId: EVENT_ID,
    role: 'co_organizer',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('OrganizationEventService', () => {
  let service: OrganizationEventService;
  let repository: {
    findAllByEvent: jest.Mock<OrganizationEventRepository['findAllByEvent']>;
    findOne: jest.Mock<OrganizationEventRepository['findOne']>;
    create: jest.Mock<OrganizationEventRepository['create']>;
    delete: jest.Mock<OrganizationEventRepository['delete']>;
  };
  let eventService: { findOne: jest.Mock<EventService['findOne']> };
  let organizationService: {
    findOne: jest.Mock<OrganizationService['findOne']>;
  };

  beforeEach(async () => {
    repository = {
      findAllByEvent: jest.fn<OrganizationEventRepository['findAllByEvent']>(),
      findOne: jest.fn<OrganizationEventRepository['findOne']>(),
      create: jest.fn<OrganizationEventRepository['create']>(),
      delete: jest.fn<OrganizationEventRepository['delete']>(),
    };
    eventService = { findOne: jest.fn<EventService['findOne']>() };
    organizationService = {
      findOne: jest.fn<OrganizationService['findOne']>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationEventService,
        { provide: OrganizationEventRepository, useValue: repository },
        { provide: EventService, useValue: eventService },
        { provide: OrganizationService, useValue: organizationService },
      ],
    }).compile();

    service = module.get(OrganizationEventService);
  });

  describe('findAll()', () => {
    it('lista as organizações vinculadas ao evento', async () => {
      const rows = [makeLink()];
      eventService.findOne.mockResolvedValue({} as never);
      repository.findAllByEvent.mockResolvedValue(rows);

      const result = await service.findAll(EVENT_ID);

      expect(eventService.findOne).toHaveBeenCalledWith(EVENT_ID);
      expect(repository.findAllByEvent).toHaveBeenCalledWith(EVENT_ID);
      expect(result).toEqual(rows);
    });

    it('lança 404 quando o evento não existe', async () => {
      eventService.findOne.mockRejectedValue(new NotFoundException());

      await expect(service.findAll('event-404')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repository.findAllByEvent).not.toHaveBeenCalled();
    });
  });

  describe('create()', () => {
    it('cria o vínculo depois de validar evento e organização', async () => {
      const link = makeLink();
      eventService.findOne.mockResolvedValue({} as never);
      organizationService.findOne.mockResolvedValue({} as never);
      repository.findOne.mockResolvedValue(undefined);
      repository.create.mockResolvedValue(link);

      const result = await service.create(EVENT_ID, {
        organizationId: ORG_ID,
        role: 'co_organizer',
      });

      expect(eventService.findOne).toHaveBeenCalledWith(EVENT_ID);
      expect(organizationService.findOne).toHaveBeenCalledWith(ORG_ID);
      expect(repository.create).toHaveBeenCalledWith({
        eventId: EVENT_ID,
        organizationId: ORG_ID,
        role: 'co_organizer',
      });
      expect(result).toEqual(link);
    });

    it('lança 409 quando o vínculo já existe', async () => {
      eventService.findOne.mockResolvedValue({} as never);
      organizationService.findOne.mockResolvedValue({} as never);
      repository.findOne.mockResolvedValue(makeLink());

      await expect(
        service.create(EVENT_ID, { organizationId: ORG_ID, role: 'main' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('lança 404 quando o evento não existe', async () => {
      eventService.findOne.mockRejectedValue(new NotFoundException());

      await expect(
        service.create('event-404', { organizationId: ORG_ID, role: 'main' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(organizationService.findOne).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('lança 404 quando a organização não existe', async () => {
      eventService.findOne.mockResolvedValue({} as never);
      organizationService.findOne.mockRejectedValue(new NotFoundException());

      await expect(
        service.create(EVENT_ID, { organizationId: 'org-404', role: 'main' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('remove()', () => {
    it('remove o vínculo existente', async () => {
      repository.findOne.mockResolvedValue(makeLink());
      repository.delete.mockResolvedValue(undefined);

      await service.remove(EVENT_ID, ORG_ID);

      expect(repository.delete).toHaveBeenCalledWith(EVENT_ID, ORG_ID);
    });

    it('lança 404 quando o vínculo não existe', async () => {
      repository.findOne.mockResolvedValue(undefined);

      await expect(service.remove(EVENT_ID, 'org-404')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repository.delete).not.toHaveBeenCalled();
    });
  });
});
