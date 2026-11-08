import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../database/database.constants';
import { organizations } from '../database/schema';
import { UsersService } from '../users/users.service';
import { OrganizationRepository } from './organization.repository';
import { OrganizationService } from './organization.service';

type Organization = typeof organizations.$inferSelect;

function makeOrganization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: 'org-1',
    name: 'Centro Acadêmico',
    description: 'Organização estudantil',
    representativeId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('OrganizationService', () => {
  let service: OrganizationService;
  const tx = { tx: true };
  const db = {
    transaction: jest.fn(async (callback: (tx: unknown) => unknown) =>
      callback(tx),
    ),
  };
  let organizationRepository: {
    findAll: jest.Mock<OrganizationRepository['findAll']>;
    findById: jest.Mock<OrganizationRepository['findById']>;
    create: jest.Mock<OrganizationRepository['create']>;
    addMember: jest.Mock<OrganizationRepository['addMember']>;
    update: jest.Mock<OrganizationRepository['update']>;
    delete: jest.Mock<OrganizationRepository['delete']>;
  };
  let usersService: {
    findOne: jest.Mock<UsersService['findOne']>;
  };

  beforeEach(async () => {
    db.transaction.mockClear();
    organizationRepository = {
      findAll: jest.fn<OrganizationRepository['findAll']>(),
      findById: jest.fn<OrganizationRepository['findById']>(),
      create: jest.fn<OrganizationRepository['create']>(),
      addMember: jest.fn<OrganizationRepository['addMember']>(),
      update: jest.fn<OrganizationRepository['update']>(),
      delete: jest.fn<OrganizationRepository['delete']>(),
    };
    usersService = {
      findOne: jest.fn<UsersService['findOne']>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        {
          provide: DRIZZLE,
          useValue: db,
        },
        {
          provide: OrganizationRepository,
          useValue: organizationRepository,
        },
        {
          provide: UsersService,
          useValue: usersService,
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
    it('cria a organização e o vínculo de admin em uma transação', async () => {
      const created = makeOrganization({ representativeId: 'user-1' });
      usersService.findOne.mockResolvedValue({ id: 'user-1' });
      organizationRepository.create.mockResolvedValue(created);
      organizationRepository.addMember.mockResolvedValue({} as never);

      const result = await service.create(
        {
          name: 'Centro Acadêmico',
          description: 'Organização estudantil',
        },
        'user-1',
      );

      expect(usersService.findOne).toHaveBeenCalledWith('user-1');
      expect(db.transaction).toHaveBeenCalledTimes(1);
      expect(organizationRepository.create).toHaveBeenCalledWith(
        {
          name: 'Centro Acadêmico',
          description: 'Organização estudantil',
          representativeId: 'user-1',
        },
        tx,
      );
      expect(organizationRepository.addMember).toHaveBeenCalledWith(
        {
          orgId: 'org-1',
          userId: 'user-1',
          role: 'admin',
          permission: 'full',
          inviteStatus: 'accepted',
        },
        tx,
      );
      expect(result).toEqual(created);
    });

    it('garante que representativeId receba o user.id do criador mesmo se enviado outro valor no DTO', async () => {
      const created = makeOrganization({ representativeId: 'user-1' });
      usersService.findOne.mockResolvedValue({ id: 'user-1' });
      organizationRepository.create.mockResolvedValue(created);
      organizationRepository.addMember.mockResolvedValue({} as never);

      await service.create(
        {
          name: 'Centro Acadêmico',
          representativeId: 'outro-user',
        },
        'user-1',
      );

      expect(organizationRepository.create).toHaveBeenCalledWith(
        {
          name: 'Centro Acadêmico',
          representativeId: 'user-1',
        },
        tx,
      );
    });

    it('lança NotFound e não abre transação quando o usuário criador não existe', async () => {
      usersService.findOne.mockRejectedValue(
        new NotFoundException('Usuário não encontrado.'),
      );

      await expect(
        service.create(
          {
            name: 'Centro Acadêmico',
          },
          'user-1',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(db.transaction).not.toHaveBeenCalled();
      expect(organizationRepository.create).not.toHaveBeenCalled();
      expect(organizationRepository.addMember).not.toHaveBeenCalled();
    });

    it('propaga erros inesperados da consulta de usuários', async () => {
      usersService.findOne.mockRejectedValue(new Error('conexão perdida'));

      await expect(
        service.create(
          {
            name: 'Centro Acadêmico',
          },
          'user-1',
        ),
      ).rejects.toThrow('conexão perdida');
      expect(db.transaction).not.toHaveBeenCalled();
      expect(organizationRepository.create).not.toHaveBeenCalled();
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

    it('lança NotFound e não escreve quando o novo representante não existe', async () => {
      organizationRepository.findById.mockResolvedValue(makeOrganization());
      usersService.findOne.mockRejectedValue(
        new NotFoundException('Usuário não encontrado.'),
      );

      await expect(
        service.update('org-1', { representativeId: 'user-1' }),
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
