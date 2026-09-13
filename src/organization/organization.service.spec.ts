import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { organizations } from '../database/schema';
import { OrganizationRepository } from './organization.repository';
import { OrganizationService } from './organization.service';

type Organization = typeof organizations.$inferSelect;

function makeOrganization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: 'org-1',
    name: 'Centro Acadêmico',
    description: 'Organização estudantil',
    representativeId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('OrganizationService', () => {
  let service: OrganizationService;
  let organizationRepository: {
    findAll: jest.Mock<OrganizationRepository['findAll']>;
    findById: jest.Mock<OrganizationRepository['findById']>;
    create: jest.Mock<OrganizationRepository['create']>;
    update: jest.Mock<OrganizationRepository['update']>;
    delete: jest.Mock<OrganizationRepository['delete']>;
  };

  beforeEach(async () => {
    organizationRepository = {
      findAll: jest.fn<OrganizationRepository['findAll']>(),
      findById: jest.fn<OrganizationRepository['findById']>(),
      create: jest.fn<OrganizationRepository['create']>(),
      update: jest.fn<OrganizationRepository['update']>(),
      delete: jest.fn<OrganizationRepository['delete']>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        {
          provide: OrganizationRepository,
          useValue: organizationRepository,
        },
      ],
    }).compile();

    service = module.get(OrganizationService);
  });

  describe('findAll()', () => {
    it('repassa os filtros para o repositório', async () => {
      const rows = [makeOrganization()];
      organizationRepository.findAll.mockResolvedValue(rows);

      const result = await service.findAll({ name: 'Centro' });

      expect(organizationRepository.findAll).toHaveBeenCalledWith({
        name: 'Centro',
      });
      expect(result).toEqual(rows);
    });
  });

  describe('findOne()', () => {
    it('retorna a organização quando ela existe', async () => {
      const organization = makeOrganization();
      organizationRepository.findById.mockResolvedValue(organization);

      await expect(service.findOne('org-1')).resolves.toEqual(organization);
    });

    it('lança NotFound quando a organização não existe', async () => {
      organizationRepository.findById.mockResolvedValue(undefined);

      await expect(service.findOne('org-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create()', () => {
    it('delega a criação para o repositório', async () => {
      const created = makeOrganization();
      organizationRepository.create.mockResolvedValue(created);

      const result = await service.create({
        name: 'Centro Acadêmico',
        description: 'Organização estudantil',
      });

      expect(organizationRepository.create).toHaveBeenCalledWith({
        name: 'Centro Acadêmico',
        description: 'Organização estudantil',
      });
      expect(result).toEqual(created);
    });
  });

  describe('update()', () => {
    it('atualiza quando a organização existe', async () => {
      const organization = makeOrganization();
      const updated = makeOrganization({ name: 'Novo nome' });
      organizationRepository.findById.mockResolvedValue(organization);
      organizationRepository.update.mockResolvedValue(updated);

      const result = await service.update('org-1', { name: 'Novo nome' });

      expect(organizationRepository.update).toHaveBeenCalledWith('org-1', {
        name: 'Novo nome',
      });
      expect(result).toEqual(updated);
    });

    it('lança NotFound e não escreve quando a organização não existe', async () => {
      organizationRepository.findById.mockResolvedValue(undefined);

      await expect(
        service.update('org-1', { name: 'Novo nome' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(organizationRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove()', () => {
    it('remove quando a organização existe', async () => {
      organizationRepository.findById.mockResolvedValue(makeOrganization());
      organizationRepository.delete.mockResolvedValue(undefined);

      await service.remove('org-1');

      expect(organizationRepository.delete).toHaveBeenCalledWith('org-1');
    });

    it('lança NotFound e não apaga quando a organização não existe', async () => {
      organizationRepository.findById.mockResolvedValue(undefined);

      await expect(service.remove('org-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(organizationRepository.delete).not.toHaveBeenCalled();
    });
  });
});
