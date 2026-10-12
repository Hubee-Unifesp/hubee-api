import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { OrganizationResponseDto } from './dto/organization-response.dto';

/** Linha completa do banco, como o service a retorna. */
const row = {
  id: 'org-1',
  name: 'Centro Acadêmico',
  description: null,
  representativeId: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

describe('OrganizationController', () => {
  let controller: OrganizationController;
  let service: {
    findAll: jest.Mock<OrganizationService['findAll']>;
    findOne: jest.Mock<OrganizationService['findOne']>;
    create: jest.Mock<OrganizationService['create']>;
    update: jest.Mock<OrganizationService['update']>;
    remove: jest.Mock<OrganizationService['remove']>;
  };

  beforeEach(async () => {
    service = {
      findAll: jest.fn<OrganizationService['findAll']>(),
      findOne: jest.fn<OrganizationService['findOne']>(),
      create: jest.fn<OrganizationService['create']>(),
      update: jest.fn<OrganizationService['update']>(),
      remove: jest.fn<OrganizationService['remove']>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationController],
      providers: [{ provide: OrganizationService, useValue: service }],
    }).compile();

    controller = module.get(OrganizationController);
  });

  it('POST /organizations delega para organizationService.create()', async () => {
    const dto: CreateOrganizationDto = { name: 'Centro Acadêmico' };
    const created = row as never;
    service.create.mockResolvedValue(created);

    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(created);
    expect(result).toBeInstanceOf(OrganizationResponseDto);
  });

  it('GET /organizations delega para organizationService.findAll() com os filtros da query', async () => {
    const list = [row] as never;
    service.findAll.mockResolvedValue(list);

    const result = await controller.findAll({ name: 'Centro' });

    expect(service.findAll).toHaveBeenCalledWith({ name: 'Centro' });
    expect(result).toEqual(list);
    expect(result[0]).toBeInstanceOf(OrganizationResponseDto);
  });

  it('GET /organizations/:id delega para organizationService.findOne()', async () => {
    const organization = row as never;
    service.findOne.mockResolvedValue(organization);

    const result = await controller.findOne('org-1');

    expect(service.findOne).toHaveBeenCalledWith('org-1');
    expect(result).toEqual(organization);
    expect(result).toBeInstanceOf(OrganizationResponseDto);
  });

  it('PATCH /organizations/:id delega para organizationService.update()', async () => {
    const dto: UpdateOrganizationDto = { name: 'Novo nome' };
    const updated = row as never;
    service.update.mockResolvedValue(updated);

    const result = await controller.update('org-1', dto);

    expect(service.update).toHaveBeenCalledWith('org-1', dto);
    expect(result).toEqual(updated);
    expect(result).toBeInstanceOf(OrganizationResponseDto);
  });

  it('DELETE /organizations/:id delega para organizationService.remove()', async () => {
    service.remove.mockResolvedValue(undefined);

    await controller.remove('org-1');

    expect(service.remove).toHaveBeenCalledWith('org-1');
  });
});
